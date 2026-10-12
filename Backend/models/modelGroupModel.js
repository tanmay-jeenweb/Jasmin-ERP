const db = require('../config/db.js');

const createModelGroupsTable = async () => {
    const query = `
        CREATE TABLE IF NOT EXISTS model_group_master (
            id INT AUTO_INCREMENT PRIMARY KEY,
            brand_name VARCHAR(150) NOT NULL,
            model_group_name VARCHAR(255) NOT NULL,
            is_active TINYINT(1) DEFAULT 1,
            added_by INT NULL,
            device_id VARCHAR(255),
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_brand_group (brand_name, model_group_name),
            FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE SET NULL
        )
    `;
    await db.execute(query);

    // Migration to add is_active column if not present
    try {
        const [cols] = await db.execute(`SHOW COLUMNS FROM model_group_master LIKE 'is_active'`);
        if (!cols || cols.length === 0) {
            console.log("Migrating model_group_master schema: adding is_active column...");
            await db.execute(`ALTER TABLE model_group_master ADD COLUMN is_active TINYINT(1) DEFAULT 1 AFTER model_group_name`);
        }
    } catch (err) {
        console.error("Migration of model_group_master table failed:", err.message);
    }

    console.log("Model Group master table ready");
};

const upsertModelGroups = async (groups, addedBy, deviceId) => {
    if (!groups || groups.length === 0) return;

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Soft-mark all current model groups as inactive first (so removed/discontinued items become is_active=0)
        await connection.execute('UPDATE model_group_master SET is_active = 0');

        // Batch upsert in chunks of 500 to keep IDs stable, permanent, and fast
        const CHUNK_SIZE = 500;
        for (let i = 0; i < groups.length; i += CHUNK_SIZE) {
            const chunk = groups.slice(i, i + CHUNK_SIZE);
            const values = [];
            const placeholders = chunk.map(g => {
                values.push(g.brand_name, g.model_group_name, addedBy, deviceId, 1);
                return '(?, ?, ?, ?, ?)';
            }).join(', ');

            const query = `
                INSERT INTO model_group_master (
                    brand_name, model_group_name, added_by, device_id, is_active
                ) VALUES ${placeholders}
                ON DUPLICATE KEY UPDATE
                    is_active = 1,
                    added_by = VALUES(added_by),
                    device_id = VALUES(device_id),
                    updated_at = CURRENT_TIMESTAMP
            `;
            await connection.execute(query, values);
        }

        await connection.commit();

        // Automatically reconcile and update any offer model groups that were renamed in ERP
        try {
            await autoResolveRenamedOfferGroups(connection);
        } catch (autoErr) {
            console.warn("Auto-resolve of renamed offer groups warning:", autoErr.message);
        }
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

const cleanNormString = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const autoResolveRenamedOfferGroups = async (connection = db) => {
    try {
        // 1. Fetch discontinued or unlinked offer_model_groups
        const [discontinued] = await connection.execute(`
            SELECT 
                omg.id AS omg_id,
                omg.offer_id,
                omg.model_group_id,
                omg.model_group_name,
                o.brand_name
            FROM offer_model_groups omg
            JOIN offers o ON omg.offer_id = o.id
            LEFT JOIN model_group_master mgm ON omg.model_group_id = mgm.id
            WHERE omg.model_group_id IS NULL OR mgm.id IS NULL OR mgm.is_active = 0
        `);

        if (!discontinued || discontinued.length === 0) return 0;

        // 2. Fetch all active model groups
        const [activeGroups] = await connection.execute(`
            SELECT id, brand_name, model_group_name 
            FROM model_group_master 
            WHERE is_active = 1
        `);

        // Map active groups by normalized key: brand|||cleanname
        const activeByNorm = new Map();
        activeGroups.forEach(g => {
            const key = `${(g.brand_name || '').toLowerCase()}|||${cleanNormString(g.model_group_name)}`;
            activeByNorm.set(key, g);
        });

        let resolvedCount = 0;
        const affectedOfferIds = new Set();

        for (const row of discontinued) {
            // Priority 1: Check normalized match (handles punctuation, hyphen, spacing differences)
            const normKey = `${(row.brand_name || '').toLowerCase()}|||${cleanNormString(row.model_group_name)}`;
            let matchedActive = activeByNorm.get(normKey);

            // Priority 2: Check item_model_master mapping if products under that name transitioned
            if (!matchedActive) {
                try {
                    const [itemMatches] = await connection.execute(`
                        SELECT imm.model_group_name
                        FROM item_model_master imm
                        WHERE LOWER(TRIM(imm.model_name)) LIKE CONCAT('%', LOWER(TRIM(?)), '%')
                        LIMIT 1
                    `, [row.model_group_name]);
                    if (itemMatches.length > 0 && itemMatches[0].model_group_name) {
                        const candidateKey = `${(row.brand_name || '').toLowerCase()}|||${cleanNormString(itemMatches[0].model_group_name)}`;
                        matchedActive = activeByNorm.get(candidateKey);
                    }
                } catch (e) {}
            }

            if (matchedActive) {
                await connection.execute(`
                    UPDATE offer_model_groups 
                    SET model_group_id = ?, model_group_name = ?
                    WHERE id = ?
                `, [matchedActive.id, matchedActive.model_group_name, row.omg_id]);

                affectedOfferIds.add(row.offer_id);
                resolvedCount++;
            }
        }

        // Refresh offers.model_group_name string for affected offers
        for (const offerId of affectedOfferIds) {
            const [groups] = await connection.execute(`
                SELECT model_group_name FROM offer_model_groups WHERE offer_id = ? ORDER BY model_group_name ASC
            `, [offerId]);
            const commaSeparated = groups.map(g => g.model_group_name).join(', ');
            await connection.execute(`
                UPDATE offers SET model_group_name = ? WHERE id = ?
            `, [commaSeparated, offerId]);
        }

        if (resolvedCount > 0) {
            console.log(`[AutoResolve] Automatically resolved ${resolvedCount} renamed offer model group(s).`);
        }
        return resolvedCount;
    } catch (err) {
        console.error("Error in autoResolveRenamedOfferGroups:", err);
        return 0;
    }
};

const getAllModelGroups = async (onlyActive = false) => {
    let query = `
        SELECT
            mgm.id,
            mgm.brand_name,
            mgm.model_group_name,
            COALESCE(mgm.is_active, 1) AS is_active,
            mgm.device_id,
            mgm.timestamp,
            COALESCE(u.name, 'System') AS added_by_name
        FROM model_group_master mgm
        LEFT JOIN users u ON mgm.added_by = u.id
    `;
    if (onlyActive) {
        query += ` WHERE COALESCE(mgm.is_active, 1) = 1`;
    }
    query += ` ORDER BY mgm.id ASC`;
    const [results] = await db.execute(query);
    return results;
};

const deleteModelGroup = async (id) => {
    const query = `DELETE FROM model_group_master WHERE id = ?`;
    const [result] = await db.execute(query, [id]);
    return result;
};

const getModelGroupById = async (id) => {
    const query = `
        SELECT *
        FROM model_group_master 
        WHERE id = ?
    `;
    const [rows] = await db.execute(query, [id]);
    return rows[0] || null;
};

module.exports = {
    createModelGroupsTable,
    upsertModelGroups,
    autoResolveRenamedOfferGroups,
    getAllModelGroups,
    deleteModelGroup,
    getModelGroupById
};

const db = require('../config/db.js');

const createVariationTable = async () => {
    const query = `
        CREATE TABLE IF NOT EXISTS variation_master (
            id INT AUTO_INCREMENT PRIMARY KEY,
            state_id INT NOT NULL,
            format_name VARCHAR(255) NOT NULL,
            columns JSON NOT NULL,
            brand_configs JSON NULL,
            added_by INT NOT NULL,
            device_id VARCHAR(255),
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (state_id) REFERENCES state_master(id) ON DELETE CASCADE,
            FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE CASCADE
        )
    `;
    await db.execute(query);

    // Migration logic
    try {
        const [columnsInfo] = await db.execute(`SHOW COLUMNS FROM variation_master LIKE 'brands'`);
        if (columnsInfo && columnsInfo.length > 0) {
            console.log("Migrating variation_master schema: converting brands to format_name and brand_configs...");
            
            // 1. Add format_name column if not present
            try {
                await db.execute(`ALTER TABLE variation_master ADD COLUMN format_name VARCHAR(255) NOT NULL DEFAULT 'Default Format'`);
            } catch (e) {
                // Column might already exist
            }

            // 2. Add brand_configs column if not present
            try {
                await db.execute(`ALTER TABLE variation_master ADD COLUMN brand_configs JSON NULL`);
            } catch (e) {
                // Column might already exist
            }

            // 3. Drop the old brands column
            try {
                await db.execute(`ALTER TABLE variation_master DROP COLUMN brands`);
            } catch (e) {
                // Column might already be dropped
            }
            console.log("Migration of variation_master table finished successfully.");
        }
    } catch (err) {
        console.error("Migration error on variation_master:", err);
    }

    console.log("Variation master table ready");
};

const createVariation = async (stateId, formatName, columns, brandConfigs, addedBy, deviceId) => {
    const query = `
        INSERT INTO variation_master (state_id, format_name, columns, brand_configs, added_by, device_id)
        VALUES (?, ?, ?, ?, ?, ?)
    `;
    const [result] = await db.execute(query, [
        stateId,
        formatName,
        JSON.stringify(columns),
        brandConfigs ? JSON.stringify(brandConfigs) : null,
        addedBy,
        deviceId
    ]);
    return result;
};

const getAllVariations = async () => {
    const query = `
        SELECT
            vm.id,
            vm.state_id,
            sm.name AS state_name,
            vm.format_name,
            vm.brand_configs,
            vm.columns,
            COALESCE(u.name, 'Unknown') AS added_by_name,
            vm.device_id,
            vm.timestamp
        FROM variation_master vm
        LEFT JOIN state_master sm ON vm.state_id = sm.id
        LEFT JOIN users u ON vm.added_by = u.id
        ORDER BY vm.timestamp DESC
    `;
    const [results] = await db.execute(query);
    return results;
};

const getVariationById = async (id) => {
    const query = `
        SELECT
            vm.id,
            vm.state_id,
            sm.name AS state_name,
            vm.format_name,
            vm.brand_configs,
            vm.columns,
            vm.added_by,
            vm.device_id,
            vm.timestamp
        FROM variation_master vm
        LEFT JOIN state_master sm ON vm.state_id = sm.id
        WHERE vm.id = ?
    `;
    const [rows] = await db.execute(query, [id]);
    return rows[0] || null;
};

const updateVariation = async (id, stateId, formatName, columns, brandConfigs) => {
    const query = `
        UPDATE variation_master
        SET state_id = ?, format_name = ?, columns = ?, brand_configs = ?
        WHERE id = ?
    `;
    const [result] = await db.execute(query, [
        stateId,
        formatName,
        JSON.stringify(columns),
        brandConfigs ? JSON.stringify(brandConfigs) : null,
        id
    ]);
    return result;
};

const deleteVariation = async (id) => {
    const query = `DELETE FROM variation_master WHERE id = ?`;
    const [result] = await db.execute(query, [id]);
    return result;
};

module.exports = {
    createVariationTable,
    createVariation,
    getAllVariations,
    getVariationById,
    updateVariation,
    deleteVariation
};

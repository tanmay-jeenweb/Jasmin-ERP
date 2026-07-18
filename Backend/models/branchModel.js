const db = require('../config/db.js');

const createBranchTable = async () => {
    const query = `
        CREATE TABLE IF NOT EXISTS branch_master (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            code VARCHAR(100) NOT NULL UNIQUE,
            phone VARCHAR(100) NOT NULL,
            email VARCHAR(255) NOT NULL,
            pincode VARCHAR(100) NOT NULL,
            GSTIN VARCHAR(100) NOT NULL,
            opened_on DATE NOT NULL,
            store_type ENUM('branch', 'franchise') NOT NULL,
            state_id INT NOT NULL,
            city VARCHAR(255) NOT NULL,
            address TEXT NOT NULL,
            abm VARCHAR(255) NOT NULL,
            status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
            added_by INT NOT NULL,
            device_id VARCHAR(255),
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (state_id) REFERENCES state_master(id) ON DELETE CASCADE
        )
    `;
    await db.execute(query);
    console.log("Branch master table ready");

    // Alter existing table columns to support longer values in case the table was already created
    try {
        await db.execute(`ALTER TABLE branch_master MODIFY COLUMN phone VARCHAR(100) NOT NULL`);
        await db.execute(`ALTER TABLE branch_master MODIFY COLUMN email VARCHAR(255) NOT NULL`);
        await db.execute(`ALTER TABLE branch_master MODIFY COLUMN pincode VARCHAR(100) NOT NULL`);
        await db.execute(`ALTER TABLE branch_master MODIFY COLUMN GSTIN VARCHAR(100) NOT NULL`);
        await db.execute(`ALTER TABLE branch_master MODIFY COLUMN city VARCHAR(255) NOT NULL`);
        await db.execute(`ALTER TABLE branch_master MODIFY COLUMN abm VARCHAR(255) NOT NULL`);
    } catch (err) {
        console.error("Error altering branch_master columns:", err);
    }
};

const createBranch = async (data, addedBy, deviceId) => {
    const query = `
        INSERT INTO branch_master (
            name, code, phone, email, pincode, GSTIN, opened_on, store_type, state_id, city, address, abm, status, added_by, device_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const [result] = await db.execute(query, [
        data.name,
        data.code,
        data.phone,
        data.email,
        data.pincode,
        data.GSTIN,
        data.opened_on,
        data.store_type,
        data.state_id,
        data.city,
        data.address,
        data.abm,
        data.status || 'active',
        addedBy,
        deviceId
    ]);
    return result;
};

const getAllBranches = async () => {
    const query = `
        SELECT
            bm.id,
            bm.name,
            bm.code,
            bm.phone,
            bm.email,
            bm.pincode,
            bm.GSTIN,
            bm.opened_on,
            bm.store_type,
            bm.state_id,
            sm.name AS state_name,
            bm.city,
            bm.address,
            COALESCE(abm_u.name, bm.abm) AS abm,
            bm.status,
            COALESCE(u.name, 'Unknown') AS added_by_name,
            bm.device_id,
            bm.timestamp
        FROM branch_master bm
        LEFT JOIN state_master sm ON bm.state_id = sm.id
        LEFT JOIN users u ON bm.added_by = u.id
        LEFT JOIN user_branch_mappings abm_m ON bm.id = abm_m.branch_id AND abm_m.user_id IN (
            SELECT u.id FROM users u
            JOIN user_types ut ON u.user_type_id = ut.id
            WHERE ut.user_role = 'ABM' OR ut.type_name = 'ABM'
        )
        LEFT JOIN users abm_u ON abm_m.user_id = abm_u.id
        ORDER BY bm.timestamp DESC
    `;
    const [results] = await db.execute(query);
    return results;
};

const updateBranch = async (id, data) => {
    const query = `
        UPDATE branch_master SET 
            name = ?, 
            code = ?, 
            phone = ?, 
            email = ?, 
            pincode = ?, 
            GSTIN = ?, 
            opened_on = ?, 
            store_type = ?, 
            state_id = ?, 
            city = ?, 
            address = ?, 
            abm = ?, 
            status = ?
        WHERE id = ?
    `;
    const [result] = await db.execute(query, [
        data.name,
        data.code,
        data.phone,
        data.email,
        data.pincode,
        data.GSTIN,
        data.opened_on,
        data.store_type,
        data.state_id,
        data.city,
        data.address,
        data.abm,
        data.status,
        id
    ]);
    return result;
};

const deleteBranch = async (id) => {
    const query = `DELETE FROM branch_master WHERE id = ?`;
    const [result] = await db.execute(query, [id]);
    return result;
};

const getBranchById = async (id) => {
    const query = `
        SELECT
            bm.id,
            bm.name,
            bm.code,
            bm.phone,
            bm.email,
            bm.pincode,
            bm.GSTIN,
            bm.opened_on,
            bm.store_type,
            bm.state_id,
            sm.name AS state_name,
            bm.city,
            bm.address,
            COALESCE(abm_u.name, bm.abm) AS abm,
            bm.status,
            bm.added_by,
            bm.device_id,
            bm.timestamp
        FROM branch_master bm
        LEFT JOIN state_master sm ON bm.state_id = sm.id
        LEFT JOIN user_branch_mappings abm_m ON bm.id = abm_m.branch_id AND abm_m.user_id IN (
            SELECT u.id FROM users u
            JOIN user_types ut ON u.user_type_id = ut.id
            WHERE ut.user_role = 'ABM' OR ut.type_name = 'ABM'
        )
        LEFT JOIN users abm_u ON abm_m.user_id = abm_u.id
        WHERE bm.id = ?
    `;
    const [rows] = await db.execute(query, [id]);
    return rows[0] || null;
};

const upsertBranches = async (branches, addedBy, deviceId) => {
    if (!branches || branches.length === 0) return;

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const stateCache = {};

        for (const b of branches) {
            const rawStateName = (b.state_name || 'UNKNOWN').trim().toUpperCase();
            let stateId = stateCache[rawStateName];

            if (!stateId) {
                const [stateRows] = await connection.execute(
                    'SELECT id FROM state_master WHERE UPPER(name) = ?',
                    [rawStateName]
                );
                if (stateRows.length > 0) {
                    stateId = stateRows[0].id;
                } else {
                    const [insertResult] = await connection.execute(
                        'INSERT INTO state_master (name, added_by, device_id) VALUES (?, ?, ?)',
                        [rawStateName, addedBy, deviceId]
                    );
                    stateId = insertResult.insertId;
                }
                stateCache[rawStateName] = stateId;
            }

            const query = `
                INSERT INTO branch_master (
                    name, code, phone, email, pincode, GSTIN, opened_on, 
                    store_type, state_id, city, address, abm, status, added_by, device_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    name = VALUES(name),
                    phone = VALUES(phone),
                    email = VALUES(email),
                    pincode = VALUES(pincode),
                    GSTIN = VALUES(GSTIN),
                    opened_on = VALUES(opened_on),
                    store_type = VALUES(store_type),
                    state_id = VALUES(state_id),
                    city = VALUES(city),
                    address = VALUES(address),
                    abm = VALUES(abm),
                    status = VALUES(status),
                    added_by = VALUES(added_by),
                    device_id = VALUES(device_id)
            `;

            await connection.execute(query, [
                b.name,
                b.code,
                b.phone || '',
                b.email || '',
                b.pincode || '',
                b.GSTIN || '',
                b.opened_on,
                b.store_type,
                stateId,
                b.city || '',
                b.address || '',
                b.abm || '',
                b.status || 'active',
                addedBy,
                deviceId
            ]);
        }

        await connection.commit();
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

module.exports = {
    createBranchTable,
    createBranch,
    getAllBranches,
    updateBranch,
    deleteBranch,
    getBranchById,
    upsertBranches
};

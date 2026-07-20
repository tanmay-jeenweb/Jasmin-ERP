const db = require('../config/db.js');

const createLandingTypeTable = async () => {
    const query = `
        CREATE TABLE IF NOT EXISTS landing_type_master (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(150) NOT NULL UNIQUE,
            added_by INT NOT NULL,
            device_id VARCHAR(255),
            live ENUM('Yes', 'No') DEFAULT 'Yes',
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE CASCADE
        )
    `;
    await db.execute(query);

    try {
        const [columns] = await db.execute(`SHOW COLUMNS FROM landing_type_master LIKE 'live'`);
        if (columns.length === 0) {
            await db.execute(`ALTER TABLE landing_type_master ADD COLUMN live ENUM('Yes', 'No') DEFAULT 'Yes'`);
            console.log("Added 'live' column to 'landing_type_master' table");
        }
    } catch (err) {
        console.error("Error migrating landing_type_master live column:", err);
    }

    console.log("Landing type master table ready");
};

const createLandingType = async (name, addedBy, deviceId, live) => {
    const query = `INSERT INTO landing_type_master (name, added_by, device_id, live) VALUES (?, ?, ?, ?)`;
    const [result] = await db.execute(query, [name, addedBy, deviceId, live || 'Yes']);
    return result;
};

const getAllLandingTypes = async () => {
    const query = `
        SELECT
            ltm.id,
            ltm.name,
            ltm.live,
            COALESCE(u.name, 'Unknown') AS added_by_name,
            ltm.device_id,
            ltm.timestamp
        FROM landing_type_master ltm
        LEFT JOIN users u ON ltm.added_by = u.id
        ORDER BY ltm.timestamp DESC
    `;
    const [results] = await db.execute(query);
    return results;
};

const updateLandingType = async (id, name, live) => {
    const query = `UPDATE landing_type_master SET name = ?, live = ? WHERE id = ?`;
    const [result] = await db.execute(query, [name, live || 'Yes', id]);
    return result;
};

const deleteLandingType = async (id) => {
    const query = `DELETE FROM landing_type_master WHERE id = ?`;
    const [result] = await db.execute(query, [id]);
    return result;
};

const getLandingTypeById = async (id) => {
    const query = `
        SELECT id, name, live, added_by, device_id, timestamp 
        FROM landing_type_master 
        WHERE id = ?
    `;
    const [rows] = await db.execute(query, [id]);
    return rows[0] || null;
};

module.exports = {
    createLandingTypeTable,
    createLandingType,
    getAllLandingTypes,
    updateLandingType,
    deleteLandingType,
    getLandingTypeById
};

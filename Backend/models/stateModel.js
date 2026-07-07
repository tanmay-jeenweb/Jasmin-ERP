const db = require('../config/db.js');

const createStateTable = async () => {
    const query = `
        CREATE TABLE IF NOT EXISTS state_master (
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

    // Migration to add live column if it doesn't exist on already created table
    try {
        const [columns] = await db.execute(`SHOW COLUMNS FROM state_master LIKE 'live'`);
        if (columns.length === 0) {
            await db.execute(`ALTER TABLE state_master ADD COLUMN live ENUM('Yes', 'No') DEFAULT 'Yes'`);
            console.log("Added 'live' column to 'state_master' table");
        }
    } catch (err) {
        console.error("Error migrating state_master live column:", err);
    }

    console.log("State master table ready");
};

const createState = async (name, addedBy, deviceId, live) => {
    const query = `INSERT INTO state_master (name, added_by, device_id, live) VALUES (?, ?, ?, ?)`;
    const [result] = await db.execute(query, [name, addedBy, deviceId, live || 'Yes']);
    return result;
};

const getAllStates = async () => {
    const query = `
        SELECT
            sm.id,
            sm.name,
            sm.live,
            COALESCE(u.name, 'Unknown') AS added_by_name,
            sm.device_id,
            sm.timestamp
        FROM state_master sm
        LEFT JOIN users u ON sm.added_by = u.id
        ORDER BY sm.timestamp DESC
    `;
    const [results] = await db.execute(query);
    return results;
};

const updateState = async (id, name, live) => {
    const query = `UPDATE state_master SET name = ?, live = ? WHERE id = ?`;
    const [result] = await db.execute(query, [name, live || 'Yes', id]);
    return result;
};

const deleteState = async (id) => {
    const query = `DELETE FROM state_master WHERE id = ?`;
    const [result] = await db.execute(query, [id]);
    return result;
};

const getStateById = async (id) => {
    const query = `
        SELECT id, name, live, added_by, device_id, timestamp 
        FROM state_master 
        WHERE id = ?
    `;
    const [rows] = await db.execute(query, [id]);
    return rows[0] || null;
};

module.exports = {
    createStateTable,
    createState,
    getAllStates,
    updateState,
    deleteState,
    getStateById
};

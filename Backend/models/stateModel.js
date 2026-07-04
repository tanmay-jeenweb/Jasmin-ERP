const db = require('../config/db.js');

const createStateTable = async () => {
    const query = `
        CREATE TABLE IF NOT EXISTS state_master (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(150) NOT NULL UNIQUE,
            added_by INT NOT NULL,
            device_id VARCHAR(255),
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE CASCADE
        )
    `;
    await db.execute(query);
    console.log("State master table ready");
};

const createState = async (name, addedBy, deviceId) => {
    const query = `INSERT INTO state_master (name, added_by, device_id) VALUES (?, ?, ?)`;
    const [result] = await db.execute(query, [name, addedBy, deviceId]);
    return result;
};

const getAllStates = async () => {
    const query = `
        SELECT
            sm.id,
            sm.name,
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

const updateState = async (id, name) => {
    const query = `UPDATE state_master SET name = ? WHERE id = ?`;
    const [result] = await db.execute(query, [name, id]);
    return result;
};

const deleteState = async (id) => {
    const query = `DELETE FROM state_master WHERE id = ?`;
    const [result] = await db.execute(query, [id]);
    return result;
};

const getStateById = async (id) => {
    const query = `
        SELECT id, name, added_by, device_id, timestamp 
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

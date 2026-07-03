const db = require('../config/db.js');

const createFinanceMachineTable = async () => {
    const query = `
        CREATE TABLE IF NOT EXISTS finance_machine_master (
            id INT AUTO_INCREMENT PRIMARY KEY,
            machine_name VARCHAR(255) NOT NULL UNIQUE,
            added_by INT NOT NULL,
            device_id VARCHAR(255),
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE CASCADE
        )
    `;
    await db.execute(query);

    // Drop for_code column if it exists to clean up
    try {
        const [columns] = await db.execute(`SHOW COLUMNS FROM finance_machine_master LIKE 'for_code'`);
        if (columns.length > 0) {
            await db.execute(`ALTER TABLE finance_machine_master DROP COLUMN for_code`);
            console.log("Dropped 'for_code' column from 'finance_machine_master' table");
        }
    } catch (err) {
        console.error("Error migrating finance_machine_master drop for_code column:", err);
    }

    console.log("Finance Machine master table ready");
};

const createFinanceMachine = async (machineName, addedBy, deviceId) => {
    const query = `INSERT INTO finance_machine_master (machine_name, added_by, device_id) VALUES (?, ?, ?)`;
    const [result] = await db.execute(query, [machineName, addedBy, deviceId]);
    return result;
};

const getAllFinanceMachines = async () => {
    const query = `
        SELECT
            fmm.id,
            fmm.machine_name,
            COALESCE(u.name, 'Unknown') AS added_by_name,
            fmm.device_id,
            fmm.timestamp
        FROM finance_machine_master fmm
        LEFT JOIN users u ON fmm.added_by = u.id
        ORDER BY fmm.timestamp DESC
    `;
    const [results] = await db.execute(query);
    return results;
};

const updateFinanceMachine = async (id, machineName) => {
    const query = `UPDATE finance_machine_master SET machine_name = ? WHERE id = ?`;
    const [result] = await db.execute(query, [machineName, id]);
    return result;
};

const deleteFinanceMachine = async (id) => {
    const query = `DELETE FROM finance_machine_master WHERE id = ?`;
    const [result] = await db.execute(query, [id]);
    return result;
};

const getFinanceMachineById = async (id) => {
    const query = `
        SELECT id, machine_name, added_by, device_id, timestamp 
        FROM finance_machine_master 
        WHERE id = ?
    `;
    const [rows] = await db.execute(query, [id]);
    return rows[0] || null;
};

module.exports = {
    createFinanceMachineTable,
    createFinanceMachine,
    getAllFinanceMachines,
    updateFinanceMachine,
    deleteFinanceMachine,
    getFinanceMachineById
};

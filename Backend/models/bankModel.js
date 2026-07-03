const db = require('../config/db.js');

const createBankTable = async () => {
    const query = `
        CREATE TABLE IF NOT EXISTS bank_master (
            id INT AUTO_INCREMENT PRIMARY KEY,
            bank_card_name VARCHAR(255) NOT NULL UNIQUE,
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
        const [columns] = await db.execute(`SHOW COLUMNS FROM bank_master LIKE 'for_code'`);
        if (columns.length > 0) {
            await db.execute(`ALTER TABLE bank_master DROP COLUMN for_code`);
            console.log("Dropped 'for_code' column from 'bank_master' table");
        }
    } catch (err) {
        console.error("Error migrating bank_master drop for_code column:", err);
    }

    console.log("Finance Company master table ready");
};

const createBank = async (bankCardName, addedBy, deviceId) => {
    const query = `INSERT INTO bank_master (bank_card_name, added_by, device_id) VALUES (?, ?, ?)`;
    const [result] = await db.execute(query, [bankCardName, addedBy, deviceId]);
    return result;
};

const getAllBanks = async () => {
    const query = `
        SELECT
            bm.id,
            bm.bank_card_name,
            COALESCE(u.name, 'Unknown') AS added_by_name,
            bm.device_id,
            bm.timestamp
        FROM bank_master bm
        LEFT JOIN users u ON bm.added_by = u.id
        ORDER BY bm.timestamp DESC
    `;
    const [results] = await db.execute(query);
    return results;
};

const updateBank = async (id, bankCardName) => {
    const query = `UPDATE bank_master SET bank_card_name = ? WHERE id = ?`;
    const [result] = await db.execute(query, [bankCardName, id]);
    return result;
};

const deleteBank = async (id) => {
    const query = `DELETE FROM bank_master WHERE id = ?`;
    const [result] = await db.execute(query, [id]);
    return result;
};

const getBankById = async (id) => {
    const query = `
        SELECT id, bank_card_name, added_by, device_id, timestamp 
        FROM bank_master 
        WHERE id = ?
    `;
    const [rows] = await db.execute(query, [id]);
    return rows[0] || null;
};

module.exports = {
    createBankTable,
    createBank,
    getAllBanks,
    updateBank,
    deleteBank,
    getBankById
};

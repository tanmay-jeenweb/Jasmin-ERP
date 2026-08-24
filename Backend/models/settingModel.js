const db = require('../config/db.js');

const createSettingsTable = async () => {
    const query = `
        CREATE TABLE IF NOT EXISTS settings (
            setting_key VARCHAR(100) PRIMARY KEY,
            setting_value TEXT NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `;
    await db.execute(query);
    console.log("Settings table ready");
};

const getSetting = async (key) => {
    try {
        const query = `SELECT setting_value FROM settings WHERE setting_key = ?`;
        const [rows] = await db.execute(query, [key]);
        if (rows.length === 0) return null;
        return rows[0].setting_value;
    } catch (error) {
        console.error(`Error fetching setting '${key}':`, error.message);
        return null;
    }
};

const setSetting = async (key, value) => {
    const query = `
        INSERT INTO settings (setting_key, setting_value)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
    `;
    await db.execute(query, [key, value]);
};

module.exports = {
    createSettingsTable,
    getSetting,
    setSetting
};

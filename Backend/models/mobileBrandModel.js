const db = require('../config/db.js');

const createMobileBrandsTable = async () => {
    const query = `
        CREATE TABLE IF NOT EXISTS mobile_brand_master (
            id INT AUTO_INCREMENT PRIMARY KEY,
            mobile_brand VARCHAR(255) NOT NULL UNIQUE,
            added_by INT NOT NULL,
            device_id VARCHAR(255),
            for_code ENUM('Yes', 'No') DEFAULT 'No',
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE CASCADE
        )
    `;
    await db.execute(query);

    // Migration to add for_code column if it doesn't exist on already created table
    try {
        const [columns] = await db.execute(`SHOW COLUMNS FROM mobile_brand_master LIKE 'for_code'`);
        if (columns.length === 0) {
            await db.execute(`ALTER TABLE mobile_brand_master ADD COLUMN for_code ENUM('Yes', 'No') DEFAULT 'No'`);
            console.log("Added 'for_code' column to 'mobile_brand_master' table");
        }
    } catch (err) {
        console.error("Error migrating mobile_brand_master for_code column:", err);
    }

    console.log("Mobile brand master table ready");
};

const createMobileBrand = async (mobileBrand, addedBy, deviceId, forCode) => {
    const query = `INSERT INTO mobile_brand_master (mobile_brand, added_by, device_id, for_code) VALUES (?, ?, ?, ?)`;
    const [result] = await db.execute(query, [mobileBrand, addedBy, deviceId, forCode || 'No']);
    return result;
};

const getAllMobileBrands = async () => {
    const query = `
        SELECT
            mbm.id,
            mbm.mobile_brand,
            mbm.for_code,
            COALESCE(u.name, 'Unknown') AS added_by_name,
            mbm.device_id,
            mbm.timestamp
        FROM mobile_brand_master mbm
        LEFT JOIN users u ON mbm.added_by = u.id
        ORDER BY mbm.timestamp DESC
    `;
    const [results] = await db.execute(query);
    return results;
};

const updateMobileBrand = async (id, mobileBrand, forCode) => {
    const query = `UPDATE mobile_brand_master SET mobile_brand = ?, for_code = ? WHERE id = ?`;
    const [result] = await db.execute(query, [mobileBrand, forCode || 'No', id]);
    return result;
};

const deleteMobileBrand = async (id) => {
    const query = `DELETE FROM mobile_brand_master WHERE id = ?`;
    const [result] = await db.execute(query, [id]);
    return result;
};

const getMobileBrandById = async (id) => {
    const query = `
        SELECT id, mobile_brand, for_code, added_by, device_id, timestamp 
        FROM mobile_brand_master 
        WHERE id = ?
    `;
    const [rows] = await db.execute(query, [id]);
    return rows[0] || null;
};

module.exports = {
    createMobileBrandsTable,
    createMobileBrand,
    getAllMobileBrands,
    updateMobileBrand,
    deleteMobileBrand,
    getMobileBrandById
};

const db = require('../config/db.js');

const createSupportTable = async () => {
    const query = `
        CREATE TABLE IF NOT EXISTS support_master (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(150) NOT NULL,
            designation VARCHAR(150) NOT NULL,
            mobile_no VARCHAR(20) NOT NULL,
            work VARCHAR(255) NOT NULL,
            added_by INT NOT NULL,
            device_id VARCHAR(255),
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE CASCADE
        )
    `;
    await db.execute(query);
    console.log("Support master table ready (without live field)");
};

const createSupport = async (name, designation, mobileNo, work, addedBy, deviceId) => {
    const query = `
        INSERT INTO support_master (name, designation, mobile_no, work, added_by, device_id)
        VALUES (?, ?, ?, ?, ?, ?)
    `;
    const [result] = await db.execute(query, [name, designation, mobileNo, work, addedBy, deviceId]);
    return result;
};

const getAllSupports = async () => {
    const query = `
        SELECT
            sm.id,
            sm.name,
            sm.designation,
            sm.mobile_no,
            sm.work,
            COALESCE(u.name, 'Unknown') AS added_by_name,
            sm.device_id,
            sm.timestamp
        FROM support_master sm
        LEFT JOIN users u ON sm.added_by = u.id
        ORDER BY sm.timestamp DESC
    `;
    const [results] = await db.execute(query);
    return results;
};

const updateSupport = async (id, name, designation, mobileNo, work) => {
    const query = `
        UPDATE support_master
        SET name = ?, designation = ?, mobile_no = ?, work = ?
        WHERE id = ?
    `;
    const [result] = await db.execute(query, [name, designation, mobileNo, work, id]);
    return result;
};

const deleteSupport = async (id) => {
    const query = `DELETE FROM support_master WHERE id = ?`;
    const [result] = await db.execute(query, [id]);
    return result;
};

const getSupportById = async (id) => {
    const query = `
        SELECT id, name, designation, mobile_no, work, added_by, device_id, timestamp
        FROM support_master
        WHERE id = ?
    `;
    const [rows] = await db.execute(query, [id]);
    return rows[0] || null;
};

module.exports = {
    createSupportTable,
    createSupport,
    getAllSupports,
    updateSupport,
    deleteSupport,
    getSupportById
};

const db = require("../config/db.js");

const createAlertsTable = async () => {
    const query = `
        CREATE TABLE IF NOT EXISTS alerts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            description TEXT NOT NULL,
            image_path VARCHAR(255) NULL,
            active TINYINT(1) DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `;
    await db.execute(query);
    console.log("Alerts table ready");
};

const createAlert = async (title, description, imagePath) => {
    const query = `
        INSERT INTO alerts (title, description, image_path, active)
        VALUES (?, ?, ?, 1)
    `;
    const [result] = await db.execute(query, [title, description, imagePath || null]);
    return result;
};

const getAllAlerts = async () => {
    const query = `
        SELECT * FROM alerts
        ORDER BY created_at DESC
    `;
    const [rows] = await db.execute(query);
    return rows;
};

const getActiveAlerts = async () => {
    const query = `
        SELECT * FROM alerts
        WHERE active = 1
        ORDER BY created_at DESC
    `;
    const [rows] = await db.execute(query);
    return rows;
};

const getAlertById = async (id) => {
    const query = `
        SELECT * FROM alerts
        WHERE id = ?
    `;
    const [rows] = await db.execute(query, [id]);
    return rows[0];
};

const updateAlert = async (id, title, description, imagePath, active) => {
    let query;
    let params;
    if (imagePath !== undefined) {
        query = `
            UPDATE alerts
            SET title = ?, description = ?, image_path = ?, active = ?
            WHERE id = ?
        `;
        params = [title, description, imagePath, active ? 1 : 0, id];
    } else {
        query = `
            UPDATE alerts
            SET title = ?, description = ?, active = ?
            WHERE id = ?
        `;
        params = [title, description, active ? 1 : 0, id];
    }
    const [result] = await db.execute(query, params);
    return result;
};

const deleteAlert = async (id) => {
    const query = `
        DELETE FROM alerts
        WHERE id = ?
    `;
    const [result] = await db.execute(query, [id]);
    return result;
};

const toggleAlertActive = async (id, active) => {
    const query = `
        UPDATE alerts
        SET active = ?
        WHERE id = ?
    `;
    const [result] = await db.execute(query, [active ? 1 : 0, id]);
    return result;
};

module.exports = {
    createAlertsTable,
    createAlert,
    getAllAlerts,
    getActiveAlerts,
    getAlertById,
    updateAlert,
    deleteAlert,
    toggleAlertActive
};

const db = require('../config/db.js');

const createModelGroupsTable = async () => {
    const query = `
        CREATE TABLE IF NOT EXISTS model_group_master (
            id INT AUTO_INCREMENT PRIMARY KEY,
            brand_name VARCHAR(150) NOT NULL,
            model_group_name VARCHAR(255) NOT NULL,
            added_by INT NULL,
            device_id VARCHAR(255),
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_brand_group (brand_name, model_group_name),
            FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE SET NULL
        )
    `;
    await db.execute(query);
    console.log("Model Group master table ready");
};

const upsertModelGroups = async (groups, addedBy, deviceId) => {
    if (!groups || groups.length === 0) return;

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        for (const g of groups) {
            const query = `
                INSERT INTO model_group_master (
                    brand_name, model_group_name, added_by, device_id
                ) VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    added_by = VALUES(added_by),
                    device_id = VALUES(device_id)
            `;
            
            await connection.execute(query, [
                g.brand_name,
                g.model_group_name,
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

const getAllModelGroups = async () => {
    const query = `
        SELECT
            mgm.id,
            mgm.brand_name,
            mgm.model_group_name,
            mgm.device_id,
            mgm.timestamp,
            COALESCE(u.name, 'System') AS added_by_name
        FROM model_group_master mgm
        LEFT JOIN users u ON mgm.added_by = u.id
        ORDER BY mgm.timestamp DESC
    `;
    const [results] = await db.execute(query);
    return results;
};

const deleteModelGroup = async (id) => {
    const query = `DELETE FROM model_group_master WHERE id = ?`;
    const [result] = await db.execute(query, [id]);
    return result;
};

const getModelGroupById = async (id) => {
    const query = `
        SELECT *
        FROM model_group_master 
        WHERE id = ?
    `;
    const [rows] = await db.execute(query, [id]);
    return rows[0] || null;
};

module.exports = {
    createModelGroupsTable,
    upsertModelGroups,
    getAllModelGroups,
    deleteModelGroup,
    getModelGroupById
};

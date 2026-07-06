const db = require('../config/db.js');

const createItemModelsTable = async () => {
    const query = `
        CREATE TABLE IF NOT EXISTS item_model_master (
            id INT AUTO_INCREMENT PRIMARY KEY,
            item_code VARCHAR(100) NOT NULL UNIQUE,
            brand_name VARCHAR(150),
            model_name VARCHAR(255),
            model_group_name VARCHAR(255),
            created_on INT,
            product_name VARCHAR(150),
            icat_name VARCHAR(150),
            prod_catg_name VARCHAR(150),
            uqc VARCHAR(50),
            serialno_status VARCHAR(50),
            item_status VARCHAR(50),
            added_by INT NULL,
            device_id VARCHAR(255),
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE SET NULL
        )
    `;
    await db.execute(query);
    console.log("Item Model master table ready");
};

const upsertItemModels = async (models, addedBy, deviceId) => {
    if (!models || models.length === 0) return;

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        for (const m of models) {
            const query = `
                INSERT INTO item_model_master (
                    item_code, brand_name, model_name, model_group_name, 
                    created_on, product_name, icat_name, prod_catg_name, 
                    uqc, serialno_status, item_status, added_by, device_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    brand_name = VALUES(brand_name),
                    model_name = VALUES(model_name),
                    model_group_name = VALUES(model_group_name),
                    created_on = VALUES(created_on),
                    product_name = VALUES(product_name),
                    icat_name = VALUES(icat_name),
                    prod_catg_name = VALUES(prod_catg_name),
                    uqc = VALUES(uqc),
                    serialno_status = VALUES(serialno_status),
                    item_status = VALUES(item_status),
                    added_by = VALUES(added_by),
                    device_id = VALUES(device_id)
            `;
            
            await connection.execute(query, [
                m.item_code,
                m.brand_name || null,
                m.model_name || null,
                m.model_group_name || null,
                m.created_on || null,
                m.product_name || null,
                m.icat_name || null,
                m.prod_catg_name || null,
                m.uqc || null,
                m.serialno_status || null,
                m.item_status || null,
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

const getAllItemModels = async () => {
    const query = `
        SELECT
            imm.id,
            imm.item_code,
            imm.brand_name,
            imm.model_name,
            imm.model_group_name,
            imm.created_on,
            imm.product_name,
            imm.icat_name,
            imm.prod_catg_name,
            imm.uqc,
            imm.serialno_status,
            imm.item_status,
            imm.device_id,
            imm.timestamp,
            COALESCE(u.name, 'System') AS added_by_name
        FROM item_model_master imm
        LEFT JOIN users u ON imm.added_by = u.id
        ORDER BY imm.timestamp DESC
    `;
    const [results] = await db.execute(query);
    return results;
};

const deleteItemModel = async (id) => {
    const query = `DELETE FROM item_model_master WHERE id = ?`;
    const [result] = await db.execute(query, [id]);
    return result;
};

const getItemModelById = async (id) => {
    const query = `
        SELECT *
        FROM item_model_master 
        WHERE id = ?
    `;
    const [rows] = await db.execute(query, [id]);
    return rows[0] || null;
};

module.exports = {
    createItemModelsTable,
    upsertItemModels,
    getAllItemModels,
    deleteItemModel,
    getItemModelById
};

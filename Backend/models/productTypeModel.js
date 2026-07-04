const db = require('../config/db.js');

const createProductTypeTable = async () => {
    const query = `
        CREATE TABLE IF NOT EXISTS product_type_master (
            id INT AUTO_INCREMENT PRIMARY KEY,
            product_type_name VARCHAR(150) NOT NULL UNIQUE,
            added_by INT NOT NULL,
            device_id VARCHAR(255),
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE CASCADE
        )
    `;
    await db.execute(query);
    console.log("Product Type master table ready");
};

const createProductType = async (productTypeName, addedBy, deviceId) => {
    const query = `INSERT INTO product_type_master (product_type_name, added_by, device_id) VALUES (?, ?, ?)`;
    const [result] = await db.execute(query, [productTypeName, addedBy, deviceId]);
    return result;
};

const getAllProductTypes = async () => {
    const query = `
        SELECT
            ptm.id,
            ptm.product_type_name,
            COALESCE(u.name, 'Unknown') AS added_by_name,
            ptm.device_id,
            ptm.timestamp
        FROM product_type_master ptm
        LEFT JOIN users u ON ptm.added_by = u.id
        ORDER BY ptm.timestamp DESC
    `;
    const [results] = await db.execute(query);
    return results;
};

const updateProductType = async (id, productTypeName) => {
    const query = `UPDATE product_type_master SET product_type_name = ? WHERE id = ?`;
    const [result] = await db.execute(query, [productTypeName, id]);
    return result;
};

const deleteProductType = async (id) => {
    const query = `DELETE FROM product_type_master WHERE id = ?`;
    const [result] = await db.execute(query, [id]);
    return result;
};

const getProductTypeById = async (id) => {
    const query = `
        SELECT id, product_type_name, added_by, device_id, timestamp 
        FROM product_type_master 
        WHERE id = ?
    `;
    const [rows] = await db.execute(query, [id]);
    return rows[0] || null;
};

module.exports = {
    createProductTypeTable,
    createProductType,
    getAllProductTypes,
    updateProductType,
    deleteProductType,
    getProductTypeById
};

const db = require('../config/db.js');

const createStockCacheTable = async () => {
    const query = `
        CREATE TABLE IF NOT EXISTS apx_stock_cache (
            id INT AUTO_INCREMENT PRIMARY KEY,
            model_group_name VARCHAR(255) NOT NULL UNIQUE,
            stock_json LONGTEXT NOT NULL,
            total_locations INT DEFAULT 0,
            total_stock INT DEFAULT 0,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_model_group (model_group_name)
        )
    `;
    try {
        await db.execute(query);
        console.log("✅ APX Stock Cache table ready");
    } catch (e) {
        console.error("Error creating apx_stock_cache table:", e.message);
    }
};

const getStockCacheByModelGroup = async (modelGroup) => {
    const query = `
        SELECT stock_json, total_locations, total_stock, updated_at 
        FROM apx_stock_cache 
        WHERE LOWER(TRIM(model_group_name)) = LOWER(TRIM(?))
        LIMIT 1
    `;
    const [rows] = await db.execute(query, [modelGroup]);
    if (rows.length > 0) {
        try {
            const data = JSON.parse(rows[0].stock_json);
            return {
                data,
                totalLocations: rows[0].total_locations,
                totalStock: rows[0].total_stock,
                updatedAt: rows[0].updated_at
            };
        } catch (e) {
            console.error("Error parsing stock_json from cache:", e);
            return null;
        }
    }
    return null;
};

const saveStockCache = async (modelGroup, stockItems, totalLocations, totalStock) => {
    const query = `
        INSERT INTO apx_stock_cache (model_group_name, stock_json, total_locations, total_stock, updated_at)
        VALUES (?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE 
            stock_json = VALUES(stock_json),
            total_locations = VALUES(total_locations),
            total_stock = VALUES(total_stock),
            updated_at = NOW()
    `;
    const stockJson = JSON.stringify(stockItems);
    await db.execute(query, [modelGroup.trim(), stockJson, totalLocations, totalStock]);
};

module.exports = {
    createStockCacheTable,
    getStockCacheByModelGroup,
    saveStockCache
};

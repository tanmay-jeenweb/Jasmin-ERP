const db = require('../config/db.js');

const createTargetVsAchievementsTable = async () => {
    const query = `
        CREATE TABLE IF NOT EXISTS target_vs_achievements (
            id INT AUTO_INCREMENT PRIMARY KEY,
            branch_name VARCHAR(255) NULL,
            updated_abm_name VARCHAR(255) NULL,
            qty_tgt INT NULL,
            value_tgt DECIMAL(15, 2) NULL,
            ftd_qty_ach INT NULL,
            ftd_value_ach DECIMAL(15, 2) NULL,
            lmftd_qty_ach INT NULL,
            lmftd_value_ach DECIMAL(15, 2) NULL,
            mtd_qty_ach INT NULL,
            mtd_value_ach DECIMAL(15, 2) NULL,
            mtd_qty_percentage_ach DECIMAL(10, 2) NULL,
            mtd_value_percentage_ach DECIMAL(10, 2) NULL,
            lmtd_qty_ach INT NULL,
            lmtd_value_ach DECIMAL(15, 2) NULL,
            btd_qty INT NULL,
            btd_value DECIMAL(15, 2) NULL,
            ddr_qty INT NULL,
            ddr_value DECIMAL(15, 2) NULL,
            growth_qty_percentage DECIMAL(10, 2) NULL,
            growth_value_percentage DECIMAL(10, 2) NULL,
            added_by INT NULL,
            device_id VARCHAR(255) NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE SET NULL
        )
    `;
    await db.execute(query);
    console.log("Target vs Achievements table ready");
};

const getAllTargetVsAchievements = async () => {
    const query = `
        SELECT 
            t.*,
            COALESCE(u.name, 'Unknown') AS added_by_name
        FROM target_vs_achievements t
        LEFT JOIN users u ON t.added_by = u.id
        ORDER BY t.timestamp DESC
    `;
    const [results] = await db.execute(query);
    return results;
};

module.exports = {
    createTargetVsAchievementsTable,
    getAllTargetVsAchievements
};

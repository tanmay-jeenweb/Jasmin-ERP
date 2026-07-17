const db = require('../config/db.js');

const createTargetVsAchievementsTable = async () => {
    // Create synced_invoice_items table if it doesn't exist
    const createInvoicesQuery = `
        CREATE TABLE IF NOT EXISTS synced_invoice_items (
            id INT AUTO_INCREMENT PRIMARY KEY,
            invoice_no VARCHAR(100) NOT NULL,
            invoice_date DATE NOT NULL,
            branch_code VARCHAR(50) NOT NULL,
            branch_name VARCHAR(255) NOT NULL,
            item_code VARCHAR(100) NOT NULL,
            item_description VARCHAR(255) NULL,
            qty DECIMAL(15, 2) NOT NULL,
            net_amount DECIMAL(15, 2) NOT NULL,
            product_type VARCHAR(100) NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_invoice_date (invoice_date),
            INDEX idx_invoice_no (invoice_no)
        )
    `;
    await db.execute(createInvoicesQuery);
    console.log("Synced Invoice Items table ready");

    // Create synced_sales_return_items table if it doesn't exist
    const createReturnsQuery = `
        CREATE TABLE IF NOT EXISTS synced_sales_return_items (
            id INT AUTO_INCREMENT PRIMARY KEY,
            sales_return_no VARCHAR(100) NOT NULL,
            sales_return_date DATE NOT NULL,
            branch_code VARCHAR(50) NOT NULL,
            branch_name VARCHAR(255) NOT NULL,
            item_code VARCHAR(100) NOT NULL,
            item_description VARCHAR(255) NULL,
            qty DECIMAL(15, 2) NOT NULL,
            net_amount DECIMAL(15, 2) NOT NULL,
            product_type VARCHAR(100) NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_sales_return_date (sales_return_date),
            INDEX idx_sales_return_no (sales_return_no)
        )
    `;
    await db.execute(createReturnsQuery);
    console.log("Synced Sales Return Items table ready");

    const query = `
        CREATE TABLE IF NOT EXISTS target_vs_achievements (
            id INT AUTO_INCREMENT PRIMARY KEY,
            branch_name VARCHAR(255) NULL UNIQUE,
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
            ddr_qty DECIMAL(15, 2) NULL,
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

    // Add UNIQUE constraint index to existing table if not present
    try {
        await db.execute(`ALTER TABLE target_vs_achievements ADD UNIQUE INDEX uq_branch_name (branch_name)`);
        console.log("Added unique constraint on branch_name for target_vs_achievements");
    } catch (err) {
        if (err.code !== 'ER_DUP_KEYNAME') {
            console.error("Error altering target_vs_achievements table:", err);
        }
    }

    // Modify ddr_qty column to DECIMAL to support fractional quantities
    try {
        await db.execute(`ALTER TABLE target_vs_achievements MODIFY COLUMN ddr_qty DECIMAL(15, 2) NULL`);
        console.log("Altered target_vs_achievements: changed ddr_qty to DECIMAL(15, 2)");
    } catch (err) {
        console.error("Error modifying ddr_qty column in target_vs_achievements:", err);
    }
};

const getAllTargetVsAchievements = async () => {
    const query = `
        SELECT 
            t.*,
            COALESCE(u.name, 'Unknown') AS added_by_name,
            COALESCE(abm_u.name, bm.abm, t.updated_abm_name, '—') AS abm_name,
            bm.id AS branch_id
        FROM target_vs_achievements t
        LEFT JOIN branch_master bm ON t.branch_name = bm.name
        LEFT JOIN abm_branch_mappings abm_m ON bm.id = abm_m.branch_id
        LEFT JOIN users abm_u ON abm_m.abm_user_id = abm_u.id
        LEFT JOIN users u ON t.added_by = u.id
        ORDER BY 
            (t.qty_tgt IS NULL OR t.value_tgt IS NULL) ASC,
            t.timestamp DESC
    `;
    const [results] = await db.execute(query);
    return results;
};

const upsertTargetVsAchievements = async (records, addedBy, deviceId, remainingDays) => {
    if (!records || records.length === 0) return;

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const query = `
            INSERT INTO target_vs_achievements (
                branch_name, updated_abm_name, qty_tgt, value_tgt, added_by, device_id
            ) VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                updated_abm_name = VALUES(updated_abm_name),
                qty_tgt = VALUES(qty_tgt),
                value_tgt = VALUES(value_tgt),
                added_by = VALUES(added_by),
                device_id = VALUES(device_id)
        `;

        for (const r of records) {
            await connection.execute(query, [
                r.branch_name,
                r.updated_abm_name || null,
                r.qty_tgt !== undefined && r.qty_tgt !== null && r.qty_tgt !== "" ? parseInt(r.qty_tgt, 10) : null,
                r.value_tgt !== undefined && r.value_tgt !== null && r.value_tgt !== "" ? parseFloat(r.value_tgt) : null,
                addedBy,
                deviceId
            ]);
        }

        // Recalculate calculated columns for the updated/inserted records
        const remDays = remainingDays > 0 ? remainingDays : 1;
        const updateQuery = `
            UPDATE target_vs_achievements
            SET 
                btd_qty = COALESCE(qty_tgt, 0) - COALESCE(mtd_qty_ach, 0),
                btd_value = COALESCE(value_tgt, 0.00) - COALESCE(mtd_value_ach, 0.00),
                ddr_qty = (COALESCE(qty_tgt, 0) - COALESCE(mtd_qty_ach, 0)) / ?,
                ddr_value = (COALESCE(value_tgt, 0.00) - COALESCE(mtd_value_ach, 0.00)) / ?,
                growth_qty_percentage = CASE 
                    WHEN COALESCE(mtd_qty_ach, 0) != 0 THEN ((COALESCE(mtd_qty_ach, 0) - COALESCE(lmtd_qty_ach, 0)) / COALESCE(mtd_qty_ach, 0)) * 100
                    ELSE 0.00
                END,
                growth_value_percentage = CASE 
                    WHEN COALESCE(mtd_value_ach, 0.00) != 0.00 THEN ((COALESCE(mtd_value_ach, 0.00) - COALESCE(lmtd_value_ach, 0.00)) / COALESCE(mtd_value_ach, 0.00)) * 100
                    ELSE 0.00
                END
            WHERE branch_name = ?
        `;

        for (const r of records) {
            await connection.execute(updateQuery, [remDays, remDays, r.branch_name]);
        }

        await connection.commit();
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

const upsertAchievements = async (records, addedBy, deviceId) => {
    if (!records || records.length === 0) return;

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const query = `
            INSERT INTO target_vs_achievements (
                branch_name, 
                ftd_qty_ach, ftd_value_ach, 
                lmftd_qty_ach, lmftd_value_ach, 
                mtd_qty_ach, mtd_value_ach, 
                mtd_qty_percentage_ach, mtd_value_percentage_ach, 
                lmtd_qty_ach, lmtd_value_ach,
                btd_qty, btd_value,
                ddr_qty, ddr_value,
                growth_qty_percentage, growth_value_percentage,
                added_by, device_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                ftd_qty_ach = VALUES(ftd_qty_ach),
                ftd_value_ach = VALUES(ftd_value_ach),
                lmftd_qty_ach = VALUES(lmftd_qty_ach),
                lmftd_value_ach = VALUES(lmftd_value_ach),
                mtd_qty_ach = VALUES(mtd_qty_ach),
                mtd_value_ach = VALUES(mtd_value_ach),
                mtd_qty_percentage_ach = VALUES(mtd_qty_percentage_ach),
                mtd_value_percentage_ach = VALUES(mtd_value_percentage_ach),
                lmtd_qty_ach = VALUES(lmtd_qty_ach),
                lmtd_value_ach = VALUES(lmtd_value_ach),
                btd_qty = VALUES(btd_qty),
                btd_value = VALUES(btd_value),
                ddr_qty = VALUES(ddr_qty),
                ddr_value = VALUES(ddr_value),
                growth_qty_percentage = VALUES(growth_qty_percentage),
                growth_value_percentage = VALUES(growth_value_percentage),
                added_by = VALUES(added_by),
                device_id = VALUES(device_id)
        `;

        for (const r of records) {
            await connection.execute(query, [
                r.branch_name,
                r.ftd_qty_ach || 0,
                r.ftd_value_ach || 0.00,
                r.lmftd_qty_ach || 0,
                r.lmftd_value_ach || 0.00,
                r.mtd_qty_ach || 0,
                r.mtd_value_ach || 0.00,
                r.mtd_qty_percentage_ach || 0.00,
                r.mtd_value_percentage_ach || 0.00,
                r.lmtd_qty_ach || 0,
                r.lmtd_value_ach || 0.00,
                r.btd_qty || 0,
                r.btd_value || 0.00,
                r.ddr_qty || 0,
                r.ddr_value || 0.00,
                r.growth_qty_percentage || 0.00,
                r.growth_value_percentage || 0.00,
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

module.exports = {
    createTargetVsAchievementsTable,
    getAllTargetVsAchievements,
    upsertTargetVsAchievements,
    upsertAchievements
};

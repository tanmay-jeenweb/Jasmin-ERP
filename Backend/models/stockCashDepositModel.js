const db = require('../config/db.js');

const createStockCashDepositTable = async () => {
    const query = `
        CREATE TABLE IF NOT EXISTS branch_stock_cash_deposits (
            id INT AUTO_INCREMENT PRIMARY KEY,
            branch_id INT NOT NULL UNIQUE,
            stock_deposit DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
            support DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
            paid_support DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
            current_stock DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
            opening_cash_deposit_pending DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
            cash_deposit DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
            credit_debit DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (branch_id) REFERENCES branch_master(id) ON DELETE CASCADE
        )
    `;
    await db.execute(query);
    console.log("Branch stock cash deposits table ready");
};

const getStockCashDepositReportData = async () => {
    const query = `
        SELECT 
            bm.id,
            bm.name AS branch_name,
            COALESCE(sm.name, '—') AS state_name,
            COALESCE(bm.city, '—') AS city,
            COALESCE(abm_u.name, bm.abm, '—') AS abm_name,
            bm.store_type,
            bm.status,
            COALESCE(sc.stock_deposit, 0.00) AS stock_deposit,
            COALESCE(sc.support, 0.00) AS support,
            COALESCE(sc.paid_support, 0.00) AS paid_support,
            (COALESCE(sc.stock_deposit, 0.00) + COALESCE(sc.support, 0.00) + COALESCE(sc.paid_support, 0.00)) AS total_stock_invest,
            COALESCE(sc.current_stock, 0.00) AS current_stock,
            COALESCE(sc.opening_cash_deposit_pending, 0.00) AS opening_cash_deposit_pending,
            COALESCE(sc.cash_deposit, 0.00) AS cash_deposit,
            (COALESCE(sc.opening_cash_deposit_pending, 0.00) - COALESCE(sc.cash_deposit, 0.00)) AS pending_cash_deposit,
            COALESCE(sc.credit_debit, 0.00) AS credit_debit,
            ((COALESCE(sc.stock_deposit, 0.00) + COALESCE(sc.support, 0.00) + COALESCE(sc.paid_support, 0.00)) 
             - COALESCE(sc.current_stock, 0.00) 
             + (COALESCE(sc.opening_cash_deposit_pending, 0.00) - COALESCE(sc.cash_deposit, 0.00))) AS available_limit
        FROM branch_master bm
        LEFT JOIN state_master sm ON bm.state_id = sm.id
        LEFT JOIN branch_stock_cash_deposits sc ON bm.id = sc.branch_id
        LEFT JOIN user_branch_mappings abm_m ON bm.id = abm_m.branch_id AND abm_m.user_id IN (
            SELECT u.id FROM users u
            JOIN user_types ut ON u.user_type_id = ut.id
            WHERE ut.user_role = 'ABM' OR ut.type_name = 'ABM'
        )
        LEFT JOIN users abm_u ON abm_m.user_id = abm_u.id
        ORDER BY bm.name ASC
    `;
    const [results] = await db.execute(query);
    return results;
};

const importStockCashDepositData = async (records) => {
    if (!records || records.length === 0) return;
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const query = `
            INSERT INTO branch_stock_cash_deposits (
                branch_id, stock_deposit, support, paid_support
            ) VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                stock_deposit = VALUES(stock_deposit),
                support = VALUES(support),
                paid_support = VALUES(paid_support)
        `;
        for (const record of records) {
            await connection.execute(query, [
                record.branch_id,
                record.stock_deposit || 0.00,
                record.support || 0.00,
                record.paid_support || 0.00
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

const importCurrentStockData = async (records) => {
    if (!records || records.length === 0) return;
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const query = `
            INSERT INTO branch_stock_cash_deposits (
                branch_id, current_stock
            ) VALUES (?, ?)
            ON DUPLICATE KEY UPDATE
                current_stock = VALUES(current_stock)
        `;
        for (const record of records) {
            await connection.execute(query, [
                record.branch_id,
                record.current_stock || 0.00
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

const importOpeningCashAndCreditData = async (records) => {
    if (!records || records.length === 0) return;
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const query = `
            INSERT INTO branch_stock_cash_deposits (
                branch_id, opening_cash_deposit_pending, credit_debit
            ) VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE
                opening_cash_deposit_pending = VALUES(opening_cash_deposit_pending),
                credit_debit = VALUES(credit_debit)
        `;
        for (const record of records) {
            await connection.execute(query, [
                record.branch_id,
                record.opening_cash_deposit_pending || 0.00,
                record.credit_debit || 0.00
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

const importCashDepositData = async (records) => {
    if (!records || records.length === 0) return;
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const query = `
            INSERT INTO branch_stock_cash_deposits (
                branch_id, cash_deposit
            ) VALUES (?, ?)
            ON DUPLICATE KEY UPDATE
                cash_deposit = VALUES(cash_deposit)
        `;
        for (const record of records) {
            await connection.execute(query, [
                record.branch_id,
                record.cash_deposit || 0.00
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
    createStockCashDepositTable,
    getStockCashDepositReportData,
    importStockCashDepositData,
    importCurrentStockData,
    importOpeningCashAndCreditData,
    importCashDepositData
};

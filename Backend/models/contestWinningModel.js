const db = require('../config/db.js');

const createContestWinningsTable = async () => {
    // 1. Create contest_winnings_master table
    const createMasterQuery = `
        CREATE TABLE IF NOT EXISTS contest_winnings_master (
            id INT AUTO_INCREMENT PRIMARY KEY,
            external_id INT UNIQUE NOT NULL,
            form_id INT NULL,
            form_name VARCHAR(255) NULL,
            brand_id INT NULL,
            brand_name VARCHAR(100) NULL,
            branch_id INT NULL,
            branch_code VARCHAR(50) NULL,
            branch_name VARCHAR(255) NULL,
            branch_city VARCHAR(100) NULL,
            branch_state VARCHAR(100) NULL,
            branch_phone VARCHAR(50) NULL,
            customer_name VARCHAR(255) NULL,
            customer_phone VARCHAR(20) NULL,
            birthdate DATE NULL,
            invoice_number VARCHAR(100) NULL,
            product_id INT NULL,
            product_name VARCHAR(255) NULL,
            product_image VARCHAR(500) NULL,
            status VARCHAR(50) DEFAULT 'claimed',
            field_data JSON NULL,
            scratch_created_at DATETIME NOT NULL,
            synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_invoice_number (invoice_number),
            INDEX idx_customer_phone (customer_phone),
            INDEX idx_scratch_created_at (scratch_created_at),
            INDEX idx_branch_code (branch_code),
            INDEX idx_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    await db.execute(createMasterQuery);

    // 2. Create contest_sync_logs table
    const createLogsQuery = `
        CREATE TABLE IF NOT EXISTS contest_sync_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            synced_by INT NULL,
            device_id VARCHAR(255) NULL,
            records_fetched INT DEFAULT 0,
            records_inserted INT DEFAULT 0,
            records_updated INT DEFAULT 0,
            sync_status ENUM('SUCCESS', 'FAILED') DEFAULT 'SUCCESS',
            error_message TEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    await db.execute(createLogsQuery);
    console.log("Contest Winnings tables ready");
};

const upsertContestWinnings = async (winnings) => {
    if (!winnings || winnings.length === 0) {
        return { inserted: 0, updated: 0, total: 0 };
    }

    let inserted = 0;

    const query = `
        INSERT INTO contest_winnings_master (
            external_id, form_id, form_name, brand_id, brand_name,
            branch_id, branch_code, branch_name, branch_city, branch_state, branch_phone,
            customer_name, customer_phone, birthdate, invoice_number,
            product_id, product_name, product_image, status, field_data, scratch_created_at
        ) VALUES ?
        ON DUPLICATE KEY UPDATE
            form_id = VALUES(form_id),
            form_name = VALUES(form_name),
            brand_id = VALUES(brand_id),
            brand_name = VALUES(brand_name),
            branch_id = VALUES(branch_id),
            branch_code = VALUES(branch_code),
            branch_name = VALUES(branch_name),
            branch_city = VALUES(branch_city),
            branch_state = VALUES(branch_state),
            branch_phone = VALUES(branch_phone),
            customer_name = VALUES(customer_name),
            customer_phone = VALUES(customer_phone),
            birthdate = VALUES(birthdate),
            invoice_number = VALUES(invoice_number),
            product_id = VALUES(product_id),
            product_name = VALUES(product_name),
            product_image = VALUES(product_image),
            status = VALUES(status),
            field_data = VALUES(field_data),
            scratch_created_at = VALUES(scratch_created_at),
            synced_at = CURRENT_TIMESTAMP
    `;

    // Process in batches of 200
    const chunkSize = 200;
    for (let i = 0; i < winnings.length; i += chunkSize) {
        const chunk = winnings.slice(i, i + chunkSize);
        const values = chunk.map(w => {
            let birthdateVal = null;
            if (w.birthdate && w.birthdate !== '0000-00-00') {
                const bDate = new Date(w.birthdate);
                if (!isNaN(bDate.getTime())) {
                    birthdateVal = w.birthdate.substring(0, 10);
                }
            }

            let scratchDateVal = new Date();
            if (w.created_at) {
                const sDate = new Date(w.created_at);
                if (!isNaN(sDate.getTime())) {
                    // Add 5 hours and 30 minutes (5.5 hours = 19,800,000 ms) to adjust external API time to Indian Standard Time (IST)
                    const istDate = new Date(sDate.getTime() + (5.5 * 60 * 60 * 1000));
                    scratchDateVal = istDate.toISOString().slice(0, 19).replace('T', ' ');
                }
            }

            return [
                w.id,
                w.form_id || null,
                w.form_name || null,
                w.brand_id || null,
                w.brand_name || null,
                w.branch_id || null,
                w.branch_code || null,
                w.branch_name || null,
                w.branch_city || null,
                w.branch_state || null,
                w.branch_phone || null,
                w.customer_name ? w.customer_name.trim() : null,
                w.customer_phone ? String(w.customer_phone).trim() : null,
                birthdateVal,
                w.invoice_number ? w.invoice_number.trim() : null,
                w.product_id || null,
                w.product_name || null,
                w.product_image || null,
                w.status || 'claimed',
                w.field_data ? JSON.stringify(w.field_data) : null,
                scratchDateVal
            ];
        });

        const [result] = await db.query(query, [values]);
        inserted += result.affectedRows;
    }

    return { total: winnings.length, affectedRows: inserted };
};

const getAllContestWinnings = async ({
    search = '',
    branch_code = '',
    status = '',
    from_date = '',
    to_date = '',
    page = 1,
    limit = 50,
    exportAll = false
}) => {
    let whereConditions = ['1=1'];
    const params = [];

    if (search && search.trim()) {
        const s = `%${search.trim()}%`;
        whereConditions.push('(customer_name LIKE ? OR customer_phone LIKE ? OR invoice_number LIKE ? OR product_name LIKE ? OR branch_name LIKE ?)');
        params.push(s, s, s, s, s);
    }

    if (branch_code && branch_code.trim()) {
        whereConditions.push('branch_code = ?');
        params.push(branch_code.trim());
    }

    if (status && status.trim() && status.toLowerCase() !== 'all') {
        whereConditions.push('status = ?');
        params.push(status.trim());
    }

    if (from_date) {
        whereConditions.push('DATE(scratch_created_at) >= ?');
        params.push(from_date);
    }

    if (to_date) {
        whereConditions.push('DATE(scratch_created_at) <= ?');
        params.push(to_date);
    }

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const [countRows] = await db.execute(
        `SELECT COUNT(*) as total FROM contest_winnings_master WHERE ${whereClause}`,
        params
    );
    const totalRecords = countRows[0]?.total || 0;

    // Get summary statistics
    const [statsRows] = await db.execute(
        `SELECT 
            COUNT(*) as total_winnings,
            COUNT(DISTINCT branch_code) as unique_branches,
            COUNT(DISTINCT invoice_number) as unique_invoices,
            COUNT(DISTINCT customer_phone) as unique_customers,
            SUM(CASE WHEN status = 'claimed' THEN 1 ELSE 0 END) as claimed_count
         FROM contest_winnings_master 
         WHERE ${whereClause}`,
        params
    );

    let query = `
        SELECT 
            id, external_id, form_id, form_name, brand_id, brand_name,
            branch_id, branch_code, branch_name, branch_city, branch_state, branch_phone,
            customer_name, customer_phone, birthdate, invoice_number,
            product_id, product_name, product_image, status, field_data,
            scratch_created_at, synced_at
        FROM contest_winnings_master
        WHERE ${whereClause}
        ORDER BY scratch_created_at DESC
    `;

    if (!exportAll) {
        const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
        query += ` LIMIT ${parseInt(limit)} OFFSET ${offset}`;
    }

    const [records] = await db.execute(query, params);

    return {
        records,
        total: totalRecords,
        stats: statsRows[0] || {},
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: exportAll ? 1 : Math.ceil(totalRecords / parseInt(limit))
    };
};

const getContestWinningsForReconciliation = async (startDateStr, endDateStr, branchCodes = null) => {
    let whereConditions = ['1=1'];
    const params = [];

    if (startDateStr) {
        whereConditions.push('DATE(scratch_created_at) >= ?');
        params.push(startDateStr);
    }

    if (endDateStr) {
        whereConditions.push('DATE(scratch_created_at) <= ?');
        params.push(endDateStr);
    }

    if (branchCodes) {
        const list = Array.isArray(branchCodes) ? branchCodes : String(branchCodes).split(',').map(s => s.trim()).filter(Boolean);
        if (list.length === 1) {
            whereConditions.push('branch_code = ?');
            params.push(list[0]);
        } else if (list.length > 1) {
            const placeholders = list.map(() => '?').join(',');
            whereConditions.push(`branch_code IN (${placeholders})`);
            params.push(...list);
        }
    }

    const whereClause = whereConditions.join(' AND ');

    const [rows] = await db.execute(
        `SELECT 
            id, external_id, form_id, form_name, brand_id, brand_name,
            branch_id, branch_code, branch_name, branch_city, branch_state, branch_phone,
            customer_name, customer_phone, birthdate, invoice_number,
            product_id, product_name, product_image, status, field_data,
            scratch_created_at, synced_at
         FROM contest_winnings_master
         WHERE ${whereClause}
         ORDER BY scratch_created_at ASC`,
        params
    );

    return rows;
};

const recordSyncLog = async ({
    syncedBy = null,
    deviceId = 'Web',
    recordsFetched = 0,
    recordsInserted = 0,
    recordsUpdated = 0,
    syncStatus = 'SUCCESS',
    errorMessage = null
}) => {
    const [result] = await db.execute(
        `INSERT INTO contest_sync_logs 
            (synced_by, device_id, records_fetched, records_inserted, records_updated, sync_status, error_message)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [syncedBy, deviceId, recordsFetched, recordsInserted, recordsUpdated, syncStatus, errorMessage]
    );
    return result.insertId;
};

const getLastSyncLog = async () => {
    const [rows] = await db.execute(
        `SELECT l.*, u.name as synced_by_name 
         FROM contest_sync_logs l
         LEFT JOIN users u ON l.synced_by = u.id
         ORDER BY l.created_at DESC
         LIMIT 1`
    );
    return rows[0] || null;
};

module.exports = {
    createContestWinningsTable,
    upsertContestWinnings,
    getAllContestWinnings,
    getContestWinningsForReconciliation,
    recordSyncLog,
    getLastSyncLog
};

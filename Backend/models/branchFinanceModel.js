const db = require('../config/db.js');

const createBranchFinanceCodeTables = async () => {
    // 1. Brands finance codes table
    const brandsQuery = `
        CREATE TABLE IF NOT EXISTS branch_finance_brands (
            id INT AUTO_INCREMENT PRIMARY KEY,
            branch_id INT NOT NULL,
            brand_id INT NOT NULL,
            brand_code VARCHAR(255) DEFAULT '',
            submitted_by INT NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (branch_id) REFERENCES branch_master(id) ON DELETE CASCADE,
            FOREIGN KEY (brand_id) REFERENCES mobile_brand_master(id) ON DELETE CASCADE,
            FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE KEY (branch_id, brand_id)
        )
    `;
    await db.execute(brandsQuery);

    // 2. Machines finance codes table
    const machinesQuery = `
        CREATE TABLE IF NOT EXISTS branch_finance_machines (
            id INT AUTO_INCREMENT PRIMARY KEY,
            branch_id INT NOT NULL,
            machine_id INT NOT NULL,
            tid VARCHAR(255) DEFAULT '',
            pos_id VARCHAR(255) DEFAULT '',
            serial_no VARCHAR(255) DEFAULT '',
            submitted_by INT NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (branch_id) REFERENCES branch_master(id) ON DELETE CASCADE,
            FOREIGN KEY (machine_id) REFERENCES finance_machine_master(id) ON DELETE CASCADE,
            FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE KEY (branch_id, machine_id)
        )
    `;
    await db.execute(machinesQuery);

    // 3. Companies finance codes table
    const companiesQuery = `
        CREATE TABLE IF NOT EXISTS branch_finance_companies (
            id INT AUTO_INCREMENT PRIMARY KEY,
            branch_id INT NOT NULL,
            company_id INT NOT NULL,
            company_code VARCHAR(255) DEFAULT '',
            submitted_by INT NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (branch_id) REFERENCES branch_master(id) ON DELETE CASCADE,
            FOREIGN KEY (company_id) REFERENCES bank_master(id) ON DELETE CASCADE,
            FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE KEY (branch_id, company_id)
        )
    `;
    await db.execute(companiesQuery);

    // 4. Details (QR Code ID & Password, Remarks) table
    const detailsQuery = `
        CREATE TABLE IF NOT EXISTS branch_finance_details (
            branch_id INT PRIMARY KEY,
            qr_code_id_password VARCHAR(255) DEFAULT '',
            remarks TEXT DEFAULT NULL,
            submitted_by INT NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (branch_id) REFERENCES branch_master(id) ON DELETE CASCADE,
            FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE CASCADE
        )
    `;
    await db.execute(detailsQuery);

    console.log("Branch Finance Code tables initialized successfully");
};

const getBranchFinanceCodesByBranchId = async (branchId) => {
    // 1. Fetch brands
    const brandsQuery = `
        SELECT 
            mbm.id AS brand_id,
            mbm.mobile_brand AS brand_name,
            COALESCE(bfb.brand_code, '') AS brand_code
        FROM mobile_brand_master mbm
        LEFT JOIN branch_finance_brands bfb 
            ON mbm.id = bfb.brand_id AND bfb.branch_id = ?
        ORDER BY mbm.mobile_brand ASC
    `;
    const [brands] = await db.execute(brandsQuery, [branchId]);

    // 2. Fetch machines
    const machinesQuery = `
        SELECT 
            fmm.id AS machine_id,
            fmm.machine_name AS machine_name,
            COALESCE(bfm.tid, '') AS tid,
            COALESCE(bfm.pos_id, '') AS pos_id,
            COALESCE(bfm.serial_no, '') AS serial_no
        FROM finance_machine_master fmm
        LEFT JOIN branch_finance_machines bfm 
            ON fmm.id = bfm.machine_id AND bfm.branch_id = ?
        ORDER BY fmm.machine_name ASC
    `;
    const [machines] = await db.execute(machinesQuery, [branchId]);

    // 3. Fetch companies
    const companiesQuery = `
        SELECT 
            bm.id AS company_id,
            bm.bank_card_name AS company_name,
            COALESCE(bfc.company_code, '') AS company_code
        FROM bank_master bm
        LEFT JOIN branch_finance_companies bfc 
            ON bm.id = bfc.company_id AND bfc.branch_id = ?
        ORDER BY bm.bank_card_name ASC
    `;
    const [companies] = await db.execute(companiesQuery, [branchId]);

    // 4. Fetch details (QR Credentials & Remarks)
    const detailsQuery = `
        SELECT 
            COALESCE(qr_code_id_password, '') AS qr_code_id_password,
            COALESCE(remarks, '') AS remarks
        FROM branch_finance_details
        WHERE branch_id = ?
    `;
    const [detailsRows] = await db.execute(detailsQuery, [branchId]);
    const details = detailsRows[0] || { qr_code_id_password: '', remarks: '' };

    return { brands, machines, companies, details };
};

const saveBranchFinanceCodes = async (branchId, data, submittedBy) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Save Brands (Delete first then Insert if not empty)
        await connection.execute(`DELETE FROM branch_finance_brands WHERE branch_id = ?`, [branchId]);
        if (data.brands && data.brands.length > 0) {
            const insertBrandQuery = `
                INSERT INTO branch_finance_brands (branch_id, brand_id, brand_code, submitted_by)
                VALUES (?, ?, ?, ?)
            `;
            for (const b of data.brands) {
                if (b.brand_code && b.brand_code.trim()) {
                    await connection.execute(insertBrandQuery, [branchId, b.brand_id, b.brand_code.trim(), submittedBy]);
                }
            }
        }

        // 2. Save Machines (Delete first then Insert if not empty)
        await connection.execute(`DELETE FROM branch_finance_machines WHERE branch_id = ?`, [branchId]);
        if (data.machines && data.machines.length > 0) {
            const insertMachineQuery = `
                INSERT INTO branch_finance_machines (branch_id, machine_id, tid, pos_id, serial_no, submitted_by)
                VALUES (?, ?, ?, ?, ?, ?)
            `;
            for (const m of data.machines) {
                if ((m.tid && m.tid.trim()) || (m.pos_id && m.pos_id.trim()) || (m.serial_no && m.serial_no.trim())) {
                    await connection.execute(insertMachineQuery, [
                        branchId,
                        m.machine_id,
                        (m.tid || '').trim(),
                        (m.pos_id || '').trim(),
                        (m.serial_no || '').trim(),
                        submittedBy
                    ]);
                }
            }
        }

        // 3. Save Companies (Delete first then Insert if not empty)
        await connection.execute(`DELETE FROM branch_finance_companies WHERE branch_id = ?`, [branchId]);
        if (data.companies && data.companies.length > 0) {
            const insertCompanyQuery = `
                INSERT INTO branch_finance_companies (branch_id, company_id, company_code, submitted_by)
                VALUES (?, ?, ?, ?)
            `;
            for (const c of data.companies) {
                if (c.company_code && c.company_code.trim()) {
                    await connection.execute(insertCompanyQuery, [branchId, c.company_id, c.company_code.trim(), submittedBy]);
                }
            }
        }

        // 4. Save Details (QR Code ID & Password, Remarks) using REPLACE INTO
        const replaceDetailsQuery = `
            REPLACE INTO branch_finance_details (branch_id, qr_code_id_password, remarks, submitted_by)
            VALUES (?, ?, ?, ?)
        `;
        await connection.execute(replaceDetailsQuery, [
            branchId,
            (data.details?.qr_code_id_password || '').trim(),
            (data.details?.remarks || '').trim(),
            submittedBy
        ]);

        await connection.commit();
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

module.exports = {
    createBranchFinanceCodeTables,
    getBranchFinanceCodesByBranchId,
    saveBranchFinanceCodes
};

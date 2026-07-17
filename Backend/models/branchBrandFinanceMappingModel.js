const db = require('../config/db.js');

const createBranchBrandFinanceMappingTable = async () => {
    const query = `
        CREATE TABLE IF NOT EXISTS branch_brand_finance_mapping (
            id INT AUTO_INCREMENT PRIMARY KEY,
            branch_id INT NOT NULL,
            brand_id INT NOT NULL,
            company_id INT NOT NULL,
            added_by INT NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (branch_id) REFERENCES branch_master(id) ON DELETE CASCADE,
            FOREIGN KEY (brand_id) REFERENCES mobile_brand_master(id) ON DELETE CASCADE,
            FOREIGN KEY (company_id) REFERENCES bank_master(id) ON DELETE CASCADE,
            FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE KEY idx_branch_brand_company (branch_id, brand_id, company_id)
        )
    `;
    await db.execute(query);
    console.log("Branch Brand Finance Mapping table ready");
};

const getMappingsByBranchId = async (branchId) => {
    const query = `
        SELECT brand_id, company_id
        FROM branch_brand_finance_mapping
        WHERE branch_id = ?
    `;
    const [rows] = await db.execute(query, [branchId]);
    return rows;
};

const saveBranchBrandFinanceMappings = async (branchId, mappings, userId) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Delete all existing mappings for the branch
        await connection.execute(
            `DELETE FROM branch_brand_finance_mapping WHERE branch_id = ?`,
            [branchId]
        );

        // 2. Insert new mappings
        if (mappings && mappings.length > 0) {
            const insertQuery = `
                INSERT INTO branch_brand_finance_mapping (branch_id, brand_id, company_id, added_by)
                VALUES (?, ?, ?, ?)
            `;
            for (const map of mappings) {
                await connection.execute(insertQuery, [
                    branchId,
                    map.brand_id,
                    map.company_id,
                    userId
                ]);
            }
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
    createBranchBrandFinanceMappingTable,
    getMappingsByBranchId,
    saveBranchBrandFinanceMappings
};

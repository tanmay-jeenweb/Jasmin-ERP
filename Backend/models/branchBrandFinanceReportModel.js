const db = require('../config/db.js');

const getFinanceBrandReportData = async () => {
    // 1. Fetch active branches
    const branchesQuery = `
        SELECT b.id, b.name, b.code, b.state_id, s.name AS state_name 
        FROM branch_master b 
        LEFT JOIN state_master s ON b.state_id = s.id 
        WHERE b.status = 'active' 
        ORDER BY b.name ASC
    `;
    const [branches] = await db.execute(branchesQuery);

    // 2. Fetch all brands
    const brandsQuery = `
        SELECT id, mobile_brand 
        FROM mobile_brand_master 
        ORDER BY mobile_brand ASC
    `;
    const [brands] = await db.execute(brandsQuery);

    // 3. Fetch all machines
    const machinesQuery = `
        SELECT id, machine_name 
        FROM finance_machine_master 
        ORDER BY machine_name ASC
    `;
    const [machines] = await db.execute(machinesQuery);

    // 4. Fetch active finance companies
    const companiesQuery = `
        SELECT id, bank_card_name 
        FROM bank_master 
        ORDER BY bank_card_name ASC
    `;
    const [companies] = await db.execute(companiesQuery);

    // 5. Fetch all brand codes
    const brandCodesQuery = `SELECT branch_id, brand_id, brand_code FROM branch_finance_brands`;
    const [brandCodes] = await db.execute(brandCodesQuery);

    // 6. Fetch all machine details
    const machineCodesQuery = `SELECT branch_id, machine_id, tid, pos_id, serial_no FROM branch_finance_machines`;
    const [machineCodes] = await db.execute(machineCodesQuery);

    // 7. Fetch all company codes
    const companyCodesQuery = `SELECT branch_id, company_id, company_code FROM branch_finance_companies`;
    const [companyCodes] = await db.execute(companyCodesQuery);

    // 8. Fetch all details
    const detailsQuery = `SELECT branch_id, qr_code_id_password, remarks FROM branch_finance_details`;
    const [details] = await db.execute(detailsQuery);

    // 9. Fetch all mappings
    const mappingsQuery = `SELECT DISTINCT branch_id, brand_id, company_id FROM branch_brand_finance_mapping`;
    const [mappings] = await db.execute(mappingsQuery);

    return {
        branches,
        brands,
        machines,
        companies,
        brandCodes,
        machineCodes,
        companyCodes,
        details,
        mappings
    };
};

module.exports = {
    getFinanceBrandReportData
};

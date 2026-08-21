const { getFinanceBrandReportData } = require('../models/branchBrandFinanceReportModel.js');
const db = require('../config/db.js');

const getFinanceBrandReportController = async (req, res) => {
    try {
        const data = await getFinanceBrandReportData();

        // Check if the user is admin/super admin
        const [userRows] = await db.execute(
            `SELECT u.id, u.role, u.state, ut.user_role, ut.type_name
             FROM users u
             LEFT JOIN user_types ut ON u.user_type_id = ut.id
             WHERE u.id = ?`,
            [req.user.id]
        );

        let isAdmin = false;
        if (userRows.length > 0) {
            const u = userRows[0];
            if (u.role === 'admin' || u.role === 'super admin' || u.user_role === 'Admin' || u.type_name === 'Admin') {
                isAdmin = true;
            }
        }

        let filteredBranches = data.branches;

        if (!isAdmin) {
            // Fetch mapped branch IDs from user_branch_mappings
            const [mappingRows] = await db.execute(
                `SELECT branch_id FROM user_branch_mappings WHERE user_id = ?`,
                [req.user.id]
            );
            const mappedBranchIds = mappingRows.map(r => r.branch_id);
            filteredBranches = data.branches.filter(b => mappedBranchIds.includes(b.id));
        } else {
            // Apply existing state restriction logic
            let userStates = null;
            if (userRows.length > 0 && userRows[0].state) {
                try {
                    userStates = typeof userRows[0].state === 'string' ? JSON.parse(userRows[0].state) : userRows[0].state;
                } catch (e) {
                    userStates = null;
                }
            }

            if (userStates && Array.isArray(userStates) && userStates.length > 0 && !userStates.includes("All")) {
                const upperUserStates = userStates.map(s => String(s).trim().toUpperCase());
                filteredBranches = data.branches.filter(b => b.state_name && upperUserStates.includes(String(b.state_name).trim().toUpperCase()));
            }
        }

        // Index database elements by branch_id, brand_id, company_id, machine_id
        const brandCodesMap = {}; // { [branchId]: { [brandId]: brand_code } }
        data.brandCodes.forEach(item => {
            if (!brandCodesMap[item.branch_id]) {
                brandCodesMap[item.branch_id] = {};
            }
            brandCodesMap[item.branch_id][item.brand_id] = item.brand_code;
        });

        const machineCodesMap = {}; // { [branchId]: { [machineId]: { tid, pos_id, serial_no } } }
        data.machineCodes.forEach(item => {
            if (!machineCodesMap[item.branch_id]) {
                machineCodesMap[item.branch_id] = {};
            }
            machineCodesMap[item.branch_id][item.machine_id] = {
                tid: item.tid,
                pos_id: item.pos_id,
                serial_no: item.serial_no
            };
        });

        const companyCodesMap = {}; // { [branchId]: { [companyId]: company_code } }
        data.companyCodes.forEach(item => {
            if (!companyCodesMap[item.branch_id]) {
                companyCodesMap[item.branch_id] = {};
            }
            companyCodesMap[item.branch_id][item.company_id] = item.company_code;
        });

        const detailsMap = {}; // { [branchId]: { qr_code_id_password, remarks } }
        data.details.forEach(item => {
            detailsMap[item.branch_id] = {
                qr_code_id_password: item.qr_code_id_password,
                remarks: item.remarks
            };
        });

        // Track active branch-brand and branch-company mappings for highlighting
        const mappedBrandsMap = {}; // { [branchId]: Set of brandIds }
        const mappedCompaniesMap = {}; // { [branchId]: Set of companyIds }

        data.mappings.forEach(item => {
            if (!mappedBrandsMap[item.branch_id]) {
                mappedBrandsMap[item.branch_id] = new Set();
            }
            if (!mappedCompaniesMap[item.branch_id]) {
                mappedCompaniesMap[item.branch_id] = new Set();
            }
            mappedBrandsMap[item.branch_id].add(item.brand_id);
            mappedCompaniesMap[item.branch_id].add(item.company_id);
        });

        // Combine into rows
        const rows = filteredBranches.map(branch => {
            const bId = branch.id;
            const bBrandCodes = brandCodesMap[bId] || {};
            const bMachineDetails = machineCodesMap[bId] || {};
            const bCompanyCodes = companyCodesMap[bId] || {};
            const bDetails = detailsMap[bId] || { qr_code_id_password: '', remarks: '' };
            const bMappedBrands = Array.from(mappedBrandsMap[bId] || []);
            const bMappedCompanies = Array.from(mappedCompaniesMap[bId] || []);

            return {
                branch_id: bId,
                branch_name: branch.name,
                branch_code: branch.code,
                state_id: branch.state_id,
                state_name: branch.state_name || '—',
                brand_codes: bBrandCodes,
                mapped_brands: bMappedBrands,
                qr_code_id_password: bDetails.qr_code_id_password,
                machine_details: bMachineDetails,
                company_codes: bCompanyCodes,
                mapped_companies: bMappedCompanies,
                remarks: bDetails.remarks
            };
        });

        return res.status(200).json({
            success: true,
            data: {
                brands: data.brands,
                machines: data.machines,
                companies: data.companies,
                rows
            }
        });
    } catch (error) {
        console.error("Failed to generate Finance Brand report:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to generate Finance Brand report data"
        });
    }
};

module.exports = {
    getFinanceBrandReportController
};

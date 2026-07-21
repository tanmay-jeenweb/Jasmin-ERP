const { 
    getStockCashDepositReportData, 
    importStockCashDepositData, 
    importCurrentStockData,
    importOpeningCashAndCreditData,
    importCashDepositData
} = require('../models/stockCashDepositModel.js');

const db = require('../config/db.js');

// Helper to retrieve allowed branch names for a user based on User Branch Mapping
const getUserAllowedBranchNames = async (user) => {
    if (!user || !user.id) return [];

    const isAdmin = user.role === 'admin' || user.role === 'super admin';
    if (isAdmin) {
        return null; // null indicates access to ALL branches
    }

    const [userRows] = await db.execute(
        `SELECT u.id, u.role, ut.user_role, ut.type_name 
         FROM users u 
         LEFT JOIN user_types ut ON u.user_type_id = ut.id 
         WHERE u.id = ?`,
        [user.id]
    );

    if (userRows.length > 0) {
        const u = userRows[0];
        if (u.role === 'admin' || u.role === 'super admin' || u.user_role === 'Admin' || u.type_name === 'Admin') {
            return null;
        }
    }

    const [mappingRows] = await db.execute(
        `SELECT bm.name AS branch_name
         FROM user_branch_mappings ubm
         JOIN branch_master bm ON ubm.branch_id = bm.id
         WHERE ubm.user_id = ?`,
        [user.id]
    );

    return mappingRows.map(r => String(r.branch_name).trim().toUpperCase());
};

const getStockCashDepositReportController = async (req, res) => {
    try {
        let records = await getStockCashDepositReportData();
        const allowedBranchNames = await getUserAllowedBranchNames(req.user);

        if (allowedBranchNames !== null) {
            records = records.filter(r => r.branch_name && allowedBranchNames.includes(String(r.branch_name).trim().toUpperCase()));
        }

        res.status(200).json({
            success: true,
            message: 'Stock vs Cash Deposit report data retrieved successfully',
            data: records
        });
    } catch (error) {
        console.error('Error retrieving Stock vs Cash Deposit report data:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const importStockCashDepositController = async (req, res) => {
    try {
        const { records } = req.body;
        if (!records || !Array.isArray(records)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid records format. Expected an array of records.'
            });
        }
        await importStockCashDepositData(records);
        res.status(200).json({
            success: true,
            message: 'Records imported successfully'
        });
    } catch (error) {
        console.error('Error importing Stock vs Cash Deposit data:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to import records'
        });
    }
};

const importCurrentStockController = async (req, res) => {
    try {
        const { records } = req.body;
        if (!records || !Array.isArray(records)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid records format. Expected an array of records.'
            });
        }
        await importCurrentStockData(records);
        res.status(200).json({
            success: true,
            message: 'Current Stock records imported successfully'
        });
    } catch (error) {
        console.error('Error importing Current Stock data:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to import Current Stock records'
        });
    }
};

const importOpeningCashAndCreditController = async (req, res) => {
    try {
        const { records } = req.body;
        if (!records || !Array.isArray(records)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid records format. Expected an array of records.'
            });
        }
        await importOpeningCashAndCreditData(records);
        res.status(200).json({
            success: true,
            message: 'Opening Cash & Credit records imported successfully'
        });
    } catch (error) {
        console.error('Error importing Opening Cash & Credit data:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to import Opening Cash & Credit records'
        });
    }
};

const importCashDepositController = async (req, res) => {
    try {
        const { records } = req.body;
        if (!records || !Array.isArray(records)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid records format. Expected an array of records.'
            });
        }
        await importCashDepositData(records);
        res.status(200).json({
            success: true,
            message: 'Cash Deposit records imported successfully'
        });
    } catch (error) {
        console.error('Error importing Cash Deposit data:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to import Cash Deposit records'
        });
    }
};

module.exports = {
    getStockCashDepositReportController,
    importStockCashDepositController,
    importCurrentStockController,
    importOpeningCashAndCreditController,
    importCashDepositController
};

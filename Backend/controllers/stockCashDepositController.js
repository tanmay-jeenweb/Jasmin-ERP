const { 
    getStockCashDepositReportData, 
    importStockCashDepositData, 
    importCurrentStockData,
    importOpeningCashAndCreditData,
    importCashDepositData
} = require('../models/stockCashDepositModel.js');

const db = require('../config/db.js');
const { createAuditLog } = require('../models/auditLogModel.js');

// Helper to retrieve allowed branch names for a user based on User Branch Mapping
// Helper to filter records by user's state restrictions
const filterRecordsByUserState = async (userId, records) => {
    const [userRows] = await db.execute("SELECT state FROM users WHERE id = ?", [userId]);
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
        return records.filter(r => r.state_name && upperUserStates.includes(String(r.state_name).trim().toUpperCase()));
    }
    return records;
};

const getUserAllowedBranchNames = async (user) => {
    if (!user || !user.id) return [];

    const isAdmin = user.role === 'admin' || user.role === 'super admin';
    if (isAdmin) {
        return null; // null indicates access to ALL branches
    }

    const [userRows] = await db.execute(
        `SELECT u.id, u.role, ut.user_role, ut.type_name, u.state 
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

    if (mappingRows.length > 0) {
        return mappingRows.map(r => String(r.branch_name).trim().toUpperCase());
    }

    // If no branch mappings exist, check if the user has state restrictions
    if (userRows.length > 0 && userRows[0].state) {
        try {
            const userStates = typeof userRows[0].state === 'string' ? JSON.parse(userRows[0].state) : userRows[0].state;
            if (userStates && Array.isArray(userStates) && userStates.length > 0 && !userStates.includes("All")) {
                return null;
            }
        } catch (e) {
            console.error("Error parsing user state in getUserAllowedBranchNames:", e);
        }
    }

    return [];
};

const getStockCashDepositReportController = async (req, res) => {
    try {
        let records = await getStockCashDepositReportData();
        const allowedBranchNames = await getUserAllowedBranchNames(req.user);

        if (allowedBranchNames !== null) {
            records = records.filter(r => r.branch_name && allowedBranchNames.includes(String(r.branch_name).trim().toUpperCase()));
        }

        // Apply user state restrictions
        records = await filterRecordsByUserState(req.user.id, records);

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

        try {
            const addedBy = req.user.id;
            const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';
            await createAuditLog(
                addedBy,
                req.user?.name || req.user?.username || 'Unknown',
                deviceId,
                'Stock vs Cash Deposit Import',
                'updated',
                null,
                {
                    imported_count: records.length,
                    imported_at: new Date().toISOString()
                }
            );
        } catch (auditErr) {
            console.error("Failed to write audit log for Stock vs Cash Deposit import:", auditErr);
        }

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

        try {
            const addedBy = req.user.id;
            const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';
            await createAuditLog(
                addedBy,
                req.user?.name || req.user?.username || 'Unknown',
                deviceId,
                'Current Stock Import',
                'updated',
                null,
                {
                    imported_count: records.length,
                    imported_at: new Date().toISOString()
                }
            );
        } catch (auditErr) {
            console.error("Failed to write audit log for Current Stock import:", auditErr);
        }

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

        try {
            const addedBy = req.user.id;
            const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';
            await createAuditLog(
                addedBy,
                req.user?.name || req.user?.username || 'Unknown',
                deviceId,
                'Opening Cash & Credit Import',
                'updated',
                null,
                {
                    imported_count: records.length,
                    imported_at: new Date().toISOString()
                }
            );
        } catch (auditErr) {
            console.error("Failed to write audit log for Opening Cash & Credit import:", auditErr);
        }

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

        try {
            const addedBy = req.user.id;
            const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';
            await createAuditLog(
                addedBy,
                req.user?.name || req.user?.username || 'Unknown',
                deviceId,
                'Cash Deposit Import',
                'updated',
                null,
                {
                    imported_count: records.length,
                    imported_at: new Date().toISOString()
                }
            );
        } catch (auditErr) {
            console.error("Failed to write audit log for Cash Deposit import:", auditErr);
        }

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

const getAbmWiseCashDepositReportController = async (req, res) => {
    try {
        const { state } = req.query; // e.g. "All" or a state name like "Punjab"
        let records = await getStockCashDepositReportData();
        const allowedBranchNames = await getUserAllowedBranchNames(req.user);

        // 1. Filter by allowed branch mapping
        if (allowedBranchNames !== null) {
            records = records.filter(r => r.branch_name && allowedBranchNames.includes(String(r.branch_name).trim().toUpperCase()));
        }

        // 2. Filter by user state restrictions
        records = await filterRecordsByUserState(req.user.id, records);

        // 3. Filter by selected state if not 'All'
        if (state && state !== 'All') {
            records = records.filter(r => r.state_name && String(r.state_name).trim().toLowerCase() === String(state).trim().toLowerCase());
        }

        // 3. Perform ABM-wise aggregation
        const summaryMap = {};
        records.forEach(item => {
            const abm = item.abm_name || "—";
            if (!summaryMap[abm]) {
                summaryMap[abm] = {
                    abm_name: abm,
                    opening_cash: 0,
                    cash_deposit: 0,
                    pending_cash_deposit: 0
                };
            }
            summaryMap[abm].opening_cash += Number(item.opening_cash_deposit_pending || 0);
            summaryMap[abm].cash_deposit += Number(item.cash_deposit || 0);
            summaryMap[abm].pending_cash_deposit += Number(item.pending_cash_deposit || 0);
        });

        const abmGroups = Object.values(summaryMap).map(group => {
            const pending_pct = group.opening_cash > 0
                ? (group.pending_cash_deposit / group.opening_cash) * 100
                : 0.00;
            return {
                ...group,
                pending_pct
            };
        });

        // 4. Calculate overall totals
        const totals = {
            opening_cash: 0,
            cash_deposit: 0,
            pending_cash_deposit: 0,
            pending_pct: 0
        };

        abmGroups.forEach(item => {
            totals.opening_cash += item.opening_cash;
            totals.cash_deposit += item.cash_deposit;
            totals.pending_cash_deposit += item.pending_cash_deposit;
        });

        totals.pending_pct = totals.opening_cash > 0
            ? (totals.pending_cash_deposit / totals.opening_cash) * 100
            : 0.00;

        res.status(200).json({
            success: true,
            message: 'ABM Wise Cash Deposit report data retrieved successfully',
            data: abmGroups,
            totals
        });
    } catch (error) {
        console.error('Error retrieving ABM Wise Cash Deposit report data:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

module.exports = {
    getStockCashDepositReportController,
    importStockCashDepositController,
    importCurrentStockController,
    importOpeningCashAndCreditController,
    importCashDepositController,
    getAbmWiseCashDepositReportController
};

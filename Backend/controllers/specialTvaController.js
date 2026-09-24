const {
    createSpecialTvaEntry,
    getAllSpecialTvas,
    getSpecialTvaById,
    updateSpecialTva,
    deleteSpecialTva,
    upsertSpecialTvaTargets,
    getSpecialTvaReportData
} = require('../models/specialTvaModel.js');
const { createAuditLog } = require('../models/auditLogModel.js');
const db = require('../config/db.js');

// Helper to get non-admin state and branch restrictions
const getUserRestrictions = async (user) => {
    if (!user || !user.id) return { states: null, branches: null };
    const isAdmin = user.role === 'admin' || user.role === 'super admin';
    if (isAdmin) return { states: null, branches: null };

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
            return { states: null, branches: null };
        }

        let userStates = null;
        if (u.state) {
            try {
                userStates = typeof u.state === 'string' ? JSON.parse(u.state) : u.state;
            } catch (e) {
                userStates = null;
            }
        }

        const [mappingRows] = await db.execute(
            `SELECT bm.name AS branch_name
             FROM user_branch_mappings ubm
             JOIN branch_master bm ON ubm.branch_id = bm.id
             WHERE ubm.user_id = ?`,
            [user.id]
        );
        const userBranches = mappingRows.map(r => r.branch_name);

        return {
            states: userStates,
            branches: userBranches.length > 0 ? userBranches : null
        };
    }
    return { states: null, branches: null };
};

const createSpecialTvaController = async (req, res) => {
    try {
        const { title, start_date, end_date } = req.body;
        const addedBy = req.user.id;
        const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';

        if (!title || !title.trim()) {
            return res.status(400).json({ success: false, message: 'Title is required' });
        }
        if (!start_date || !end_date) {
            return res.status(400).json({ success: false, message: 'Start date and End date are required' });
        }
        if (new Date(start_date) > new Date(end_date)) {
            return res.status(400).json({ success: false, message: 'Start date cannot be after End date' });
        }

        const entry = await createSpecialTvaEntry(title.trim(), start_date, end_date, addedBy, deviceId);

        await createAuditLog(
            addedBy,
            req.user?.name || req.user?.username || 'Unknown',
            deviceId,
            'Special TVA Master',
            'created',
            null,
            entry
        );

        res.status(201).json({
            success: true,
            message: 'Special TVA master entry created successfully',
            data: entry
        });
    } catch (error) {
        console.error('Error creating Special TVA:', error);
        res.status(500).json({ success: false, message: error.message || 'Internal server error' });
    }
};

const getAllSpecialTvasController = async (req, res) => {
    try {
        const list = await getAllSpecialTvas();
        res.status(200).json({ success: true, data: list });
    } catch (error) {
        console.error('Error fetching Special TVAs:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getSpecialTvaByIdController = async (req, res) => {
    try {
        const { id } = req.params;
        const entry = await getSpecialTvaById(id);
        if (!entry) {
            return res.status(404).json({ success: false, message: 'Special TVA record not found' });
        }
        res.status(200).json({ success: true, data: entry });
    } catch (error) {
        console.error('Error fetching Special TVA by ID:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const updateSpecialTvaController = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, start_date, end_date } = req.body;
        const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';

        const beforeData = await getSpecialTvaById(id);
        if (!beforeData) {
            return res.status(404).json({ success: false, message: 'Special TVA record not found' });
        }

        if (!title || !title.trim()) {
            return res.status(400).json({ success: false, message: 'Title is required' });
        }
        if (!start_date || !end_date) {
            return res.status(400).json({ success: false, message: 'Start date and End date are required' });
        }
        if (new Date(start_date) > new Date(end_date)) {
            return res.status(400).json({ success: false, message: 'Start date cannot be after End date' });
        }

        await updateSpecialTva(id, title.trim(), start_date, end_date);

        await createAuditLog(
            req.user.id,
            req.user?.name || req.user?.username || 'Unknown',
            deviceId,
            'Special TVA Master',
            'updated',
            beforeData,
            { id, title: title.trim(), start_date, end_date }
        );

        res.status(200).json({ success: true, message: 'Special TVA updated successfully' });
    } catch (error) {
        console.error('Error updating Special TVA:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const deleteSpecialTvaController = async (req, res) => {
    try {
        const { id } = req.params;
        const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';

        const beforeData = await getSpecialTvaById(id);
        if (!beforeData) {
            return res.status(404).json({ success: false, message: 'Special TVA record not found' });
        }

        await deleteSpecialTva(id);

        await createAuditLog(
            req.user.id,
            req.user?.name || req.user?.username || 'Unknown',
            deviceId,
            'Special TVA Master',
            'deleted',
            beforeData,
            null
        );

        res.status(200).json({ success: true, message: 'Special TVA entry and table deleted successfully' });
    } catch (error) {
        console.error('Error deleting Special TVA:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getSpecialTvaReportController = async (req, res) => {
    try {
        const { id } = req.params;
        const restrictions = await getUserRestrictions(req.user);

        const reportData = await getSpecialTvaReportData(
            id,
            restrictions.states,
            restrictions.branches
        );

        res.status(200).json({
            success: true,
            data: reportData
        });
    } catch (error) {
        console.error('Error generating Special TVA report:', error);
        res.status(500).json({ success: false, message: error.message || 'Internal server error' });
    }
};

const importSpecialTvaTargetController = async (req, res) => {
    try {
        const { id } = req.params;
        const { records } = req.body;
        const addedBy = req.user.id;
        const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';

        if (!records || !Array.isArray(records) || records.length === 0) {
            return res.status(400).json({ success: false, message: 'No target records provided for import' });
        }

        const result = await upsertSpecialTvaTargets(id, records, addedBy, deviceId);

        await createAuditLog(
            addedBy,
            req.user?.name || req.user?.username || 'Unknown',
            deviceId,
            'Special TVA Master',
            'imported',
            null,
            { id, count: result.updated }
        );

        res.status(200).json({
            success: true,
            message: `Successfully updated targets for ${result.updated} branches`,
            data: result
        });
    } catch (error) {
        console.error('Error importing Special TVA targets:', error);
        res.status(500).json({ success: false, message: error.message || 'Internal server error' });
    }
};

module.exports = {
    createSpecialTvaController,
    getAllSpecialTvasController,
    getSpecialTvaByIdController,
    updateSpecialTvaController,
    deleteSpecialTvaController,
    getSpecialTvaReportController,
    importSpecialTvaTargetController
};

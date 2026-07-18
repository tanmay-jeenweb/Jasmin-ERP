const {
    getEligibleUsers,
    getActiveBranches,
    getAllUserMappings,
    getUserMappingById,
    saveUserBranchMapping,
    deleteUserMapping,
    checkConflictingBranchMappings
} = require('../models/userBranchMappingModel.js');
const { createAuditLog } = require('../models/auditLogModel.js');
const { getUserById } = require('../models/userModel.js');

const getEligibleUsersController = async (req, res) => {
    try {
        const users = await getEligibleUsers();
        res.status(200).json({
            success: true,
            message: 'Eligible users retrieved successfully',
            data: users
        });
    } catch (error) {
        console.error('Error retrieving eligible users:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const getActiveBranchesController = async (req, res) => {
    try {
        const branches = await getActiveBranches();
        res.status(200).json({
            success: true,
            message: 'Active branches retrieved successfully',
            data: branches
        });
    } catch (error) {
        console.error('Error retrieving active branches:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const getAllUserMappingsController = async (req, res) => {
    try {
        const mappings = await getAllUserMappings();
        res.status(200).json({
            success: true,
            message: 'User branch mappings retrieved successfully',
            data: mappings
        });
    } catch (error) {
        console.error('Error retrieving user mappings:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const getUserMappingByIdController = async (req, res) => {
    try {
        const { id } = req.params;
        const branchIds = await getUserMappingById(id);
        res.status(200).json({
            success: true,
            message: 'User mapping retrieved successfully',
            data: branchIds
        });
    } catch (error) {
        console.error('Error retrieving user mapping by ID:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const saveUserBranchMappingController = async (req, res) => {
    try {
        const { userId, branchIds, oldUserId } = req.body;
        const addedBy = req.user.id;
        const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';

        if (!userId) {
            return res.status(400).json({ success: false, message: 'User ID is required' });
        }
        if (!Array.isArray(branchIds)) {
            return res.status(400).json({ success: false, message: 'Branch IDs must be an array' });
        }

        const user = await getUserById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const beforeBranchIds = await getUserMappingById(oldUserId || userId);

        // Check conflicts (only enforces unique constraints if the user is an ABM)
        const conflicts = await checkConflictingBranchMappings(userId, branchIds, oldUserId);
        if (conflicts.length > 0) {
            const conflictMsgs = conflicts.map(c => `Branch '${c.branch_name}' is already mapped to ABM '${c.abm_name}'`);
            return res.status(400).json({
                success: false,
                message: conflictMsgs.join('. ')
            });
        }

        await saveUserBranchMapping(userId, branchIds, addedBy, deviceId, oldUserId);

        await createAuditLog(
            addedBy,
            req.user?.name || req.user?.username || 'Unknown',
            deviceId,
            'User Branch Mapping',
            (oldUserId || beforeBranchIds.length > 0) ? 'updated' : 'created',
            { user_id: oldUserId || userId, branch_ids: beforeBranchIds },
            { user_id: userId, user_name: user.name, branch_ids: branchIds }
        );

        res.status(200).json({
            success: true,
            message: 'User branch mapping saved successfully'
        });
    } catch (error) {
        console.error('Error saving user mapping:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const deleteUserMappingController = async (req, res) => {
    try {
        const { id } = req.params;
        const addedBy = req.user.id;
        const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';

        const user = await getUserById(id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const beforeBranchIds = await getUserMappingById(id);
        if (beforeBranchIds.length === 0) {
            return res.status(404).json({ success: false, message: 'No mappings found for this User' });
        }

        await deleteUserMapping(id);

        await createAuditLog(
            addedBy,
            req.user?.name || req.user?.username || 'Unknown',
            deviceId,
            'User Branch Mapping',
            'deleted',
            { user_id: id, user_name: user.name, branch_ids: beforeBranchIds },
            null
        );

        res.status(200).json({
            success: true,
            message: 'User branch mapping deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting user mapping:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

module.exports = {
    getEligibleUsersController,
    getActiveBranchesController,
    getAllUserMappingsController,
    getUserMappingByIdController,
    saveUserBranchMappingController,
    deleteUserMappingController
};

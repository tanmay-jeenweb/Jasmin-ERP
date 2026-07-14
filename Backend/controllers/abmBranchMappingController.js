const {
    getEligibleAbms,
    getActiveBranches,
    getAllAbmMappings,
    getAbmMappingById,
    saveAbmBranchMapping,
    deleteAbmMapping
} = require('../models/abmBranchMappingModel.js');
const { createAuditLog } = require('../models/auditLogModel.js');
const { getUserById } = require('../models/userModel.js');

const getEligibleAbmsController = async (req, res) => {
    try {
        const abms = await getEligibleAbms();
        res.status(200).json({
            success: true,
            message: 'Eligible ABMs retrieved successfully',
            data: abms
        });
    } catch (error) {
        console.error('Error retrieving eligible ABMs:', error);
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

const getAllAbmMappingsController = async (req, res) => {
    try {
        const mappings = await getAllAbmMappings();
        res.status(200).json({
            success: true,
            message: 'ABM Branch mappings retrieved successfully',
            data: mappings
        });
    } catch (error) {
        console.error('Error retrieving ABM mappings:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const getAbmMappingByIdController = async (req, res) => {
    try {
        const { id } = req.params;
        const branchIds = await getAbmMappingById(id);
        res.status(200).json({
            success: true,
            message: 'ABM mapping retrieved successfully',
            data: branchIds
        });
    } catch (error) {
        console.error('Error retrieving ABM mapping by ID:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const saveAbmBranchMappingController = async (req, res) => {
    try {
        const { abmUserId, branchIds, oldAbmUserId } = req.body;
        const addedBy = req.user.id;
        const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';

        if (!abmUserId) {
            return res.status(400).json({ success: false, message: 'ABM User ID is required' });
        }
        if (!Array.isArray(branchIds)) {
            return res.status(400).json({ success: false, message: 'Branch IDs must be an array' });
        }

        const abmUser = await getUserById(abmUserId);
        if (!abmUser) {
            return res.status(404).json({ success: false, message: 'ABM User not found' });
        }

        const beforeBranchIds = await getAbmMappingById(oldAbmUserId || abmUserId);

        await saveAbmBranchMapping(abmUserId, branchIds, addedBy, deviceId, oldAbmUserId);

        await createAuditLog(
            addedBy,
            req.user?.name || req.user?.username || 'Unknown',
            deviceId,
            'ABM Branch Mapping',
            (oldAbmUserId || beforeBranchIds.length > 0) ? 'updated' : 'created',
            { abm_user_id: oldAbmUserId || abmUserId, branch_ids: beforeBranchIds },
            { abm_user_id: abmUserId, abm_name: abmUser.name, branch_ids: branchIds }
        );

        res.status(200).json({
            success: true,
            message: 'ABM Branch mapping saved successfully'
        });
    } catch (error) {
        console.error('Error saving ABM mapping:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const deleteAbmMappingController = async (req, res) => {
    try {
        const { id } = req.params;
        const addedBy = req.user.id;
        const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';

        const abmUser = await getUserById(id);
        if (!abmUser) {
            return res.status(404).json({ success: false, message: 'ABM User not found' });
        }

        const beforeBranchIds = await getAbmMappingById(id);
        if (beforeBranchIds.length === 0) {
            return res.status(404).json({ success: false, message: 'No mappings found for this ABM User' });
        }

        await deleteAbmMapping(id);

        await createAuditLog(
            addedBy,
            req.user?.name || req.user?.username || 'Unknown',
            deviceId,
            'ABM Branch Mapping',
            'deleted',
            { abm_user_id: id, abm_name: abmUser.name, branch_ids: beforeBranchIds },
            null
        );

        res.status(200).json({
            success: true,
            message: 'ABM Branch mapping deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting ABM mapping:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

module.exports = {
    getEligibleAbmsController,
    getActiveBranchesController,
    getAllAbmMappingsController,
    getAbmMappingByIdController,
    saveAbmBranchMappingController,
    deleteAbmMappingController
};

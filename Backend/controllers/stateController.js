const {
    createState,
    getAllStates,
    updateState,
    deleteState,
    getStateById
} = require('../models/stateModel.js');
const { createAuditLog } = require('../models/auditLogModel.js');

const addStateController = async (req, res) => {
    try {
        const { name, live } = req.body;
        const addedBy = req.user.id;
        const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';

        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'State name is required' });
        }

        const stateLive = (live === 'Yes' || live === 'No') ? live : 'Yes';

        const result = await createState(name.trim(), addedBy, deviceId, stateLive);
        
        await createAuditLog(
            addedBy,
            req.user?.name || req.user?.username || 'Unknown',
            deviceId,
            'State Master',
            'created',
            null,
            {
                id: result.insertId,
                name: name.trim(),
                added_by: addedBy,
                device_id: deviceId,
                live: stateLive
            }
        );

        res.status(201).json({
            success: true,
            message: 'State added successfully',
            data: { id: result.insertId, name: name.trim(), live: stateLive }
        });
    } catch (error) {
        console.error('Error adding state:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, message: 'State name already exists' });
        }
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const getAllStatesController = async (req, res) => {
    try {
        const states = await getAllStates();
        res.status(200).json({
            success: true,
            message: 'States retrieved successfully',
            data: states
        });
    } catch (error) {
        console.error('Error retrieving states:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const updateStateController = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, live } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'State name is required' });
        }

        const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';
        const beforeData = await getStateById(id);
        if (!beforeData) {
            return res.status(404).json({ success: false, message: 'State not found' });
        }

        const stateLive = (live === 'Yes' || live === 'No') ? live : beforeData.live;

        await updateState(id, name.trim(), stateLive);
        
        await createAuditLog(
            req.user?.id,
            req.user?.name || req.user?.username || 'Unknown',
            deviceId,
            'State Master',
            'updated',
            beforeData,
            {
                ...beforeData,
                name: name.trim(),
                live: stateLive
            }
        );

        res.status(200).json({ success: true, message: 'State updated successfully' });
    } catch (error) {
        console.error('Error updating state:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, message: 'State name already exists' });
        }
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const deleteStateController = async (req, res) => {
    try {
        const { id } = req.params;
        const beforeData = await getStateById(id);
        if (!beforeData) {
            return res.status(404).json({ success: false, message: 'State not found' });
        }

        const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';
        await deleteState(id);
        
        await createAuditLog(
            req.user?.id,
            req.user?.name || req.user?.username || 'Unknown',
            deviceId,
            'State Master',
            'deleted',
            beforeData,
            null
        );

        res.status(200).json({ success: true, message: 'State deleted successfully' });
    } catch (error) {
        console.error('Error deleting state:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

module.exports = {
    addStateController,
    getAllStatesController,
    updateStateController,
    deleteStateController
};

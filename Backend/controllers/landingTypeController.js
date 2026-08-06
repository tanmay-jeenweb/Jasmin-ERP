const {
    createLandingType,
    getAllLandingTypes,
    updateLandingType,
    deleteLandingType,
    getLandingTypeById
} = require('../models/landingTypeModel.js');
const { createAuditLog } = require('../models/auditLogModel.js');

const addLandingTypeController = async (req, res) => {
    try {
        const { name, live } = req.body;
        const addedBy = req.user.id;
        const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';

        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Landing type name is required' });
        }

        const landingTypeLive = (live === 'Yes' || live === 'No') ? live : 'Yes';

        const result = await createLandingType(name.trim(), addedBy, deviceId, landingTypeLive);
        
        await createAuditLog(
            addedBy,
            req.user?.name || req.user?.username || 'Unknown',
            deviceId,
            'Landing Type Master',
            'created',
            null,
            {
                id: result.insertId,
                name: name.trim(),
                added_by: addedBy,
                device_id: deviceId,
                live: landingTypeLive
            }
        );

        res.status(201).json({
            success: true,
            message: 'Landing type added successfully',
            data: { id: result.insertId, name: name.trim(), live: landingTypeLive }
        });
    } catch (error) {
        console.error('Error adding landing type:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, message: 'Landing type name already exists' });
        }
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const getAllLandingTypesController = async (req, res) => {
    try {
        const landingTypes = await getAllLandingTypes();
        res.status(200).json({
            success: true,
            message: 'Landing types retrieved successfully',
            data: landingTypes
        });
    } catch (error) {
        console.error('Error retrieving landing types:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const updateLandingTypeController = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, live } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Landing type name is required' });
        }

        const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';
        const beforeData = await getLandingTypeById(id);
        if (!beforeData) {
            return res.status(404).json({ success: false, message: 'Landing type not found' });
        }

        const landingTypeLive = (live === 'Yes' || live === 'No') ? live : beforeData.live;

        await updateLandingType(id, name.trim(), landingTypeLive);
        
        await createAuditLog(
            req.user?.id,
            req.user?.name || req.user?.username || 'Unknown',
            deviceId,
            'Landing Type Master',
            'updated',
            beforeData,
            {
                ...beforeData,
                name: name.trim(),
                live: landingTypeLive
            }
        );

        res.status(200).json({ success: true, message: 'Landing type updated successfully' });
    } catch (error) {
        console.error('Error updating landing type:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, message: 'Landing type name already exists' });
        }
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const deleteLandingTypeController = async (req, res) => {
    try {
        const { id } = req.params;
        const beforeData = await getLandingTypeById(id);
        if (!beforeData) {
            return res.status(404).json({ success: false, message: 'Landing type not found' });
        }

        const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';
        await deleteLandingType(id);
        
        await createAuditLog(
            req.user?.id,
            req.user?.name || req.user?.username || 'Unknown',
            deviceId,
            'Landing Type Master',
            'deleted',
            beforeData,
            null
        );

        res.status(200).json({ success: true, message: 'Landing type deleted successfully' });
    } catch (error) {
        console.error('Error deleting landing type:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

module.exports = {
    addLandingTypeController,
    getAllLandingTypesController,
    updateLandingTypeController,
    deleteLandingTypeController
};

const {
    createVariation,
    getAllVariations,
    getVariationById,
    updateVariation,
    deleteVariation
} = require('../models/variationModel.js');
const { createAuditLog } = require('../models/auditLogModel.js');

const addVariationController = async (req, res) => {
    try {
        const { stateId, brands, columns } = req.body;
        const addedBy = req.user.id;
        const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';

        if (!stateId) {
            return res.status(400).json({ success: false, message: 'State is required' });
        }
        if (!brands || !Array.isArray(brands) || brands.length === 0) {
            return res.status(400).json({ success: false, message: 'At least one Brand is required' });
        }
        if (!columns || !Array.isArray(columns) || columns.length === 0) {
            return res.status(400).json({ success: false, message: 'At least one Column definition is required' });
        }

        // Validate columns
        for (const col of columns) {
            if (!col.column_id || !col.column_name || !col.column_name.trim()) {
                return res.status(400).json({ success: false, message: 'Column ID and Name are required for all columns' });
            }
            if (!['user input', 'formulation'].includes(col.type)) {
                return res.status(400).json({ success: false, message: 'Invalid column type: must be "user input" or "formulation"' });
            }
            if (col.type === 'formulation' && (!col.formula || !col.formula.trim())) {
                return res.status(400).json({ success: false, message: 'Formula is required when column type is formulation' });
            }
        }

        const result = await createVariation(stateId, brands, columns, addedBy, deviceId);

        const newRecord = {
            id: result.insertId,
            state_id: stateId,
            brands,
            columns,
            added_by: addedBy,
            device_id: deviceId
        };

        await createAuditLog(
            addedBy,
            req.user?.name || req.user?.username || 'Unknown',
            deviceId,
            'Variation Master',
            'created',
            null,
            newRecord
        );

        res.status(201).json({
            success: true,
            message: 'Variation rule added successfully',
            data: newRecord
        });
    } catch (error) {
        console.error('Error adding variation rule:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const getAllVariationsController = async (req, res) => {
    try {
        const variations = await getAllVariations();
        res.status(200).json({
            success: true,
            message: 'Variation rules retrieved successfully',
            data: variations
        });
    } catch (error) {
        console.error('Error retrieving variation rules:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const getVariationByIdController = async (req, res) => {
    try {
        const { id } = req.params;
        const variation = await getVariationById(id);
        if (!variation) {
            return res.status(404).json({ success: false, message: 'Variation rule not found' });
        }
        res.status(200).json({
            success: true,
            message: 'Variation rule retrieved successfully',
            data: variation
        });
    } catch (error) {
        console.error('Error retrieving variation rule:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const updateVariationController = async (req, res) => {
    try {
        const { id } = req.params;
        const { stateId, brands, columns } = req.body;
        const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';

        if (!stateId) {
            return res.status(400).json({ success: false, message: 'State is required' });
        }
        if (!brands || !Array.isArray(brands) || brands.length === 0) {
            return res.status(400).json({ success: false, message: 'At least one Brand is required' });
        }
        if (!columns || !Array.isArray(columns) || columns.length === 0) {
            return res.status(400).json({ success: false, message: 'At least one Column definition is required' });
        }

        // Validate columns
        for (const col of columns) {
            if (!col.column_id || !col.column_name || !col.column_name.trim()) {
                return res.status(400).json({ success: false, message: 'Column ID and Name are required for all columns' });
            }
            if (!['user input', 'formulation'].includes(col.type)) {
                return res.status(400).json({ success: false, message: 'Invalid column type: must be "user input" or "formulation"' });
            }
            if (col.type === 'formulation' && (!col.formula || !col.formula.trim())) {
                return res.status(400).json({ success: false, message: 'Formula is required when column type is formulation' });
            }
        }

        const beforeData = await getVariationById(id);
        if (!beforeData) {
            return res.status(404).json({ success: false, message: 'Variation rule not found' });
        }

        await updateVariation(id, stateId, brands, columns);

        const afterData = {
            ...beforeData,
            state_id: stateId,
            brands,
            columns
        };

        await createAuditLog(
            req.user?.id,
            req.user?.name || req.user?.username || 'Unknown',
            deviceId,
            'Variation Master',
            'updated',
            beforeData,
            afterData
        );

        res.status(200).json({
            success: true,
            message: 'Variation rule updated successfully'
        });
    } catch (error) {
        console.error('Error updating variation rule:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const deleteVariationController = async (req, res) => {
    try {
        const { id } = req.params;
        const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';

        const beforeData = await getVariationById(id);
        if (!beforeData) {
            return res.status(404).json({ success: false, message: 'Variation rule not found' });
        }

        await deleteVariation(id);

        await createAuditLog(
            req.user?.id,
            req.user?.name || req.user?.username || 'Unknown',
            deviceId,
            'Variation Master',
            'deleted',
            beforeData,
            null
        );

        res.status(200).json({
            success: true,
            message: 'Variation rule deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting variation rule:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

module.exports = {
    addVariationController,
    getAllVariationsController,
    getVariationByIdController,
    updateVariationController,
    deleteVariationController
};

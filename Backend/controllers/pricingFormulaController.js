const {
    createPricingFormula,
    getAllPricingFormulas,
    getPricingFormulaById,
    updatePricingFormula,
    deletePricingFormula
} = require('../models/pricingFormulaModel.js');
const { createAuditLog } = require('../models/auditLogModel.js');

const addPricingFormulaController = async (req, res) => {
    try {
        const { stateId, formatName, columns, brandConfigs } = req.body;
        const addedBy = req.user.id;
        const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';

        if (!stateId) {
            return res.status(400).json({ success: false, message: 'State is required' });
        }
        if (!formatName || !formatName.trim()) {
            return res.status(400).json({ success: false, message: 'Format Name is required' });
        }
        if (!columns || !Array.isArray(columns) || columns.length === 0) {
            return res.status(400).json({ success: false, message: 'At least one Column definition is required' });
        }

        // Validate columns
        for (const col of columns) {
            if (!col.column_id || !col.column_name || !col.column_name.trim()) {
                return res.status(400).json({ success: false, message: 'Column ID and Name are required for all columns' });
            }
            if (!['user input', 'formulation', 'default formulation'].includes(col.type)) {
                return res.status(400).json({ success: false, message: 'Invalid column type: must be "user input" or "default formulation"' });
            }
            if ((col.type === 'formulation' || col.type === 'default formulation') && (!col.formula || !col.formula.trim())) {
                return res.status(400).json({ success: false, message: 'Formula is required when column type is formulation' });
            }
        }

        // Validate brand configurations
        if (brandConfigs) {
            if (!Array.isArray(brandConfigs)) {
                return res.status(400).json({ success: false, message: 'Brand configurations must be an array' });
            }
            for (const cfg of brandConfigs) {
                if (!cfg.brands || !Array.isArray(cfg.brands) || cfg.brands.length === 0) {
                    return res.status(400).json({ success: false, message: 'Each brand configuration must have at least one brand' });
                }
                if (!cfg.columns || !Array.isArray(cfg.columns)) {
                    return res.status(400).json({ success: false, message: 'Each brand configuration must have a columns array' });
                }
                for (const col of cfg.columns) {
                    if (!col.column_id || !col.formula || !col.formula.trim()) {
                        return res.status(400).json({ success: false, message: 'Column ID and Formula are required for brand configurations' });
                    }
                }
            }
        }

        const result = await createPricingFormula(stateId, formatName, columns, brandConfigs, addedBy, deviceId);

        const newRecord = {
            id: result.insertId,
            state_id: stateId,
            format_name: formatName,
            columns,
            brand_configs: brandConfigs,
            added_by: addedBy,
            device_id: deviceId
        };

        await createAuditLog(
            addedBy,
            req.user?.name || req.user?.username || 'Unknown',
            deviceId,
            'Pricing Formula Master',
            'created',
            null,
            newRecord
        );

        res.status(201).json({
            success: true,
            message: 'Pricing formula rule added successfully',
            data: newRecord
        });
    } catch (error) {
        console.error('Error adding pricing formula rule:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const getAllPricingFormulasController = async (req, res) => {
    try {
        const formulas = await getAllPricingFormulas();
        res.status(200).json({
            success: true,
            message: 'Pricing formula rules retrieved successfully',
            data: formulas
        });
    } catch (error) {
        console.error('Error retrieving pricing formula rules:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const getPricingFormulaByIdController = async (req, res) => {
    try {
        const { id } = req.params;
        const formula = await getPricingFormulaById(id);
        if (!formula) {
            return res.status(404).json({ success: false, message: 'Pricing formula rule not found' });
        }
        res.status(200).json({
            success: true,
            message: 'Pricing formula rule retrieved successfully',
            data: formula
        });
    } catch (error) {
        console.error('Error retrieving pricing formula rule:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const updatePricingFormulaController = async (req, res) => {
    try {
        const { id } = req.params;
        const { stateId, formatName, columns, brandConfigs } = req.body;
        const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';

        if (!stateId) {
            return res.status(400).json({ success: false, message: 'State is required' });
        }
        if (!formatName || !formatName.trim()) {
            return res.status(400).json({ success: false, message: 'Format Name is required' });
        }
        if (!columns || !Array.isArray(columns) || columns.length === 0) {
            return res.status(400).json({ success: false, message: 'At least one Column definition is required' });
        }

        // Validate columns
        for (const col of columns) {
            if (!col.column_id || !col.column_name || !col.column_name.trim()) {
                return res.status(400).json({ success: false, message: 'Column ID and Name are required for all columns' });
            }
            if (!['user input', 'formulation', 'default formulation'].includes(col.type)) {
                return res.status(400).json({ success: false, message: 'Invalid column type: must be "user input" or "default formulation"' });
            }
            if ((col.type === 'formulation' || col.type === 'default formulation') && (!col.formula || !col.formula.trim())) {
                return res.status(400).json({ success: false, message: 'Formula is required when column type is formulation' });
            }
        }

        // Validate brand configurations
        if (brandConfigs) {
            if (!Array.isArray(brandConfigs)) {
                return res.status(400).json({ success: false, message: 'Brand configurations must be an array' });
            }
            for (const cfg of brandConfigs) {
                if (!cfg.brands || !Array.isArray(cfg.brands) || cfg.brands.length === 0) {
                    return res.status(400).json({ success: false, message: 'Each brand configuration must have at least one brand' });
                }
                if (!cfg.columns || !Array.isArray(cfg.columns)) {
                    return res.status(400).json({ success: false, message: 'Each brand configuration must have a columns array' });
                }
                for (const col of cfg.columns) {
                    if (!col.column_id || !col.formula || !col.formula.trim()) {
                        return res.status(400).json({ success: false, message: 'Column ID and Formula are required for brand configurations' });
                    }
                }
            }
        }

        const beforeData = await getPricingFormulaById(id);
        if (!beforeData) {
            return res.status(404).json({ success: false, message: 'Pricing formula rule not found' });
        }

        await updatePricingFormula(id, stateId, formatName, columns, brandConfigs);

        const afterData = {
            ...beforeData,
            state_id: stateId,
            format_name: formatName,
            columns,
            brand_configs: brandConfigs
        };

        await createAuditLog(
            req.user?.id,
            req.user?.name || req.user?.username || 'Unknown',
            deviceId,
            'Pricing Formula Master',
            'updated',
            beforeData,
            afterData
        );

        res.status(200).json({
            success: true,
            message: 'Pricing formula rule updated successfully'
        });
    } catch (error) {
        console.error('Error updating pricing formula rule:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const deletePricingFormulaController = async (req, res) => {
    try {
        const { id } = req.params;
        const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';

        const beforeData = await getPricingFormulaById(id);
        if (!beforeData) {
            return res.status(404).json({ success: false, message: 'Pricing formula rule not found' });
        }

        await deletePricingFormula(id);

        await createAuditLog(
            req.user?.id,
            req.user?.name || req.user?.username || 'Unknown',
            deviceId,
            'Pricing Formula Master',
            'deleted',
            beforeData,
            null
        );

        res.status(200).json({
            success: true,
            message: 'Pricing formula rule deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting pricing formula rule:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

module.exports = {
    addPricingFormulaController,
    getAllPricingFormulasController,
    getPricingFormulaByIdController,
    updatePricingFormulaController,
    deletePricingFormulaController,
    // Backward compatibility aliases
    addVariationController: addPricingFormulaController,
    getAllVariationsController: getAllPricingFormulasController,
    getVariationByIdController: getPricingFormulaByIdController,
    updateVariationController: updatePricingFormulaController,
    deleteVariationController: deletePricingFormulaController
};

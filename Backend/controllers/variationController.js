const {
    createVariation,
    getAllVariations,
    getVariationById,
    updateVariation,
    deleteVariation,
    checkFormatNameExists
} = require('../models/variationModel.js');
const { createAuditLog } = require('../models/auditLogModel.js');
const { checkUserStateAccess } = require('../utils/userStateHelper.js');

const validateColumnDependencies = (columns, brandConfigs) => {
    if (!columns || !Array.isArray(columns)) return null;

    const activeColIds = new Set(["A", "B", "C", "D", "E", ...columns.map(c => c.column_id)]);

    // Validate formulas in default columns
    for (const col of columns) {
        if ((col.type === 'formulation' || col.type === 'default formulation') && col.formula) {
            const formula = col.formula.trim().toUpperCase();
            const matches = formula.match(/\b\$?[A-Z]+\$?\d+\b/gi) || [];
            for (const m of matches) {
                const colLetter = m.replace(/[\$\d]/g, "").toUpperCase();
                if (colLetter && !activeColIds.has(colLetter)) {
                    return `Cannot save formula: Column ${colLetter} referenced in Column ${col.column_id}${col.column_name ? ` (${col.column_name})` : ''} does not exist or was deleted.`;
                }
            }
        }
    }

    // Validate formulas in brand override configurations
    if (brandConfigs && Array.isArray(brandConfigs)) {
        for (const cfg of brandConfigs) {
            const brandStr = cfg.brands && cfg.brands.length > 0 ? cfg.brands.join(", ") : "Brand";
            for (const col of (cfg.columns || [])) {
                if (col.formula) {
                    const formula = col.formula.trim().toUpperCase();
                    const matches = formula.match(/\b\$?[A-Z]+\$?\d+\b/gi) || [];
                    for (const m of matches) {
                        const colLetter = m.replace(/[\$\d]/g, "").toUpperCase();
                        if (colLetter && !activeColIds.has(colLetter)) {
                            const mainCol = columns.find(c => c.column_id === col.column_id);
                            const colLabel = mainCol ? `Column ${mainCol.column_id}${mainCol.column_name ? ` (${mainCol.column_name})` : ''}` : `Column ${col.column_id}`;
                            return `Cannot save formula: Column ${colLetter} referenced in ${colLabel} (${brandStr} override) does not exist or was deleted.`;
                        }
                    }
                }
            }
        }
    }

    return null;
};

const addVariationController = async (req, res) => {
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

        // Check format_name uniqueness
        const isDuplicate = await checkFormatNameExists(formatName);
        if (isDuplicate) {
            return res.status(400).json({
                success: false,
                message: `Format Name "${formatName.trim()}" already exists. Please choose a unique Format Name.`
            });
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

        // Validate column dependencies
        const depError = validateColumnDependencies(columns, brandConfigs);
        if (depError) {
            return res.status(400).json({ success: false, message: depError });
        }

        const result = await createVariation(stateId, formatName, columns, brandConfigs, addedBy, deviceId);

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

        // Filter variations based on user state access permissions
        const accessibleVariations = [];
        for (const v of variations) {
            const hasAccess = await checkUserStateAccess(req.user, v.state_id, v.state_name);
            if (hasAccess) {
                accessibleVariations.push(v);
            }
        }

        res.status(200).json({
            success: true,
            message: 'Variation rules retrieved successfully',
            data: accessibleVariations
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

        const hasAccess = await checkUserStateAccess(req.user, variation.state_id, variation.state_name);
        if (!hasAccess) {
            return res.status(403).json({
                success: false,
                message: 'Access denied: You are not authorized to view price lists for this state.'
            });
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

        // Check format_name uniqueness excluding current id
        const isDuplicate = await checkFormatNameExists(formatName, id);
        if (isDuplicate) {
            return res.status(400).json({
                success: false,
                message: `Format Name "${formatName.trim()}" already exists. Please choose a unique Format Name.`
            });
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

        // Validate column dependencies
        const depError = validateColumnDependencies(columns, brandConfigs);
        if (depError) {
            return res.status(400).json({ success: false, message: depError });
        }

        const beforeData = await getVariationById(id);
        if (!beforeData) {
            return res.status(404).json({ success: false, message: 'Variation rule not found' });
        }

        await updateVariation(id, stateId, formatName, columns, brandConfigs);

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

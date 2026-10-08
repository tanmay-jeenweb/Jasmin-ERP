const {
    getAllPriceListTemplates,
    getPriceListTemplateById,
    createPriceListTemplate,
    updatePriceListTemplate,
    deletePriceListTemplate,
    getDistinctFilterOptionsForVariation,
    getTemplateExportData
} = require('../models/priceListTemplateModel.js');
const { getVariationById } = require('../models/variationModel.js');
const { createAuditLog } = require('../models/auditLogModel.js');
const { checkUserStateAccess } = require('../utils/userStateHelper.js');
const { filterPriceListByLandingType } = require('../utils/landingTypeHelper.js');

const getAllTemplatesController = async (req, res) => {
    try {
        const includeDeleted = req.query.includeDeleted === 'true';
        const templates = await getAllPriceListTemplates(includeDeleted);

        // Filter templates based on user state access permissions
        const accessibleTemplates = [];
        for (const t of templates) {
            const hasAccess = await checkUserStateAccess(req.user, t.state_ids || t.state_id, t.state_name);
            if (hasAccess) {
                accessibleTemplates.push(t);
            }
        }

        res.status(200).json({
            success: true,
            data: accessibleTemplates
        });
    } catch (error) {
        console.error('Error fetching price list templates:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getTemplateByIdController = async (req, res) => {
    try {
        const { id } = req.params;
        const template = await getPriceListTemplateById(id);
        if (!template) {
            return res.status(404).json({ success: false, message: 'Price list template not found' });
        }

        const hasAccess = await checkUserStateAccess(req.user, template.state_ids || template.state_id, template.state_name);
        if (!hasAccess) {
            return res.status(403).json({ success: false, message: 'Access denied: You are not authorized for this state' });
        }

        res.status(200).json({
            success: true,
            data: template
        });
    } catch (error) {
        console.error('Error fetching price list template by id:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const createTemplateController = async (req, res) => {
    try {
        const { template_name, variation_id, columns } = req.body;
        const addedBy = req.user?.id;
        const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';

        if (!template_name || !String(template_name).trim()) {
            return res.status(400).json({ success: false, message: 'Template name is required' });
        }

        if (!variation_id) {
            return res.status(400).json({ success: false, message: 'Pricelist selection is required' });
        }

        if (!Array.isArray(columns) || columns.length === 0) {
            return res.status(400).json({ success: false, message: 'At least one column must be selected' });
        }

        // Verify variation exists & access
        const variation = await getVariationById(variation_id);
        if (!variation) {
            return res.status(404).json({ success: false, message: 'Selected Price List format not found' });
        }

        const hasAccess = await checkUserStateAccess(req.user, variation.state_ids || variation.state_id, variation.state_name);
        if (!hasAccess) {
            return res.status(403).json({ success: false, message: 'Access denied: You are not authorized for this state' });
        }

        const result = await createPriceListTemplate(
            template_name.trim(),
            variation_id,
            columns,
            addedBy,
            deviceId
        );

        const newTemplate = {
            id: result.insertId,
            template_name: template_name.trim(),
            variation_id,
            columns,
            format_name: variation.format_name,
            added_by: addedBy
        };

        try {
            await createAuditLog(
                addedBy,
                req.user?.name || req.user?.username || 'Unknown',
                deviceId,
                'Price List Template Master',
                'created',
                null,
                newTemplate
            );
        } catch (auditErr) {
            console.warn('Audit log creation failed for template:', auditErr.message);
        }

        res.status(201).json({
            success: true,
            message: 'Price list template created successfully',
            data: newTemplate
        });
    } catch (error) {
        console.error('Error creating price list template:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const updateTemplateController = async (req, res) => {
    try {
        const { id } = req.params;
        const { template_name, variation_id, columns } = req.body;
        const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';

        const existing = await getPriceListTemplateById(id);
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Price list template not found' });
        }

        if (!template_name || !String(template_name).trim()) {
            return res.status(400).json({ success: false, message: 'Template name is required' });
        }

        if (!variation_id) {
            return res.status(400).json({ success: false, message: 'Pricelist selection is required' });
        }

        if (!Array.isArray(columns) || columns.length === 0) {
            return res.status(400).json({ success: false, message: 'At least one column must be selected' });
        }

        const variation = await getVariationById(variation_id);
        if (!variation) {
            return res.status(404).json({ success: false, message: 'Selected Price List format not found' });
        }

        const hasAccess = await checkUserStateAccess(req.user, variation.state_ids || variation.state_id, variation.state_name);
        if (!hasAccess) {
            return res.status(403).json({ success: false, message: 'Access denied: You are not authorized for this state' });
        }

        await updatePriceListTemplate(id, template_name.trim(), variation_id, columns);

        try {
            await createAuditLog(
                req.user?.id,
                req.user?.name || req.user?.username || 'Unknown',
                deviceId,
                'Price List Template Master',
                'updated',
                existing,
                { id, template_name: template_name.trim(), variation_id, columns }
            );
        } catch (auditErr) {
            console.warn('Audit log update failed for template:', auditErr.message);
        }

        res.status(200).json({
            success: true,
            message: 'Price list template updated successfully'
        });
    } catch (error) {
        console.error('Error updating price list template:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const deleteTemplateController = async (req, res) => {
    try {
        const { id } = req.params;
        const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';

        const existing = await getPriceListTemplateById(id);
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Price list template not found' });
        }

        await deletePriceListTemplate(id);

        try {
            await createAuditLog(
                req.user?.id,
                req.user?.name || req.user?.username || 'Unknown',
                deviceId,
                'Price List Template Master',
                'deleted',
                existing,
                { id, is_deleted: true }
            );
        } catch (auditErr) {
            console.warn('Audit log delete failed for template:', auditErr.message);
        }

        res.status(200).json({
            success: true,
            message: 'Price list template deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting price list template:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

/**
 * Controller to fetch distinct Brands and Categories available for a given template's price list
 */
const getTemplateFilterOptionsController = async (req, res) => {
    try {
        const { id } = req.params;
        const template = await getPriceListTemplateById(id);
        if (!template) {
            return res.status(404).json({ success: false, message: 'Price list template not found' });
        }

        const hasAccess = await checkUserStateAccess(req.user, template.state_ids || template.state_id, template.state_name);
        if (!hasAccess) {
            return res.status(403).json({ success: false, message: 'Access denied: You are not authorized for this state' });
        }

        const options = await getDistinctFilterOptionsForVariation(template.variation_id);

        res.status(200).json({
            success: true,
            template,
            brands: options.brands,
            categories: options.categories,
            dates: options.dates || [],
            timestamps: options.timestamps || []
        });
    } catch (error) {
        console.error('Error fetching template filter options:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

/**
 * Controller to fetch DB data for template export, filtered by selected brands, categories, and date
 */
const getTemplateExportDataController = async (req, res) => {
    try {
        const { id } = req.params;
        const { brands, categories, date, distinctModelGroup } = req.body;

        const template = await getPriceListTemplateById(id);
        if (!template) {
            return res.status(404).json({ success: false, message: 'Price list template not found' });
        }

        const hasAccess = await checkUserStateAccess(req.user, template.state_ids || template.state_id, template.state_name);
        if (!hasAccess) {
            return res.status(403).json({ success: false, message: 'Access denied: You are not authorized for this state' });
        }

        // Fetch filtered data directly from MySQL table (live or historical snapshot)
        const rawData = await getTemplateExportData(
            template.variation_id,
            brands || [],
            categories || [],
            date || null
        );

        // Dynamic columns defined on template: separate standard vs custom
        const templateColumns = Array.isArray(template.columns) ? template.columns : [];

        // Dynamic custom columns to check for landing type authorization
        const customColDefs = templateColumns
            .filter(c => c.type !== 'standard')
            .map(c => ({
                column_name: c.key || c.column_name,
                landing_types: c.landing_types || ["All"]
            }));

        const { columns: allowedCustomCols, data: filteredData } = filterPriceListByLandingType(
            customColDefs,
            rawData,
            req.user
        );

        const allowedCustomNames = new Set(allowedCustomCols.map(c => c.column_name));

        // Filter final template columns list based on landing type permissions
        const finalExportColumns = templateColumns.filter(c => {
            if (c.type === 'standard') return true;
            const colName = c.key || c.column_name;
            return allowedCustomNames.has(colName);
        });

        // Deduplication for model_group_name:
        // If template has model_group_name column and distinctModelGroup is not explicitly false,
        // deduplicate rows by model_group_name keeping the first color/variant record
        const hasModelGroupCol = templateColumns.some(
            c => (c.key || c.column_name) === 'model_group_name'
        );

        let finalData = filteredData;
        const shouldDeduplicate = hasModelGroupCol && distinctModelGroup !== false && distinctModelGroup !== 'false';

        if (shouldDeduplicate && Array.isArray(finalData)) {
            const seenGroups = new Set();
            const deduplicated = [];
            for (const row of finalData) {
                const rawGroup = row.model_group_name || '';
                const groupKey = rawGroup ? String(rawGroup).trim().toLowerCase() : null;
                if (groupKey) {
                    if (!seenGroups.has(groupKey)) {
                        seenGroups.add(groupKey);
                        deduplicated.push(row);
                    }
                } else {
                    deduplicated.push(row);
                }
            }
            finalData = deduplicated;
        }

        res.status(200).json({
            success: true,
            template: {
                id: template.id,
                template_name: template.template_name,
                format_name: template.format_name,
                variation_id: template.variation_id
            },
            columns: finalExportColumns,
            data: finalData
        });
    } catch (error) {
        console.error('Error fetching template export data:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

module.exports = {
    getAllTemplatesController,
    getTemplateByIdController,
    createTemplateController,
    updateTemplateController,
    deleteTemplateController,
    getTemplateFilterOptionsController,
    getTemplateExportDataController
};

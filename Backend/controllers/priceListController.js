const { getVariationById } = require('../models/variationModel.js');
const { getPriceListData, upsertPriceListData, getPriceListReportData } = require('../models/priceListModel.js');
const { createAuditLog } = require('../models/auditLogModel.js');

const getPriceListDataController = async (req, res) => {
    try {
        const { variationId } = req.params;
        
        // 1. Fetch variation metadata
        const variation = await getVariationById(variationId);
        if (!variation) {
            return res.status(404).json({ success: false, message: 'Price List format not found' });
        }

        // Parse columns configuration
        const columns = Array.isArray(variation.columns)
            ? variation.columns
            : typeof variation.columns === 'string'
            ? JSON.parse(variation.columns)
            : [];

        // 2. Fetch data from dynamic table
        let data = [];
        try {
            data = await getPriceListData(variationId);
        } catch (err) {
            console.warn(`Dynamic table for format ${variationId} might not exist yet:`, err.message);
            // Table might not exist if it hasn't been initialized or has no records
        }

        res.status(200).json({
            success: true,
            columns,
            formatName: variation.format_name || `${variation.state_name} format`,
            data
        });
    } catch (error) {
        console.error('Error fetching price list data:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const importPriceListController = async (req, res) => {
    try {
        const { variationId } = req.params;
        const { records } = req.body;
        const addedBy = req.user.id;
        const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';

        if (!records || !Array.isArray(records)) {
            return res.status(400).json({ success: false, message: 'Invalid payload: records array is required' });
        }

        // 1. Fetch variation metadata to validate columns
        const variation = await getVariationById(variationId);
        if (!variation) {
            return res.status(404).json({ success: false, message: 'Price List format not found' });
        }

        const columns = Array.isArray(variation.columns)
            ? variation.columns
            : typeof variation.columns === 'string'
            ? JSON.parse(variation.columns)
            : [];

        // 2. Perform bulk upsert
        await upsertPriceListData(variationId, columns, records, addedBy, deviceId);

        // 3. Create Audit Log
        await createAuditLog(
            addedBy,
            req.user?.name || req.user?.username || 'Unknown',
            deviceId,
            'Price List',
            'imported',
            { variation_id: variationId, count: records.length },
            null
        );

        res.status(200).json({
            success: true,
            message: `Successfully imported ${records.length} records.`
        });
    } catch (error) {
        console.error('Error importing price list:', error);
        res.status(500).json({ success: false, message: error.message || 'Internal server error' });
    }
};

const getPriceListReportController = async (req, res) => {
    try {
        const { variationId } = req.params;

        // 1. Fetch variation metadata
        const variation = await getVariationById(variationId);
        if (!variation) {
            return res.status(404).json({ success: false, message: 'Price List format not found' });
        }

        // Parse columns configuration
        const columns = Array.isArray(variation.columns)
            ? variation.columns
            : typeof variation.columns === 'string'
            ? JSON.parse(variation.columns)
            : [];

        // 2. Fetch report data (grouped by model_group_name + active offers)
        let data = [];
        try {
            data = await getPriceListReportData(variationId);
        } catch (err) {
            console.warn(`Dynamic table for format ${variationId} report error:`, err.message);
        }

        res.status(200).json({
            success: true,
            columns,
            formatName: variation.format_name || `${variation.state_name} format`,
            data
        });
    } catch (error) {
        console.error('Error fetching price list report data:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

module.exports = {
    getPriceListDataController,
    importPriceListController,
    getPriceListReportController
};

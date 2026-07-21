const { getVariationById } = require('../models/variationModel.js');
const { getPriceListData, upsertPriceListData, getPriceListReportData } = require('../models/priceListModel.js');
const { createAuditLog } = require('../models/auditLogModel.js');
const db = require('../config/db.js');

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
            console.warn(`Dynamic table for format ${variationId} fetch error:`, err.message);
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

        if (!records || !Array.isArray(records) || records.length === 0) {
            return res.status(400).json({ success: false, message: 'No records provided for import.' });
        }

        // 1. Fetch variation metadata to validate columns
        const variation = await getVariationById(variationId);
        if (!variation) {
            return res.status(404).json({ success: false, message: 'Price List format not found' });
        }

        // 2. Upsert data records
        await upsertPriceListData(variationId, records);

        // Audit Log
        const addedBy = req.user?.id;
        const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';
        await createAuditLog(
            addedBy,
            'Price List Data Imported',
            'PRICE_LIST_IMPORT',
            `Imported ${records.length} records into format ID ${variationId} (${variation.format_name || variation.state_name})`,
            deviceId
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

const getModelGroupStockInfoController = async (req, res) => {
    try {
        const { modelGroup } = req.query;
        if (!modelGroup) {
            return res.status(400).json({ success: false, message: 'Model group parameter is required' });
        }

        // 1. Fetch item_codes and model_names belonging to this model group from database
        let modelGroupItemCodes = new Set();
        let modelNames = [];
        try {
            const [rows] = await db.execute(
                `SELECT item_code, model_name FROM item_model_master WHERE LOWER(TRIM(model_group_name)) = LOWER(TRIM(?))`,
                [modelGroup]
            );
            rows.forEach(r => {
                if (r.item_code) modelGroupItemCodes.add(String(r.item_code).trim().toLowerCase());
                if (r.model_name) modelNames.push(String(r.model_name).trim().toLowerCase());
            });
        } catch (e) {
            console.warn("Could not query item_model_master for model group stock filtering:", e.message);
        }

        // 2. Fetch external stock data from APX API
        const encodedMg = encodeURIComponent(modelGroup);
        const apiUrl = `https://apxwapi.jasminmobile.com:81/api/apxapi/GetStockInfo?CompanyCode=JITPL&ItemClassificationValue=${encodedMg}`;

        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'userid': process.env.MODEL_API_USERID || 'WebSite',
                'Securitycode': process.env.MODEL_API_SECURITYCODE || '1151-8111-6444-4166',
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            return res.status(response.status).json({
                success: false,
                message: `Failed to fetch from external API: Server returned ${response.statusText}`
            });
        }

        const result = await response.json();

        if (result.StatusCode !== 0) {
            return res.status(400).json({
                success: false,
                message: `External API Error: ${result.StatusMessage || 'Unknown error'}`
            });
        }

        const rawItems = result.Data || [];

        // 3. Filter stock data strictly to devices belonging to this model group
        let filteredItems = rawItems;
        if (modelGroupItemCodes.size > 0) {
            filteredItems = rawItems.filter(item => {
                const itemCode = String(item.ITEM_CODE || "").trim().toLowerCase();
                const itemName = String(item.ITEM_NAME || "").trim().toLowerCase();

                // Match exact item_code
                if (modelGroupItemCodes.has(itemCode)) return true;

                // Or match if item_name contains any model name of this model group
                if (modelNames.some(mn => mn && mn.length > 2 && itemName.includes(mn))) return true;

                return false;
            });
        } else {
            // Fallback substring filter if model_group_name isn't in item_model_master
            const groupLower = String(modelGroup).trim().toLowerCase();
            filteredItems = rawItems.filter(item => {
                const itemName = String(item.ITEM_NAME || "").trim().toLowerCase();
                return itemName.includes(groupLower);
            });
        }

        return res.status(200).json({
            success: true,
            data: filteredItems
        });
    } catch (error) {
        console.error('Error in getModelGroupStockInfoController:', error);
        return res.status(500).json({ success: false, message: error.message || 'Internal server error' });
    }
};

module.exports = {
    getPriceListDataController,
    importPriceListController,
    getPriceListReportController,
    getModelGroupStockInfoController
};

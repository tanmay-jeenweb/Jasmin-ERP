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

const evaluateFormulasForRecords = async (variationId, columnsList, brandConfigs, records) => {
    if (!columnsList || !Array.isArray(columnsList) || columnsList.length === 0) return records;

    const formulaCols = columnsList.filter(c => c.type === 'default formulation' || c.type === 'formulation');
    if (formulaCols.length === 0) return records;

    // Fetch existing database rows to merge previous values if columns were omitted from import
    let existingMap = new Map();
    try {
        const existingRows = await getPriceListData(variationId);
        if (Array.isArray(existingRows)) {
            existingRows.forEach(r => {
                if (r.product_code) {
                    existingMap.set(String(r.product_code).trim(), r);
                }
            });
        }
    } catch (e) {
        // Dynamic table may not exist yet or be empty
    }

    const evaluateSingleFormula = (rawFormula, rec) => {
        if (!rawFormula || typeof rawFormula !== 'string') return "";

        let expr = rawFormula.trim();
        if (expr.startsWith('=')) expr = expr.substring(1).trim();

        // Handle IFERROR(formula, fallback)
        const ifErrorMatch = expr.match(/^IFERROR\s*\(\s*(.+)\s*,\s*".*"\s*\)$/i);
        if (ifErrorMatch) {
            expr = ifErrorMatch[1].trim();
        }

        // Sort columns by column_id length descending (e.g. AA before A)
        const sortedCols = [...columnsList].sort((a, b) => (b.column_id || '').length - (a.column_id || '').length);

        for (const col of sortedCols) {
            const colId = col.column_id;
            const colName = col.column_name;
            if (!colId) continue;

            let val = rec[colName];
            if (val === undefined || val === null || val === "") {
                val = 0;
            } else if (typeof val === 'string') {
                const cleanedVal = val.replace(/,/g, '').trim();
                val = !isNaN(Number(cleanedVal)) ? Number(cleanedVal) : 0;
            } else if (typeof val !== 'number') {
                val = 0;
            }

            // Replace cell references like F2, F12, F (case-insensitive word boundaries)
            const cellRefRegex = new RegExp(`\\b${colId}\\d*\\b`, 'gi');
            expr = expr.replace(cellRefRegex, `(${val})`);

            // Replace column name if referenced directly
            if (colName && colName !== colId) {
                const escapedName = colName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                const colNameRegex = new RegExp(`\\[?${escapedName}\\]?`, 'gi');
                expr = expr.replace(colNameRegex, `(${val})`);
            }
        }

        // Replace Excel IF(cond, val1, val2) with JS ternary ((cond) ? (val1) : (val2))
        expr = expr.replace(/IF\s*\(([^,]+),([^,]+),([^)]+)\)/gi, '(($1) ? ($2) : ($3))');
        
        // Replace ROUND(val, decimals) with Math.round
        expr = expr.replace(/ROUND\s*\(([^,]+),([^)]+)\)/gi, '(Math.round(($1) * Math.pow(10, $2)) / Math.pow(10, $2))');
        expr = expr.replace(/ROUND\s*\(([^)]+)\)/gi, '(Math.round($1))');

        // Replace SUM(a, b, ...)
        expr = expr.replace(/SUM\s*\(([^)]+)\)/gi, '($1)'.replace(/,/g, '+'));

        // Replace single = with === in conditions
        expr = expr.replace(/([^=><!])=([^=])/g, '$1===$2');

        try {
            const safeResult = new Function(`"use strict"; return (${expr});`)();
            if (typeof safeResult === 'number' && !isNaN(safeResult) && isFinite(safeResult)) {
                return Math.round(safeResult * 10000) / 10000;
            }
            return safeResult !== undefined && safeResult !== null ? String(safeResult) : "";
        } catch (e) {
            return "";
        }
    };

    for (const rec of records) {
        const prodCode = rec.product_code ? String(rec.product_code).trim() : "";
        const existingRow = existingMap.get(prodCode);

        // Merge existing database column values if omitted or '-' or empty in imported record
        if (existingRow) {
            columnsList.forEach(c => {
                const val = rec[c.column_name];
                const isUnchangedOrEmpty = val === undefined || val === null || val === "" || String(val).trim() === "-";
                if (isUnchangedOrEmpty && existingRow[c.column_name] !== undefined && existingRow[c.column_name] !== null) {
                    rec[c.column_name] = existingRow[c.column_name];
                }
            });
        }

        // Determine brand override formulas if applicable
        const recBrand = rec.brand ? String(rec.brand).trim().toUpperCase() : "";
        let brandOverrideMap = new Map();
        if (recBrand && Array.isArray(brandConfigs)) {
            const matchingConfig = brandConfigs.find(cfg =>
                cfg.brands && Array.isArray(cfg.brands) && cfg.brands.some(b => String(b).trim().toUpperCase() === recBrand)
            );
            if (matchingConfig && Array.isArray(matchingConfig.columns)) {
                matchingConfig.columns.forEach(c => {
                    if (c.column_id && c.formula) {
                        brandOverrideMap.set(c.column_id, c.formula);
                    }
                });
            }
        }

        // Evaluate formulation columns (up to 3 passes for chained dependencies)
        const passes = Math.min(formulaCols.length, 3);
        for (let pass = 0; pass < passes; pass++) {
            for (const col of formulaCols) {
                const formulaToUse = brandOverrideMap.get(col.column_id) || col.formula;
                if (formulaToUse) {
                    const computedVal = evaluateSingleFormula(formulaToUse, rec);
                    if (computedVal !== "" && computedVal !== null && computedVal !== undefined) {
                        rec[col.column_name] = computedVal;
                    }
                }
            }
        }
    }

    return records;
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

        const columnsList = Array.isArray(variation.columns)
            ? variation.columns
            : typeof variation.columns === 'string'
                ? JSON.parse(variation.columns)
                : [];

        const brandConfigs = Array.isArray(variation.brand_configs)
            ? variation.brand_configs
            : typeof variation.brand_configs === 'string'
                ? JSON.parse(variation.brand_configs)
                : [];

        const addedBy = req.user?.id;
        const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';

        // 2. Automatically evaluate formulation columns for all imported records
        const processedRecords = await evaluateFormulasForRecords(variationId, columnsList, brandConfigs, records);

        // 3. Upsert data records
        await upsertPriceListData(variationId, columnsList, processedRecords, addedBy, deviceId);

        // Audit Log
        await createAuditLog(
            addedBy,
            'Price List Data Imported',
            'PRICE_LIST_IMPORT',
            `Imported ${processedRecords.length} records into format ID ${variationId} (${variation.format_name || variation.state_name})`,
            deviceId
        );

        res.status(200).json({
            success: true,
            message: `Successfully imported ${processedRecords.length} records.`
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

const { getStockCacheByModelGroup, saveStockCache } = require('../models/stockCacheModel.js');

const getModelGroupStockInfoController = async (req, res) => {
    try {
        const { modelGroup, sync } = req.query;
        if (!modelGroup) {
            return res.status(400).json({ success: false, message: 'Model group parameter is required' });
        }

        const isForceSync = sync === 'true' || sync === '1';

        // 1. If not forcing sync, check database cache first
        if (!isForceSync) {
            const cached = await getStockCacheByModelGroup(modelGroup);
            if (cached) {
                return res.status(200).json({
                    success: true,
                    data: cached.data,
                    isCached: true,
                    updatedAt: cached.updatedAt,
                    totalLocations: cached.totalLocations,
                    totalStock: cached.totalStock
                });
            }
        }

        // 2. Query item_model_master for model group codes/names
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

        // 3. Fetch external stock data from APX API
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
            const cached = await getStockCacheByModelGroup(modelGroup);
            if (cached) {
                return res.status(200).json({
                    success: true,
                    data: cached.data,
                    isCached: true,
                    updatedAt: cached.updatedAt,
                    warning: `APX API failed (${response.statusText}). Displaying saved DB stock data.`
                });
            }
            return res.status(response.status).json({
                success: false,
                message: `Failed to fetch from external API: Server returned ${response.statusText}`
            });
        }

        const result = await response.json();

        if (result.StatusCode !== 0) {
            const cached = await getStockCacheByModelGroup(modelGroup);
            if (cached) {
                return res.status(200).json({
                    success: true,
                    data: cached.data,
                    isCached: true,
                    updatedAt: cached.updatedAt,
                    warning: `APX API Error: ${result.StatusMessage || 'Unknown error'}. Displaying saved DB stock data.`
                });
            }
            return res.status(400).json({
                success: false,
                message: `External API Error: ${result.StatusMessage || 'Unknown error'}`
            });
        }

        const rawItems = result.Data || [];

        // 4. Filter stock data strictly to devices belonging to this model group
        let filteredItems = rawItems;
        if (modelGroupItemCodes.size > 0) {
            filteredItems = rawItems.filter(item => {
                const itemCode = String(item.ITEM_CODE || "").trim().toLowerCase();
                const itemName = String(item.ITEM_NAME || "").trim().toLowerCase();

                if (modelGroupItemCodes.has(itemCode)) return true;
                if (modelNames.some(mn => mn && mn.length > 2 && itemName.includes(mn))) return true;

                return false;
            });
        } else {
            const groupLower = String(modelGroup).trim().toLowerCase();
            filteredItems = rawItems.filter(item => {
                const itemName = String(item.ITEM_NAME || "").trim().toLowerCase();
                return itemName.includes(groupLower);
            });
        }

        // Calculate metrics
        const validItems = filteredItems.filter(i => Number(i.SALEABLE_STOCK || 0) >= 1);
        const uniqueBranches = new Set(validItems.map(i => (i.BRANCH_NAME || i.BRANCH_CODE || "").trim()));
        const totalStockSum = validItems.reduce((acc, i) => acc + Number(i.SALEABLE_STOCK || 0), 0);

        // 5. Save to database cache
        try {
            await saveStockCache(modelGroup, filteredItems, uniqueBranches.size, totalStockSum);
        } catch (e) {
            console.error("Failed to save stock cache to database:", e.message);
        }

        return res.status(200).json({
            success: true,
            data: filteredItems,
            isCached: false,
            updatedAt: new Date(),
            totalLocations: uniqueBranches.size,
            totalStock: totalStockSum
        });
    } catch (error) {
        console.error('Error in getModelGroupStockInfoController:', error);
        try {
            const { modelGroup } = req.query;
            if (modelGroup) {
                const cached = await getStockCacheByModelGroup(modelGroup);
                if (cached) {
                    return res.status(200).json({
                        success: true,
                        data: cached.data,
                        isCached: true,
                        updatedAt: cached.updatedAt,
                        warning: `Connection issue: ${error.message}. Displaying saved DB stock data.`
                    });
                }
            }
        } catch (e) {
            // Ignore fallback error
        }
        return res.status(500).json({ success: false, message: error.message || 'Internal server error' });
    }
};

module.exports = {
    getPriceListDataController,
    importPriceListController,
    getPriceListReportController,
    getModelGroupStockInfoController
};

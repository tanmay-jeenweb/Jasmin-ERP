const db = require('../config/db.js');
const { getSetting } = require('./settingModel.js');

const filterByIcatSettings = async (records) => {
    if (!records || records.length === 0) return records;
    try {
        const rawSettings = await getSetting('icat_settings');
        if (!rawSettings) return records;
        const settings = JSON.parse(rawSettings);
        return records.filter(row => {
            const icat = row.icat_name;
            if (!icat) return true;
            return settings[icat] !== false;
        });
    } catch (error) {
        console.error('Error filtering records by ICAT settings in template model:', error);
        return records;
    }
};

const roundRowDecimals = (row) => {
    if (!row || typeof row !== 'object') return row;
    const nonNumericKeys = new Set([
        'id', 'product_code', 'brand', 'icat_name', 'original_icat_name', 'product_category',
        'model_group_name', 'model_name', 'added_by', 'device_id', 'timestamp',
        'updated_at', 'active_offers', 'state_id', 'state_ids', 'product_name', 'imm_product_name'
    ]);
    for (const [key, val] of Object.entries(row)) {
        if (nonNumericKeys.has(key)) continue;
        if (val !== undefined && val !== null && String(val).trim() !== '' && String(val).trim() !== '-' && String(val).trim() !== '—') {
            const num = Number(val);
            if (!isNaN(num) && typeof val !== 'boolean') {
                row[key] = Math.round(num * 100) / 100;
            }
        }
    }
    return row;
};

const createPriceListTemplateTable = async () => {
    const query = `
        CREATE TABLE IF NOT EXISTS price_list_template_master (
            id INT AUTO_INCREMENT PRIMARY KEY,
            template_name VARCHAR(255) NOT NULL,
            variation_id INT NOT NULL,
            columns JSON NOT NULL,
            added_by INT NOT NULL,
            device_id VARCHAR(255) DEFAULT 'Unknown',
            is_deleted BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (variation_id) REFERENCES variation_master(id) ON DELETE CASCADE,
            FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    await db.execute(query);
    console.log("Price List Template Master table ready");
};

const getAllPriceListTemplates = async (includeDeleted = false) => {
    const query = `
        SELECT 
            plt.*,
            v.format_name,
            v.state_id,
            v.state_ids,
            sm.name AS state_name,
            u.name AS added_by_name,
            u.username AS added_by_username
        FROM price_list_template_master plt
        LEFT JOIN variation_master v ON plt.variation_id = v.id
        LEFT JOIN state_master sm ON v.state_id = sm.id
        LEFT JOIN users u ON plt.added_by = u.id
        WHERE ${includeDeleted ? '1=1' : 'plt.is_deleted = FALSE'}
        ORDER BY plt.id DESC
    `;
    const [rows] = await db.execute(query);
    return rows.map(r => {
        let parsedColumns = [];
        try {
            parsedColumns = typeof r.columns === 'string' ? JSON.parse(r.columns) : (r.columns || []);
        } catch (e) {
            parsedColumns = [];
        }
        return {
            ...r,
            columns: parsedColumns
        };
    });
};

const getPriceListTemplateById = async (id) => {
    const query = `
        SELECT 
            plt.*,
            v.format_name,
            v.state_id,
            v.state_ids,
            v.columns AS variation_columns,
            sm.name AS state_name,
            u.name AS added_by_name
        FROM price_list_template_master plt
        LEFT JOIN variation_master v ON plt.variation_id = v.id
        LEFT JOIN state_master sm ON v.state_id = sm.id
        LEFT JOIN users u ON plt.added_by = u.id
        WHERE plt.id = ?
    `;
    const [rows] = await db.execute(query, [id]);
    if (rows.length === 0) return null;
    const r = rows[0];
    let parsedColumns = [];
    try {
        parsedColumns = typeof r.columns === 'string' ? JSON.parse(r.columns) : (r.columns || []);
    } catch (e) {
        parsedColumns = [];
    }

    let parsedVarColumns = [];
    try {
        parsedVarColumns = typeof r.variation_columns === 'string' ? JSON.parse(r.variation_columns) : (r.variation_columns || []);
    } catch (e) {
        parsedVarColumns = [];
    }

    return {
        ...r,
        columns: parsedColumns,
        variation_columns: parsedVarColumns
    };
};

const createPriceListTemplate = async (template_name, variation_id, columns, added_by, device_id = 'Unknown') => {
    const columnsJson = JSON.stringify(columns || []);
    const query = `
        INSERT INTO price_list_template_master 
            (template_name, variation_id, columns, added_by, device_id)
        VALUES (?, ?, ?, ?, ?)
    `;
    const [result] = await db.execute(query, [
        template_name.trim(),
        variation_id,
        columnsJson,
        added_by,
        device_id
    ]);
    return result;
};

const updatePriceListTemplate = async (id, template_name, variation_id, columns) => {
    const columnsJson = JSON.stringify(columns || []);
    const query = `
        UPDATE price_list_template_master
        SET template_name = ?,
            variation_id = ?,
            columns = ?
        WHERE id = ?
    `;
    const [result] = await db.execute(query, [
        template_name.trim(),
        variation_id,
        columnsJson,
        id
    ]);
    return result;
};

const deletePriceListTemplate = async (id) => {
    const query = `
        UPDATE price_list_template_master
        SET is_deleted = TRUE
        WHERE id = ?
    `;
    const [result] = await db.execute(query, [id]);
    return result;
};

/**
 * Gets distinct brands, product categories, and available snapshot dates for a variation
 */
const getDistinctFilterOptionsForVariation = async (variationId) => {
    const tableName = `price_list_format_${variationId}`;
    const historyTableName = `price_list_format_history_${variationId}`;
    try {
        const query = `
            SELECT DISTINCT 
                p.brand, 
                COALESCE(imm.product_name, p.icat_name) AS icat_name
            FROM \`${tableName}\` p
            LEFT JOIN item_model_master imm ON p.product_code = imm.item_code
            WHERE imm.item_status IS NULL OR LOWER(imm.item_status) != 'inactive'
            ORDER BY p.brand ASC
        `;
        const [rows] = await db.execute(query);
        const filteredRows = await filterByIcatSettings(rows);

        const brands = new Set();
        const categories = new Set();

        filteredRows.forEach(row => {
            if (row.brand && String(row.brand).trim()) {
                brands.add(String(row.brand).trim());
            }
            if (row.icat_name && String(row.icat_name).trim()) {
                categories.add(String(row.icat_name).trim());
            }
        });

        // Retrieve available recorded snapshot dates from history table
        let availableDates = [];
        try {
            const [dateRows] = await db.execute(`
                SELECT DISTINCT DATE_FORMAT(timestamp, '%Y-%m-%d') AS date_part
                FROM \`${historyTableName}\`
                ORDER BY date_part DESC
            `);
            availableDates = dateRows.map(r => r.date_part).filter(Boolean);
        } catch (dateErr) {
            availableDates = [];
        }

        return {
            brands: Array.from(brands).sort(),
            categories: Array.from(categories).sort(),
            dates: availableDates
        };
    } catch (e) {
        console.warn(`Could not get distinct filter options from ${tableName}:`, e.message);
        return { brands: [], categories: [], dates: [] };
    }
};

/**
 * Fetches filtered records for template export based on chosen brands, categories, and optional targetDate
 */
const getTemplateExportData = async (variationId, selectedBrands = [], selectedCategories = [], targetDate = null) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const isHistorical = Boolean(targetDate && typeof targetDate === 'string' && targetDate.trim() !== '');

    let tableName = `price_list_format_${variationId}`;
    if (isHistorical) {
        tableName = `price_list_format_history_${variationId}`;
    }

    try {
        let whereClauses = [
            `(imm.item_status IS NULL OR LOWER(imm.item_status) != 'inactive')`
        ];
        const params = [];

        if (isHistorical) {
            const dateOnly = targetDate.trim().split(' ')[0].split('T')[0];
            whereClauses.push(`DATE_FORMAT(p.timestamp, '%Y-%m-%d') = ?`);
            params.push(dateOnly);
        }

        if (Array.isArray(selectedBrands) && selectedBrands.length > 0) {
            const placeholders = selectedBrands.map(() => '?').join(', ');
            whereClauses.push(`p.brand IN (${placeholders})`);
            params.push(...selectedBrands);
        }

        if (Array.isArray(selectedCategories) && selectedCategories.length > 0) {
            const placeholders = selectedCategories.map(() => '?').join(', ');
            whereClauses.push(`(COALESCE(imm.product_name, p.icat_name) IN (${placeholders}) OR p.icat_name IN (${placeholders}))`);
            params.push(...selectedCategories, ...selectedCategories);
        }

        let query = `
            SELECT p.*, 
                   COALESCE(imm.product_name, p.icat_name) AS icat_name,
                   p.icat_name AS original_icat_name,
                   COALESCE(imm.product_name, p.icat_name) AS product_category,
                   imm.product_name AS imm_product_name
            FROM \`${tableName}\` p
            LEFT JOIN item_model_master imm ON p.product_code = imm.item_code
            WHERE ${whereClauses.join(' AND ')}
            ORDER BY p.timestamp DESC, p.brand ASC, imm.product_name ASC, p.model_name ASC
        `;

        let [results] = await db.execute(query, params);

        // Fallback for historical date: if no exact date match, query records up to cutoff timestamp (end of selected date)
        if (isHistorical && results.length === 0) {
            const dateOnly = targetDate.trim().split(' ')[0].split('T')[0];
            const cutoffTimestamp = `${dateOnly} 23:59:59`;
            
            let fallbackClauses = [
                `(imm.item_status IS NULL OR LOWER(imm.item_status) != 'inactive')`,
                `p.timestamp <= ?`
            ];
            const fallbackParams = [cutoffTimestamp];

            if (Array.isArray(selectedBrands) && selectedBrands.length > 0) {
                const placeholders = selectedBrands.map(() => '?').join(', ');
                fallbackClauses.push(`p.brand IN (${placeholders})`);
                fallbackParams.push(...selectedBrands);
            }

            if (Array.isArray(selectedCategories) && selectedCategories.length > 0) {
                const placeholders = selectedCategories.map(() => '?').join(', ');
                fallbackClauses.push(`(COALESCE(imm.product_name, p.icat_name) IN (${placeholders}) OR p.icat_name IN (${placeholders}))`);
                fallbackParams.push(...selectedCategories, ...selectedCategories);
            }

            const fallbackQuery = `
                SELECT p.*, 
                       COALESCE(imm.product_name, p.icat_name) AS icat_name,
                       p.icat_name AS original_icat_name,
                       COALESCE(imm.product_name, p.icat_name) AS product_category,
                       imm.product_name AS imm_product_name
                FROM \`${tableName}\` p
                LEFT JOIN item_model_master imm ON p.product_code = imm.item_code
                WHERE ${fallbackClauses.join(' AND ')}
                ORDER BY p.timestamp DESC, p.brand ASC, imm.product_name ASC, p.model_name ASC
            `;
            const [fallbackResults] = await db.execute(fallbackQuery, fallbackParams);
            results = fallbackResults;
        }

        // Fallback to live table if historical date >= todayStr and history had no rows
        if (isHistorical && results.length === 0 && targetDate.trim().split(' ')[0].split('T')[0] >= todayStr) {
            const liveTableName = `price_list_format_${variationId}`;
            let liveClauses = [
                `(imm.item_status IS NULL OR LOWER(imm.item_status) != 'inactive')`
            ];
            const liveParams = [];

            if (Array.isArray(selectedBrands) && selectedBrands.length > 0) {
                const placeholders = selectedBrands.map(() => '?').join(', ');
                liveClauses.push(`p.brand IN (${placeholders})`);
                liveParams.push(...selectedBrands);
            }

            if (Array.isArray(selectedCategories) && selectedCategories.length > 0) {
                const placeholders = selectedCategories.map(() => '?').join(', ');
                liveClauses.push(`(COALESCE(imm.product_name, p.icat_name) IN (${placeholders}) OR p.icat_name IN (${placeholders}))`);
                liveParams.push(...selectedCategories, ...selectedCategories);
            }

            const liveQuery = `
                SELECT p.*, 
                       COALESCE(imm.product_name, p.icat_name) AS icat_name,
                       p.icat_name AS original_icat_name,
                       COALESCE(imm.product_name, p.icat_name) AS product_category,
                       imm.product_name AS imm_product_name
                FROM \`${liveTableName}\` p
                LEFT JOIN item_model_master imm ON p.product_code = imm.item_code
                WHERE ${liveClauses.join(' AND ')}
                ORDER BY p.brand ASC, imm.product_name ASC, p.model_name ASC
            `;
            const [liveResults] = await db.execute(liveQuery, liveParams);
            results = liveResults;
        }

        // Deduplicate records by product_code keeping the latest update of that day
        if (isHistorical && results.length > 0) {
            const seenCodes = new Set();
            const deduplicated = [];
            for (const row of results) {
                if (!seenCodes.has(row.product_code)) {
                    seenCodes.add(row.product_code);
                    deduplicated.push(row);
                }
            }
            results = deduplicated;
        }

        return filterByIcatSettings(results.map(roundRowDecimals));
    } catch (error) {
        console.warn(`Template export error on table ${tableName}:`, error.message);
        return [];
    }
};

module.exports = {
    createPriceListTemplateTable,
    getAllPriceListTemplates,
    getPriceListTemplateById,
    createPriceListTemplate,
    updatePriceListTemplate,
    deletePriceListTemplate,
    getDistinctFilterOptionsForVariation,
    getTemplateExportData
};

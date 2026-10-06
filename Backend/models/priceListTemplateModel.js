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
        'id', 'product_code', 'brand', 'icat_name', 'model_group_name', 'model_name',
        'added_by', 'device_id', 'timestamp', 'updated_at', 'active_offers',
        'state_id', 'state_ids', 'product_name', 'imm_product_name'
    ]);
    for (const [key, val] of Object.entries(row)) {
        if (nonNumericKeys.has(key)) continue;
        if (val !== undefined && val !== null && val !== '' && val !== '-' && val !== '—') {
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
 * Gets distinct brands and product categories available for a specific variation
 */
const getDistinctFilterOptionsForVariation = async (variationId) => {
    const tableName = `price_list_format_${variationId}`;
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

        return {
            brands: Array.from(brands).sort(),
            categories: Array.from(categories).sort()
        };
    } catch (e) {
        console.warn(`Could not get distinct filter options from ${tableName}:`, e.message);
        return { brands: [], categories: [] };
    }
};

/**
 * Fetches filtered records for template export based on chosen brands and categories
 */
const getTemplateExportData = async (variationId, selectedBrands = [], selectedCategories = []) => {
    const tableName = `price_list_format_${variationId}`;
    try {
        let whereClauses = [
            `(imm.item_status IS NULL OR LOWER(imm.item_status) != 'inactive')`
        ];
        const params = [];

        if (Array.isArray(selectedBrands) && selectedBrands.length > 0) {
            const placeholders = selectedBrands.map(() => '?').join(', ');
            whereClauses.push(`p.brand IN (${placeholders})`);
            params.push(...selectedBrands);
        }

        if (Array.isArray(selectedCategories) && selectedCategories.length > 0) {
            const placeholders = selectedCategories.map(() => '?').join(', ');
            whereClauses.push(`COALESCE(imm.product_name, p.icat_name) IN (${placeholders})`);
            params.push(...selectedCategories);
        }

        const query = `
            SELECT p.*, COALESCE(imm.product_name, p.icat_name) AS icat_name
            FROM \`${tableName}\` p
            LEFT JOIN item_model_master imm ON p.product_code = imm.item_code
            WHERE ${whereClauses.join(' AND ')}
            ORDER BY p.brand ASC, imm.product_name ASC, p.model_name ASC
        `;

        const [results] = await db.execute(query, params);
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

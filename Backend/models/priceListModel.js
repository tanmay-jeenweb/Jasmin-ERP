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
        console.error('Error filtering records by ICAT settings:', error);
        return records;
    }
};

const getPriceListData = async (variationId) => {
    const tableName = `price_list_format_${variationId}`;
    const query = `
        SELECT p.*, COALESCE(imm.product_name, p.icat_name) AS icat_name
        FROM \`${tableName}\` p
        LEFT JOIN item_model_master imm ON p.product_code = imm.item_code
        WHERE imm.item_status IS NULL OR LOWER(imm.item_status) != 'inactive'
        ORDER BY p.brand ASC, p.model_name ASC
    `;
    const [results] = await db.execute(query);
    return filterByIcatSettings(results);
};

const sanitize = (name) => {
    if (!name) return '';
    if (typeof name === 'string') return name.replace(/`/g, '');
    if (typeof name === 'object') {
        if (name.column_name) return String(name.column_name).replace(/`/g, '');
        if (name.name) return String(name.name).replace(/`/g, '');
    }
    return String(name).replace(/`/g, '');
};

/**
 * Gets a validated, live database connection from the pool.
 * Retries up to 3 times if the pooled connection turns out to be stale/dead (ECONNRESET).
 * This is necessary on CPanel shared hosting where MySQL drops idle pool connections.
 */
const getValidConnection = async (maxRetries = 3) => {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        let conn;
        try {
            conn = await db.getConnection();
            // Ping the connection to verify it is alive
            await conn.execute('SELECT 1');
            return conn;
        } catch (e) {
            // Destroy this dead connection so it's not returned to the pool
            if (conn) {
                try { conn.destroy(); } catch (_) {}
            }
            lastError = e;
            console.warn(`Database connection attempt ${attempt}/${maxRetries} failed: ${e.message}. Retrying...`);
        }
    }
    throw lastError;
};

const upsertPriceListData = async (variationId, columnsList = [], records = [], addedBy = null, deviceId = 'Unknown') => {
    const tableName = `price_list_format_${variationId}`;
    const historyTableName = `price_list_format_history_${variationId}`;

    // Acquire a validated, live connection (retries if pool returns a stale one)
    const connection = await getValidConnection();

    try {
        // Verify the target table exists before starting a transaction
        let tableExists = false;
        try {
            await connection.execute(`SELECT 1 FROM \`${tableName}\` LIMIT 0`);
            tableExists = true;
        } catch (e) {
            if (e.code === 'ER_NO_SUCH_TABLE') {
                tableExists = false;
            } else {
                throw e;
            }
        }

        if (!tableExists) {
            throw new Error(`Table '${tableName}' doesn't exist. Please restart the server to auto-create it.`);
        }

        await connection.beginTransaction();

        const customFields = (Array.isArray(columnsList) ? columnsList : [])
            .map(c => sanitize(c))
            .filter(f => f !== '');

        const insertFields = [
            'product_code', 'brand', 'icat_name', 'model_group_name', 'model_name',
            ...customFields,
            'added_by', 'device_id'
        ];

        const placeholders = insertFields.map(() => '?').join(', ');

        const updateClause = [
            'brand = VALUES(brand)',
            'icat_name = VALUES(icat_name)',
            'model_group_name = VALUES(model_group_name)',
            'model_name = VALUES(model_name)',
            ...customFields.map(f => `\`${f}\` = COALESCE(VALUES(\`${f}\`), \`${f}\`)`),
            'added_by = VALUES(added_by)',
            'device_id = VALUES(device_id)'
        ].join(', ');

        const currentSql = `
            INSERT INTO \`${tableName}\` (${insertFields.map(f => `\`${f}\``).join(', ')})
            VALUES (${placeholders})
            ON DUPLICATE KEY UPDATE ${updateClause}
        `;

        const historySql = `
            INSERT INTO \`${historyTableName}\` (${insertFields.map(f => `\`${f}\``).join(', ')})
            VALUES (${placeholders})
        `;

        for (const rec of records) {
            const params = [
                rec.product_code,
                rec.brand,
                rec.icat_name,
                rec.model_group_name,
                rec.model_name,
                ...customFields.map(f => rec[f] !== undefined ? rec[f] : null),
                addedBy,
                deviceId
            ];

            // 1. Update Current Active Table (ON DUPLICATE KEY UPDATE)
            await connection.execute(currentSql, params);

            // 2. Append to History Table (Pure INSERT)
            try {
                await connection.execute(historySql, params);
            } catch (hErr) {
                console.warn(`Failed to log record into history table ${historyTableName}:`, hErr.message);
            }
        }

        await connection.commit();
    } catch (err) {
        try {
            await connection.rollback();
        } catch (rollbackErr) {
            console.warn(`Rollback failed (connection might be closed):`, rollbackErr.message);
        }
        throw err;
    } finally {
        try {
            connection.release();
        } catch (releaseErr) {
            // Ignore release error if connection was already closed
        }
    }
};

const getPriceListHistoryData = async (variationId, productCode = null) => {
    const historyTableName = `price_list_format_history_${variationId}`;
    try {
        let query = `
            SELECT p.*, COALESCE(imm.product_name, p.icat_name) AS icat_name
            FROM \`${historyTableName}\` p
            LEFT JOIN item_model_master imm ON p.product_code = imm.item_code
            WHERE imm.item_status IS NULL OR LOWER(imm.item_status) != 'inactive'
        `;
        const params = [];

        if (productCode) {
            query += ` AND p.product_code = ?`;
            params.push(productCode);
        }

        query += ` ORDER BY p.timestamp DESC, p.id DESC`;
        const [results] = await db.execute(query, params);
        return results;
    } catch (e) {
        return [];
    }
};

const getHistoryTimestamps = async (variationId) => {
    const historyTableName = `price_list_format_history_${variationId}`;
    try {
        const query = `
            SELECT 
                DATE_FORMAT(timestamp, '%Y-%m-%d %H:%i:%s') AS full_timestamp,
                DATE_FORMAT(timestamp, '%Y-%m-%d') AS date_part,
                DATE_FORMAT(timestamp, '%h:%i:%s %p') AS time_part,
                COUNT(*) AS record_count
            FROM \`${historyTableName}\`
            GROUP BY DATE_FORMAT(timestamp, '%Y-%m-%d %H:%i:%s')
            ORDER BY full_timestamp DESC
        `;
        const [results] = await db.execute(query);
        return results;
    } catch (e) {
        return [];
    }
};

const getPriceListReportData = async (variationId, targetDate = null) => {
    let rawRows = [];
    const todayStr = new Date().toISOString().split('T')[0];
    const isHistorical = Boolean(targetDate && typeof targetDate === 'string' && targetDate.trim() !== '');

    if (isHistorical) {
        const historyTableName = `price_list_format_history_${variationId}`;
        try {
            const trimmedDate = targetDate.trim();
            let query = "";
            let queryParams = [];

            if (trimmedDate.includes(':')) {
                const formattedTs = trimmedDate.replace('T', ' ');
                query = `
                    SELECT p.*, COALESCE(imm.product_name, p.icat_name) AS icat_name, imm.product_name AS imm_product_name
                    FROM \`${historyTableName}\` p
                    LEFT JOIN item_model_master imm ON p.product_code = imm.item_code
                    WHERE DATE_FORMAT(p.timestamp, '%Y-%m-%d %H:%i:%s') = ?
                      AND (imm.item_status IS NULL OR LOWER(imm.item_status) != 'inactive')
                    ORDER BY p.timestamp DESC, p.brand ASC, imm.product_name ASC, p.model_group_name ASC
                `;
                queryParams = [formattedTs];
            } else {
                query = `
                    SELECT p.*, COALESCE(imm.product_name, p.icat_name) AS icat_name, imm.product_name AS imm_product_name
                    FROM \`${historyTableName}\` p
                    LEFT JOIN item_model_master imm ON p.product_code = imm.item_code
                    WHERE DATE_FORMAT(p.timestamp, '%Y-%m-%d') = ?
                      AND (imm.item_status IS NULL OR LOWER(imm.item_status) != 'inactive')
                    ORDER BY p.timestamp DESC, p.brand ASC, imm.product_name ASC, p.model_group_name ASC
                `;
                queryParams = [trimmedDate];
            }

            const [results] = await db.execute(query, queryParams);
            rawRows = results;

            // Fallback: If no exact date match, query all records up to cutoff timestamp
            if (rawRows.length === 0) {
                const cutoffTimestamp = trimmedDate.includes(':') 
                    ? trimmedDate.replace('T', ' ') 
                    : `${trimmedDate} 23:59:59`;
                const fallbackQuery = `
                    SELECT p.*, COALESCE(imm.product_name, p.icat_name) AS icat_name, imm.product_name AS imm_product_name
                    FROM \`${historyTableName}\` p
                    LEFT JOIN item_model_master imm ON p.product_code = imm.item_code
                    WHERE p.timestamp <= ?
                      AND (imm.item_status IS NULL OR LOWER(imm.item_status) != 'inactive')
                    ORDER BY p.timestamp DESC, p.brand ASC, imm.product_name ASC, p.model_group_name ASC
                `;
                const [fallbackResults] = await db.execute(fallbackQuery, [cutoffTimestamp]);
                rawRows = fallbackResults;
            }
        } catch (e) {
            console.warn(`Failed to fetch historical report data from ${historyTableName}:`, e.message);
            rawRows = [];
        }

        // If targetDate is specified but no history records found (or table empty), fallback to current live table
        if (rawRows.length === 0 && targetDate.trim().split(' ')[0].split('T')[0] >= todayStr) {
            const tableName = `price_list_format_${variationId}`;
            try {
                const query = `
                    SELECT p.*, COALESCE(imm.product_name, p.icat_name) AS icat_name, imm.product_name AS imm_product_name
                    FROM \`${tableName}\` p
                    LEFT JOIN item_model_master imm ON p.product_code = imm.item_code
                    WHERE imm.item_status IS NULL OR LOWER(imm.item_status) != 'inactive'
                    ORDER BY p.brand ASC, imm.product_name ASC, p.model_group_name ASC
                `;
                const [results] = await db.execute(query);
                rawRows = results;
            } catch (e) {
                rawRows = [];
            }
        }
    } else {
        const tableName = `price_list_format_${variationId}`;
        try {
            const query = `
                SELECT p.*, COALESCE(imm.product_name, p.icat_name) AS icat_name, imm.product_name AS imm_product_name
                FROM \`${tableName}\` p
                LEFT JOIN item_model_master imm ON p.product_code = imm.item_code
                WHERE imm.item_status IS NULL OR LOWER(imm.item_status) != 'inactive'
                ORDER BY p.brand ASC, imm.product_name ASC, p.model_group_name ASC
            `;
            const [results] = await db.execute(query);
            rawRows = results;
        } catch (e) {
            // Table may not exist yet
            rawRows = [];
        }
    }

    // 1. Group rows by brand, product_name & model_group_name (including timestamp for historical view to keep all update rows)
    const groupMap = new Map();
    for (const row of rawRows) {
        const brand = row.brand || row.brand_name || "—";
        const prodName = row.imm_product_name || row.product_name || row.icat_name || "—";
        const group = row.model_group_name || "—";
        const tsKey = isHistorical && row.timestamp ? `|||${row.timestamp}` : "";
        const key = `${brand}|||${prodName}|||${group}${tsKey}`;

        if (!groupMap.has(key)) {
            const { product_code, model_name, imm_product_name, ...groupData } = row;
            groupMap.set(key, {
                ...groupData,
                brand: brand,
                product_name: prodName,
                model_group_name: group
            });
        }
    }
    const groupedRecords = Array.from(groupMap.values());

    // 2. Fetch active offers targeting model groups
    let offersByGroup = {};
    try {
        let activeOffersQuery = `
            SELECT 
                o.id,
                o.brand_name,
                o.offer_type,
                o.from_date,
                o.to_date,
                omg.model_group_name,
                ot.transaction_type,
                ot.value_type,
                ot.offer_type_value,
                ot.upto_value,
                ot.offer_text,
                ot.relative_offer
            FROM offers o
            JOIN offer_model_groups omg ON o.id = omg.offer_id
            LEFT JOIN offer_transactions ot ON o.id = ot.offer_id
        `;
        const offerParams = [];
        if (targetDate && typeof targetDate === 'string' && targetDate.trim() !== '') {
            const queryDate = targetDate.trim().split(' ')[0].split('T')[0];
            activeOffersQuery += ` WHERE o.from_date <= ? AND o.to_date >= ?`;
            offerParams.push(queryDate, queryDate);
        } else {
            activeOffersQuery += ` WHERE o.from_date <= CURDATE() AND o.to_date >= CURDATE()`;
        }

        const [offerRows] = await db.execute(activeOffersQuery, offerParams);

        const offerMap = new Map();
        const groupOfferMap = new Map();

        for (const r of offerRows) {
            if (!offerMap.has(r.id)) {
                offerMap.set(r.id, {
                    id: r.id,
                    brand_name: r.brand_name,
                    offer_type: r.offer_type,
                    from_date: r.from_date,
                    to_date: r.to_date,
                    transactions: []
                });
            }
            const offerObj = offerMap.get(r.id);
            if (r.transaction_type) {
                offerObj.transactions.push({
                    transaction_type: r.transaction_type,
                    value_type: r.value_type,
                    offer_type_value: r.offer_type_value,
                    upto_value: r.upto_value,
                    offer_text: r.offer_text,
                    relative_offer: r.relative_offer
                });
            }

            if (!groupOfferMap.has(r.model_group_name)) {
                groupOfferMap.set(r.model_group_name, new Set());
            }
            groupOfferMap.get(r.model_group_name).add(r.id);
        }

        for (const [groupName, offerIdSet] of groupOfferMap.entries()) {
            offersByGroup[groupName] = Array.from(offerIdSet).map(id => offerMap.get(id));
        }
    } catch (e) {
        console.warn("Failed to fetch active offers for price list report:", e.message);
    }

    // Attach active offers to each group record
    const reportData = groupedRecords.map(rec => ({
        ...rec,
        active_offers: offersByGroup[rec.model_group_name] || []
    }));

    return filterByIcatSettings(reportData);
};

module.exports = {
    getPriceListData,
    upsertPriceListData,
    getPriceListHistoryData,
    getHistoryTimestamps,
    getPriceListReportData
};


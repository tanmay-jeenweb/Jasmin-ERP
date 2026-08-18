const db = require('../config/db.js');
const { createAuditLog } = require('../models/auditLogModel.js');
const https = require('https');
const http = require('http');

// Native fetch — avoids undici WebAssembly crash on CloudLinux/LVE shared hosting
function nativeFetch(url, options = {}) {
    return new Promise((resolve, reject) => {
        const doRequest = (requestUrl, isRetry) => {
            const parsedUrl = new URL(requestUrl);
            const requester = parsedUrl.protocol === 'https:' ? https : http;
            const reqOptions = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
                path: parsedUrl.pathname + parsedUrl.search,
                method: options.method || 'GET',
                headers: options.headers || {},
                rejectUnauthorized: false,
                timeout: 60000
            };
            const req = requester.request(reqOptions, (res) => {
                let data = '';
                res.setEncoding('utf8');
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    const status = res.statusCode;
                    resolve({
                        ok: status >= 200 && status < 300,
                        status,
                        statusText: res.statusMessage || String(status),
                        json: () => Promise.resolve(JSON.parse(data)),
                        text: () => Promise.resolve(data)
                    });
                });
            });
            req.on('timeout', () => {
                req.destroy();
                if (!isRetry && requestUrl.startsWith('https://')) {
                    doRequest(requestUrl.replace('https://', 'http://'), true);
                } else { reject(new Error(`Timed out: ${requestUrl}`)); }
            });
            req.on('error', (err) => {
                if (!isRetry && requestUrl.startsWith('https://')) {
                    doRequest(requestUrl.replace('https://', 'http://'), true);
                } else { reject(new Error(`Request failed: ${err.message}`)); }
            });
            req.end();
        };
        doRequest(url, false);
    });
}

const allowedProductTypes = ['SMARTPHONE', 'FETURE PHONE', 'FEATURE PHONE', 'TABLET', 'I PAD', 'EOL MODEL'];

const formatToYYYYMMDD = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
};

const formatToDbDateStr = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getUserAllowedBranchCodes = async (user) => {
    if (!user || !user.id) return [];

    // Fetch user details & user_type to check for admin privileges
    const [userRows] = await db.execute(
        `SELECT u.id, u.role, ut.user_role, ut.type_name
         FROM users u
         LEFT JOIN user_types ut ON u.user_type_id = ut.id
         WHERE u.id = ?`,
        [user.id]
    );

    if (userRows.length > 0) {
        const u = userRows[0];
        if (u.role === 'admin' || u.role === 'super admin' || u.user_role === 'Admin' || u.type_name === 'Admin') {
            return null; // Admin has access to all branches
        }
    }

    // Fetch mapped branch codes for non-admin user from user_branch_mappings
    const [mappingRows] = await db.execute(
        `SELECT bm.code AS branch_code
         FROM user_branch_mappings ubm
         JOIN branch_master bm ON ubm.branch_id = bm.id
         WHERE ubm.user_id = ? AND bm.code IS NOT NULL AND bm.code != ''`,
        [user.id]
    );

    return mappingRows.map(r => String(r.branch_code).trim());
};

const syncBrandWiseSalesController = async (req, res) => {
    try {
        const addedBy = req.user.id;
        const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';

        // 1. Determine target date (default to current local date)
        let targetDate = new Date();
        if (req.body.date) {
            const parts = req.body.date.split('-'); // Expected "YYYY-MM-DD"
            if (parts.length === 3) {
                targetDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
            }
        }

        // Calculate sync start date (default to 5 days ago, or 3 months ago if fullSync is set)
        const startDate = new Date(targetDate);
        const isFullSync = (req.body && req.body.fullSync === true) || (req.query && req.query.fullSync === 'true');
        if (isFullSync) {
            startDate.setMonth(startDate.getMonth() - 3);
            console.log(`Performing FULL 3-Month sync from ${formatToDbDateStr(startDate)} to ${formatToDbDateStr(targetDate)}`);
        } else {
            startDate.setDate(startDate.getDate() - 4); // 5 days inclusive
            console.log(`Performing QUICK 5-Day sync from ${formatToDbDateStr(startDate)} to ${formatToDbDateStr(targetDate)}`);
        }

        // Generate 10-day chunks
        const chunks = [];
        let currentStart = new Date(startDate);
        while (currentStart < targetDate) {
            let currentEnd = new Date(currentStart);
            currentEnd.setDate(currentEnd.getDate() + 9);
            if (currentEnd > targetDate) {
                currentEnd = new Date(targetDate);
            }
            chunks.push({
                start: new Date(currentStart),
                end: new Date(currentEnd)
            });
            currentStart.setDate(currentStart.getDate() + 10);
        }

        let totalInvoicesSynced = 0;
        let totalReturnsSynced = 0;

        const userId = process.env.MODEL_API_USERID || 'WebSite';
        const securityCode = process.env.MODEL_API_SECURITYCODE || '1151-8111-6444-4166';

        // Fetch each chunk sequentially to avoid rate limits/timeouts
        for (const chunk of chunks) {
            const chunkStartStr = formatToYYYYMMDD(chunk.start);
            const chunkEndStr = formatToYYYYMMDD(chunk.end);

            const dbStartStr = formatToDbDateStr(chunk.start);
            const dbEndStr = formatToDbDateStr(chunk.end);

            console.log(`Processing chunk: ${dbStartStr} to ${dbEndStr}`);

            // Fetch Invoices
            const invoiceUrl = `https://apxwapi.jasminmobile.com:81/api/apxapi/GetExtendedInvoiceDetails?CompanyCode=JITPL&InvoiceStartDate=${chunkStartStr}&InvoiceEndDate=${chunkEndStr}&SalespersonCode=0`;
            let invoices = [];
            try {
                const response = await nativeFetch(invoiceUrl, {
                    method: 'GET',
                    headers: {
                        'userid': userId,
                        'Securitycode': securityCode,
                        'Accept': 'application/json'
                    }
                });
                if (response.status === 200) {
                    invoices = await response.json();
                } else if (response.status !== 404) {
                    console.error(`Invoice API returned status ${response.status} for chunk ${dbStartStr} - ${dbEndStr}`);
                }
            } catch (e) {
                console.error(`Invoice fetch failed for chunk ${dbStartStr} - ${dbEndStr}:`, e.message);
            }

            // Fetch Sales Returns
            const returnUrl = `https://apxwapi.jasminmobile.com:81/api/apxapi/GetExtendedSalesReturnDetails?CompanyCode=JITPL&SRNStartDate=${chunkStartStr}&SRNEndDate=${chunkEndStr}&BranchCode=0&SalespersonCode=0`;
            let salesReturns = [];
            try {
                const response = await nativeFetch(returnUrl, {
                    method: 'GET',
                    headers: {
                        'userid': userId,
                        'Securitycode': securityCode,
                        'Accept': 'application/json'
                    }
                });
                if (response.status === 200) {
                    salesReturns = await response.json();
                } else if (response.status !== 404) {
                    console.error(`Sales Return API returned status ${response.status} for chunk ${dbStartStr} - ${dbEndStr}`);
                }
            } catch (e) {
                console.error(`Sales Return fetch failed for chunk ${dbStartStr} - ${dbEndStr}:`, e.message);
            }

            // Filter & prepare records for DB insertion
            const invoiceInsertValues = [];
            for (const invoice of invoices) {
                const invoiceNo = invoice.invoicePrimaryData?.InvoiceNo;
                const invoiceDateStr = invoice.invoicePrimaryData?.InvoiceDate;
                const branchCode = invoice.invoicePrimaryData?.BranchCode;
                const branchName = invoice.invoicePrimaryData?.BranchName;
                if (!invoiceNo || !invoiceDateStr) continue;

                const [id, im, iy] = invoiceDateStr.split('/');
                const invoiceDbDate = `${iy}-${im.padStart(2, '0')}-${id.padStart(2, '0')}`;

                if (Array.isArray(invoice.invoiceItemData)) {
                    for (const item of invoice.invoiceItemData) {
                        const itemDesc = item.ItemDescription || '';
                        const parts = itemDesc.split(':');
                        const lastPart = parts[parts.length - 1]?.trim().toUpperCase();

                        if (parts.length > 1 && allowedProductTypes.includes(lastPart)) {
                            invoiceInsertValues.push([
                                invoiceNo,
                                invoiceDbDate,
                                branchCode || '',
                                branchName || '',
                                item.ItemCode || '',
                                itemDesc,
                                parseFloat(item.Qty) || 0,
                                parseFloat(item.NetAmount) || 0,
                                lastPart
                            ]);
                        }
                    }
                }
            }

            const returnInsertValues = [];
            for (const srn of salesReturns) {
                const srnNo = srn.SRNPrimaryData?.SalesReturnNo;
                const srnDateStr = srn.SRNPrimaryData?.SalesReturnDate;
                const branchCode = srn.SRNPrimaryData?.BranchCode;
                const branchName = srn.SRNPrimaryData?.BranchName;
                if (!srnNo || !srnDateStr) continue;

                const [sd, sm, sy] = srnDateStr.split('/');
                const srnDbDate = `${sy}-${sm.padStart(2, '0')}-${sd.padStart(2, '0')}`;

                if (Array.isArray(srn.SRNItemData)) {
                    for (const item of srn.SRNItemData) {
                        const itemDesc = item.ItemDescription || '';
                        const parts = itemDesc.split(':');
                        const lastPart = parts[parts.length - 1]?.trim().toUpperCase();

                        if (parts.length > 1 && allowedProductTypes.includes(lastPart)) {
                            returnInsertValues.push([
                                srnNo,
                                srnDbDate,
                                branchCode || '',
                                branchName || '',
                                item.ItemCode || '',
                                itemDesc,
                                parseFloat(item.Qty) || 0,
                                parseFloat(item.NetAmount) || 0,
                                lastPart
                            ]);
                        }
                    }
                }
            }

            // Write chunk to DB inside a transaction
            const connection = await db.getConnection();
            try {
                await connection.beginTransaction();

                await connection.execute(
                    `DELETE FROM synced_invoice_items WHERE invoice_date BETWEEN ? AND ?`,
                    [dbStartStr, dbEndStr]
                );
                await connection.execute(
                    `DELETE FROM synced_sales_return_items WHERE sales_return_date BETWEEN ? AND ?`,
                    [dbStartStr, dbEndStr]
                );

                if (invoiceInsertValues.length > 0) {
                    await connection.query(
                        `INSERT INTO synced_invoice_items (
                            invoice_no, invoice_date, branch_code, branch_name, item_code, item_description, qty, net_amount, product_type
                        ) VALUES ?`,
                        [invoiceInsertValues]
                    );
                    totalInvoicesSynced += invoiceInsertValues.length;

                    // Also upsert the fresh data into sales_invoice_cache so MTD/LMTD/FTD stay current
                    const cacheInvoiceValues = invoiceInsertValues.map(row => {
                        const itemDesc = row[5] || '';
                        const parts = itemDesc.split(':');
                        let itemModelName = itemDesc;
                        if (parts.length > 1) {
                            const lastPart = parts[parts.length - 1].trim().toUpperCase();
                            if (allowedProductTypes.includes(lastPart)) {
                                itemModelName = parts.slice(0, parts.length - 1).join(':').trim();
                            }
                        }
                        return [
                            row[0], // invoice_no
                            row[1], // invoice_date
                            row[2], // branch_code
                            row[3], // branch_name
                            row[4], // item_code
                            itemModelName,
                            row[6], // qty
                            row[7], // net_amount as amount
                            'INVOICE'
                        ];
                    });
                    await connection.query(`
                        INSERT INTO sales_invoice_cache
                            (invoice_no, invoice_date, branch_code, branch_name, item_code, item_model_name, qty, amount, record_type)
                        VALUES ?
                        ON DUPLICATE KEY UPDATE
                            invoice_date = VALUES(invoice_date),
                            branch_code = VALUES(branch_code),
                            branch_name = VALUES(branch_name),
                            item_code = VALUES(item_code),
                            item_model_name = VALUES(item_model_name),
                            qty = VALUES(qty),
                            amount = VALUES(amount),
                            record_type = VALUES(record_type)
                    `, [cacheInvoiceValues]);
                }

                if (returnInsertValues.length > 0) {
                    await connection.query(
                        `INSERT INTO synced_sales_return_items (
                            sales_return_no, sales_return_date, branch_code, branch_name, item_code, item_description, qty, net_amount, product_type
                        ) VALUES ?`,
                        [returnInsertValues]
                    );
                    totalReturnsSynced += returnInsertValues.length;

                    // Also upsert the fresh returns data into sales_invoice_cache
                    const cacheReturnValues = returnInsertValues.map(row => {
                        const itemDesc = row[5] || '';
                        const parts = itemDesc.split(':');
                        let itemModelName = itemDesc;
                        if (parts.length > 1) {
                            const lastPart = parts[parts.length - 1].trim().toUpperCase();
                            if (allowedProductTypes.includes(lastPart)) {
                                itemModelName = parts.slice(0, parts.length - 1).join(':').trim();
                            }
                        }
                        return [
                            row[0], // sales_return_no as invoice_no
                            row[1], // sales_return_date as invoice_date
                            row[2], // branch_code
                            row[3], // branch_name
                            row[4], // item_code
                            itemModelName,
                            row[6], // qty
                            row[7], // net_amount as amount
                            'RETURN'
                        ];
                    });
                    await connection.query(`
                        INSERT INTO sales_invoice_cache
                            (invoice_no, invoice_date, branch_code, branch_name, item_code, item_model_name, qty, amount, record_type)
                        VALUES ?
                        ON DUPLICATE KEY UPDATE
                            invoice_date = VALUES(invoice_date),
                            branch_code = VALUES(branch_code),
                            branch_name = VALUES(branch_name),
                            item_code = VALUES(item_code),
                            item_model_name = VALUES(item_model_name),
                            qty = VALUES(qty),
                            amount = VALUES(amount),
                            record_type = VALUES(record_type)
                    `, [cacheReturnValues]);
                }

                await connection.commit();
            } catch (dbErr) {
                await connection.rollback();
                console.error(`Database operations failed for chunk ${dbStartStr} - ${dbEndStr}:`, dbErr.message);
                throw dbErr;
            } finally {
                connection.release();
            }
        }

        // Write Audit Log
        try {
            await createAuditLog(
                addedBy,
                req.user?.name || req.user?.username || 'Unknown',
                deviceId,
                isFullSync ? 'Brand Wise Sales Sync (Full)' : 'Brand Wise Sales Sync (Quick)',
                'updated',
                null,
                {
                    target_date: formatToDbDateStr(targetDate),
                    synced_invoices_count: totalInvoicesSynced,
                    synced_returns_count: totalReturnsSynced,
                    synced_at: new Date().toISOString()
                }
            );
        } catch (auditErr) {
            console.error("Failed to write audit log for brand wise sales sync:", auditErr);
        }

        res.status(200).json({
            success: true,
            message: `Brand Wise Sales Sync Successful. Synced ${totalInvoicesSynced} invoice items and ${totalReturnsSynced} sales return items.`
        });

    } catch (error) {
        console.error('Error in syncBrandWiseSalesController:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error while syncing brand wise sales'
        });
    }
};

const getBrandWiseSalesController = async (req, res) => {
    try {
        // 1. Determine target date (default to today)
        let targetYear, targetMonth, targetDay;
        if (req.query.date) {
            const parts = req.query.date.split('-'); // Expected "YYYY-MM-DD"
            if (parts.length === 3) {
                targetYear = parseInt(parts[0], 10);
                targetMonth = parseInt(parts[1], 10) - 1;
                targetDay = parseInt(parts[2], 10);
            }
        }

        if (targetYear === undefined) {
            const now = new Date();
            targetYear = now.getFullYear();
            targetMonth = now.getMonth();
            targetDay = now.getDate();
        }

        const targetDate = new Date(targetYear, targetMonth, targetDay);
        const lmTargetDate = new Date(targetYear, targetMonth - 1, targetDay);
        const firstDayCurrentMonth = new Date(targetYear, targetMonth, 1);
        const firstDayLastMonth = new Date(targetYear, targetMonth - 1, 1);

        const firstDayLastMonthStr = formatToDbDateStr(firstDayLastMonth);
        const targetDateStr = formatToDbDateStr(targetDate);

        const ftdYYYYMMDD = formatToYYYYMMDD(targetDate);
        const lmftdYYYYMMDD = formatToYYYYMMDD(lmTargetDate);
        const mtdStartYYYYMMDD = formatToYYYYMMDD(firstDayCurrentMonth);
        const lmtdStartYYYYMMDD = formatToYYYYMMDD(firstDayLastMonth);

        console.log(`Aggregating brand wise sales for targetDate: ${targetDateStr}`);

        // 2. Fetch Model Master items to match item codes
        const [models] = await db.execute("SELECT item_code, brand_name FROM item_model_master");
        const modelMap = {};
        for (const m of models) {
            if (m.item_code) {
                modelMap[m.item_code.trim()] = m.brand_name ? m.brand_name.trim() : null;
            }
        }

        // Helper to resolve brand name
        const getBrandName = (itemCode, itemDescription) => {
            // 1. Try exact item_code lookup in model master
            const code = (itemCode || '').trim();
            if (code && modelMap[code]) {
                return modelMap[code];
            }
            // 2. Keyword match on item_description / item_model_name
            const desc = (itemDescription || '').toLowerCase();
            if (desc.includes('samsung')) return 'Samsung';
            if (desc.includes('vivo')) return 'Vivo';
            if (desc.includes('oppo')) return 'Oppo';
            if (desc.includes('realme')) return 'Realme';
            if (desc.includes('apple') || desc.includes('iphone') || desc.includes('ipad')) return 'Apple';
            if (desc.includes('oneplus')) return 'OnePlus';
            if (desc.includes('xiaomi') || desc.includes('redmi') || desc.includes(' mi ')) return 'Xiaomi';
            // 3. Try the old colon-split fallback for synced_invoice_items data
            const parts = (itemDescription || '').split(':');
            if (parts.length > 2) {
                return parts[parts.length - 2].trim();
            }
            return 'Others';
        };

        // Helper to standardize brand names to match UI
        const standardizeBrand = (brand) => {
            if (!brand) return 'Others';
            const b = brand.trim().toLowerCase();
            if (b.includes('vivo')) return 'Vivo';
            if (b.includes('oppo')) return 'Oppo';
            if (b.includes('samsung')) return 'Samsung';
            if (b.includes('apple') || b.includes('iphone')) return 'Apple';
            if (b.includes('realme')) return 'Realme';
            if (b.includes('xiaomi') || b.includes('redmi') || b === 'mi') return 'Xiaomi';
            if (b.includes('oneplus')) return 'OnePlus';
            return brand.trim().charAt(0).toUpperCase() + brand.trim().slice(1).toLowerCase();
        };

        // 3. Query sales_invoice_cache (full history) for MTD/LMTD range
        // synced_invoice_items only has 5 days; sales_invoice_cache has full history from populate script.
        const allowedBranchCodes = await getUserAllowedBranchCodes(req.user);

        let dbRows = [], dbSrnRows = [];

        if (Array.isArray(allowedBranchCodes) && allowedBranchCodes.length === 0) {
            dbRows = [];
            dbSrnRows = [];
        } else if (allowedBranchCodes !== null) {
            const placeholders = allowedBranchCodes.map(() => '?').join(',');

            if (req.query.state && req.query.state !== 'All') {
                [dbRows] = await db.execute(
                    `SELECT sic.invoice_date, sic.item_code, sic.item_model_name AS item_description, sic.qty, sic.amount AS net_amount
                     FROM sales_invoice_cache sic
                     INNER JOIN branch_master bm ON sic.branch_code = bm.code
                     INNER JOIN state_master sm ON bm.state_id = sm.id
                     WHERE sic.invoice_date BETWEEN ? AND ?
                       AND sic.record_type = 'INVOICE'
                       AND sic.invoice_no NOT LIKE 'ISBS%'
                       AND sm.name = ?
                       AND sic.branch_code IN (${placeholders})`,
                    [firstDayLastMonthStr, targetDateStr, req.query.state, ...allowedBranchCodes]
                );
                [dbSrnRows] = await db.execute(
                    `SELECT sic.invoice_date AS sales_return_date, sic.item_code, sic.item_model_name AS item_description, sic.qty, sic.amount AS net_amount
                     FROM sales_invoice_cache sic
                     INNER JOIN branch_master bm ON sic.branch_code = bm.code
                     INNER JOIN state_master sm ON bm.state_id = sm.id
                     WHERE sic.invoice_date BETWEEN ? AND ?
                       AND sic.record_type = 'RETURN'
                       AND sm.name = ?
                       AND sic.branch_code IN (${placeholders})`,
                    [firstDayLastMonthStr, targetDateStr, req.query.state, ...allowedBranchCodes]
                );
            } else {
                [dbRows] = await db.execute(
                    `SELECT invoice_date, item_code, item_model_name AS item_description, qty, amount AS net_amount
                     FROM sales_invoice_cache
                     WHERE invoice_date BETWEEN ? AND ?
                       AND record_type = 'INVOICE'
                       AND invoice_no NOT LIKE 'ISBS%'
                       AND branch_code IN (${placeholders})`,
                    [firstDayLastMonthStr, targetDateStr, ...allowedBranchCodes]
                );
                [dbSrnRows] = await db.execute(
                    `SELECT invoice_date AS sales_return_date, item_code, item_model_name AS item_description, qty, amount AS net_amount
                     FROM sales_invoice_cache
                     WHERE invoice_date BETWEEN ? AND ?
                       AND record_type = 'RETURN'
                       AND branch_code IN (${placeholders})`,
                    [firstDayLastMonthStr, targetDateStr, ...allowedBranchCodes]
                );
            }
        } else {
            // Admin: all branches
            if (req.query.state && req.query.state !== 'All') {
                [dbRows] = await db.execute(
                    `SELECT sic.invoice_date, sic.item_code, sic.item_model_name AS item_description, sic.qty, sic.amount AS net_amount
                     FROM sales_invoice_cache sic
                     INNER JOIN branch_master bm ON sic.branch_code = bm.code
                     INNER JOIN state_master sm ON bm.state_id = sm.id
                     WHERE sic.invoice_date BETWEEN ? AND ?
                       AND sic.record_type = 'INVOICE'
                       AND sic.invoice_no NOT LIKE 'ISBS%'
                       AND sm.name = ?`,
                    [firstDayLastMonthStr, targetDateStr, req.query.state]
                );
                [dbSrnRows] = await db.execute(
                    `SELECT sic.invoice_date AS sales_return_date, sic.item_code, sic.item_model_name AS item_description, sic.qty, sic.amount AS net_amount
                     FROM sales_invoice_cache sic
                     INNER JOIN branch_master bm ON sic.branch_code = bm.code
                     INNER JOIN state_master sm ON bm.state_id = sm.id
                     WHERE sic.invoice_date BETWEEN ? AND ?
                       AND sic.record_type = 'RETURN'
                       AND sm.name = ?`,
                    [firstDayLastMonthStr, targetDateStr, req.query.state]
                );
            } else {
                [dbRows] = await db.execute(
                    `SELECT invoice_date, item_code, item_model_name AS item_description, qty, amount AS net_amount
                     FROM sales_invoice_cache
                     WHERE invoice_date BETWEEN ? AND ?
                       AND record_type = 'INVOICE'
                       AND invoice_no NOT LIKE 'ISBS%'`,
                    [firstDayLastMonthStr, targetDateStr]
                );
                [dbSrnRows] = await db.execute(
                    `SELECT invoice_date AS sales_return_date, item_code, item_model_name AS item_description, qty, amount AS net_amount
                     FROM sales_invoice_cache
                     WHERE invoice_date BETWEEN ? AND ?
                       AND record_type = 'RETURN'`,
                    [firstDayLastMonthStr, targetDateStr]
                );
            }
        }

        // Initialize brand aggregation map with standard brands
        const brandMap = {};
        const defaultBrands = ["Apple", "OnePlus", "Oppo", "Realme", "Samsung", "Vivo", "Xiaomi", "Others"];
        for (const b of defaultBrands) {
            brandMap[b] = {
                brand_name: b,
                ftd_qty_ach: 0,
                ftd_value_ach: 0.00,
                lmftd_qty_ach: 0,
                lmftd_value_ach: 0.00,
                mtd_qty_ach: 0,
                mtd_value_ach: 0.00,
                lmtd_qty_ach: 0,
                lmtd_value_ach: 0.00,
                growth_qty_percentage: 0.00,
                growth_value_percentage: 0.00
            };
        }

        // Process invoices
        for (const row of dbRows) {
            const rawBrand = getBrandName(row.item_code, row.item_description);
            const brand = standardizeBrand(rawBrand);

            if (!brandMap[brand]) {
                brandMap[brand] = {
                    brand_name: brand,
                    ftd_qty_ach: 0,
                    ftd_value_ach: 0.00,
                    lmftd_qty_ach: 0,
                    lmftd_value_ach: 0.00,
                    mtd_qty_ach: 0,
                    mtd_value_ach: 0.00,
                    lmtd_qty_ach: 0,
                    lmtd_value_ach: 0.00,
                    growth_qty_percentage: 0.00,
                    growth_value_percentage: 0.00
                };
            }

            const invDate = new Date(row.invoice_date);
            const invYYYYMMDD = formatToYYYYMMDD(invDate);
            const qty = parseFloat(row.qty) || 0;
            const val = parseFloat(row.net_amount) || 0;

            if (invYYYYMMDD === ftdYYYYMMDD) {
                brandMap[brand].ftd_qty_ach += qty;
                brandMap[brand].ftd_value_ach += val;
            }
            if (invYYYYMMDD === lmftdYYYYMMDD) {
                brandMap[brand].lmftd_qty_ach += qty;
                brandMap[brand].lmftd_value_ach += val;
            }
            if (invYYYYMMDD >= mtdStartYYYYMMDD && invYYYYMMDD <= ftdYYYYMMDD) {
                brandMap[brand].mtd_qty_ach += qty;
                brandMap[brand].mtd_value_ach += val;
            }
            if (invYYYYMMDD >= lmtdStartYYYYMMDD && invYYYYMMDD <= lmftdYYYYMMDD) {
                brandMap[brand].lmtd_qty_ach += qty;
                brandMap[brand].lmtd_value_ach += val;
            }
        }

        // Subtract returns
        for (const row of dbSrnRows) {
            const rawBrand = getBrandName(row.item_code, row.item_description);
            const brand = standardizeBrand(rawBrand);

            if (!brandMap[brand]) {
                brandMap[brand] = {
                    brand_name: brand,
                    ftd_qty_ach: 0,
                    ftd_value_ach: 0.00,
                    lmftd_qty_ach: 0,
                    lmftd_value_ach: 0.00,
                    mtd_qty_ach: 0,
                    mtd_value_ach: 0.00,
                    lmtd_qty_ach: 0,
                    lmtd_value_ach: 0.00,
                    growth_qty_percentage: 0.00,
                    growth_value_percentage: 0.00
                };
            }

            const retDate = new Date(row.sales_return_date);
            const retYYYYMMDD = formatToYYYYMMDD(retDate);
            const qty = parseFloat(row.qty) || 0;
            const val = parseFloat(row.net_amount) || 0;

            if (retYYYYMMDD === ftdYYYYMMDD) {
                brandMap[brand].ftd_qty_ach -= qty;
                brandMap[brand].ftd_value_ach -= val;
            }
            if (retYYYYMMDD === lmftdYYYYMMDD) {
                brandMap[brand].lmftd_qty_ach -= qty;
                brandMap[brand].lmftd_value_ach -= val;
            }
            if (retYYYYMMDD >= mtdStartYYYYMMDD && retYYYYMMDD <= ftdYYYYMMDD) {
                brandMap[brand].mtd_qty_ach -= qty;
                brandMap[brand].mtd_value_ach -= val;
            }
            if (retYYYYMMDD >= lmtdStartYYYYMMDD && retYYYYMMDD <= lmftdYYYYMMDD) {
                brandMap[brand].lmtd_qty_ach -= qty;
                brandMap[brand].lmtd_value_ach -= val;
            }
        }

        // Clamp negatives to 0 and calculate Growth %
        for (const brand of Object.keys(brandMap)) {
            const ach = brandMap[brand];
            if (ach.ftd_qty_ach < 0) ach.ftd_qty_ach = 0;
            if (ach.ftd_value_ach < 0) ach.ftd_value_ach = 0;
            if (ach.lmftd_qty_ach < 0) ach.lmftd_qty_ach = 0;
            if (ach.lmftd_value_ach < 0) ach.lmftd_value_ach = 0;
            if (ach.mtd_qty_ach < 0) ach.mtd_qty_ach = 0;
            if (ach.mtd_value_ach < 0) ach.mtd_value_ach = 0;
            if (ach.lmtd_qty_ach < 0) ach.lmtd_qty_ach = 0;
            if (ach.lmtd_value_ach < 0) ach.lmtd_value_ach = 0;

            const mtdQty = ach.mtd_qty_ach;
            const lmtdQty = ach.lmtd_qty_ach;
            ach.growth_qty_percentage = mtdQty !== 0 ? ((mtdQty - lmtdQty) / mtdQty) * 100 : 0.00;

            const mtdVal = ach.mtd_value_ach;
            const lmtdVal = ach.lmtd_value_ach;
            ach.growth_value_percentage = mtdVal !== 0 ? ((mtdVal - lmtdVal) / mtdVal) * 100 : 0.00;
        }

        res.status(200).json({
            success: true,
            message: 'Brand Wise Sales aggregated successfully',
            data: Object.values(brandMap)
        });

    } catch (error) {
        console.error('Error in getBrandWiseSalesController:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error while retrieving brand wise sales'
        });
    }
};

const getBrandWiseSalesTotalsController = async (req, res) => {
    try {
        // 1. Determine target date (default to today)
        let targetYear, targetMonth, targetDay;
        if (req.query.date) {
            const parts = req.query.date.split('-');
            if (parts.length === 3) {
                targetYear  = parseInt(parts[0], 10);
                targetMonth = parseInt(parts[1], 10) - 1;
                targetDay   = parseInt(parts[2], 10);
            }
        }

        if (targetYear === undefined) {
            const now = new Date();
            targetYear  = now.getFullYear();
            targetMonth = now.getMonth();
            targetDay   = now.getDate();
        }

        const targetDate           = new Date(targetYear, targetMonth, targetDay);
        const lmTargetDate         = new Date(targetYear, targetMonth - 1, targetDay);
        const firstDayCurrentMonth = new Date(targetYear, targetMonth, 1);
        const firstDayLastMonth    = new Date(targetYear, targetMonth - 1, 1);

        const firstDayLastMonthStr = formatToDbDateStr(firstDayLastMonth);
        const targetDateStr        = formatToDbDateStr(targetDate);

        const ftdYYYYMMDD      = formatToYYYYMMDD(targetDate);
        const lmftdYYYYMMDD    = formatToYYYYMMDD(lmTargetDate);
        const mtdStartYYYYMMDD = formatToYYYYMMDD(firstDayCurrentMonth);
        const lmtdStartYYYYMMDD= formatToYYYYMMDD(firstDayLastMonth);

        // 2. Fetch Model Master for brand resolution
        const [models] = await db.execute("SELECT item_code, brand_name FROM item_model_master");
        const modelMap = {};
        for (const m of models) {
            if (m.item_code) modelMap[m.item_code.trim()] = m.brand_name ? m.brand_name.trim() : null;
        }

        const getBrandName = (itemCode, itemDescription) => {
            const code = (itemCode || '').trim();
            if (code && modelMap[code]) return modelMap[code];
            const desc = (itemDescription || '').toLowerCase();
            if (desc.includes('samsung'))  return 'Samsung';
            if (desc.includes('vivo'))     return 'Vivo';
            if (desc.includes('oppo'))     return 'Oppo';
            if (desc.includes('realme'))   return 'Realme';
            if (desc.includes('apple') || desc.includes('iphone') || desc.includes('ipad')) return 'Apple';
            if (desc.includes('oneplus'))  return 'OnePlus';
            if (desc.includes('xiaomi') || desc.includes('redmi') || desc.includes(' mi ')) return 'Xiaomi';
            const parts = (itemDescription || '').split(':');
            if (parts.length > 2) return parts[parts.length - 2].trim();
            return 'Others';
        };

        const standardizeBrand = (brand) => {
            if (!brand) return 'Others';
            const b = brand.trim().toLowerCase();
            if (b.includes('vivo'))    return 'Vivo';
            if (b.includes('oppo'))    return 'Oppo';
            if (b.includes('samsung')) return 'Samsung';
            if (b.includes('apple') || b.includes('iphone')) return 'Apple';
            if (b.includes('realme'))  return 'Realme';
            if (b.includes('xiaomi') || b.includes('redmi') || b === 'mi') return 'Xiaomi';
            if (b.includes('oneplus')) return 'OnePlus';
            return brand.trim().charAt(0).toUpperCase() + brand.trim().slice(1).toLowerCase();
        };

        // 3. Query sales_invoice_cache
        const allowedBranchCodes = await getUserAllowedBranchCodes(req.user);

        let dbRows = [], dbSrnRows = [];

        if (Array.isArray(allowedBranchCodes) && allowedBranchCodes.length === 0) {
            dbRows = [];
            dbSrnRows = [];
        } else if (allowedBranchCodes !== null) {
            const placeholders = allowedBranchCodes.map(() => '?').join(',');

            if (req.query.state && req.query.state !== 'All') {
                [dbRows] = await db.execute(
                    `SELECT sic.invoice_date, sic.item_code, sic.item_model_name AS item_description, sic.qty, sic.amount AS net_amount
                     FROM sales_invoice_cache sic
                     INNER JOIN branch_master bm ON sic.branch_code = bm.code
                     INNER JOIN state_master sm ON bm.state_id = sm.id
                     WHERE sic.invoice_date BETWEEN ? AND ?
                       AND sic.record_type = 'INVOICE'
                       AND sic.invoice_no NOT LIKE 'ISBS%'
                       AND sm.name = ?
                       AND sic.branch_code IN (${placeholders})`,
                    [firstDayLastMonthStr, targetDateStr, req.query.state, ...allowedBranchCodes]
                );
                [dbSrnRows] = await db.execute(
                    `SELECT sic.invoice_date AS sales_return_date, sic.item_code, sic.item_model_name AS item_description, sic.qty, sic.amount AS net_amount
                     FROM sales_invoice_cache sic
                     INNER JOIN branch_master bm ON sic.branch_code = bm.code
                     INNER JOIN state_master sm ON bm.state_id = sm.id
                     WHERE sic.invoice_date BETWEEN ? AND ?
                       AND sic.record_type = 'RETURN'
                       AND sm.name = ?
                       AND sic.branch_code IN (${placeholders})`,
                    [firstDayLastMonthStr, targetDateStr, req.query.state, ...allowedBranchCodes]
                );
            } else {
                [dbRows] = await db.execute(
                    `SELECT invoice_date, item_code, item_model_name AS item_description, qty, amount AS net_amount
                     FROM sales_invoice_cache
                     WHERE invoice_date BETWEEN ? AND ?
                       AND record_type = 'INVOICE'
                       AND invoice_no NOT LIKE 'ISBS%'
                       AND branch_code IN (${placeholders})`,
                    [firstDayLastMonthStr, targetDateStr, ...allowedBranchCodes]
                );
                [dbSrnRows] = await db.execute(
                    `SELECT invoice_date AS sales_return_date, item_code, item_model_name AS item_description, qty, amount AS net_amount
                     FROM sales_invoice_cache
                     WHERE invoice_date BETWEEN ? AND ?
                       AND record_type = 'RETURN'
                       AND branch_code IN (${placeholders})`,
                    [firstDayLastMonthStr, targetDateStr, ...allowedBranchCodes]
                );
            }
        } else {
            // Admin: all branches
            if (req.query.state && req.query.state !== 'All') {
                [dbRows] = await db.execute(
                    `SELECT sic.invoice_date, sic.item_code, sic.item_model_name AS item_description, sic.qty, sic.amount AS net_amount
                     FROM sales_invoice_cache sic
                     INNER JOIN branch_master bm ON sic.branch_code = bm.code
                     INNER JOIN state_master sm ON bm.state_id = sm.id
                     WHERE sic.invoice_date BETWEEN ? AND ?
                       AND sic.record_type = 'INVOICE'
                       AND sic.invoice_no NOT LIKE 'ISBS%'
                       AND sm.name = ?`,
                    [firstDayLastMonthStr, targetDateStr, req.query.state]
                );
                [dbSrnRows] = await db.execute(
                    `SELECT sic.invoice_date AS sales_return_date, sic.item_code, sic.item_model_name AS item_description, sic.qty, sic.amount AS net_amount
                     FROM sales_invoice_cache sic
                     INNER JOIN branch_master bm ON sic.branch_code = bm.code
                     INNER JOIN state_master sm ON bm.state_id = sm.id
                     WHERE sic.invoice_date BETWEEN ? AND ?
                       AND sic.record_type = 'RETURN'
                       AND sm.name = ?`,
                    [firstDayLastMonthStr, targetDateStr, req.query.state]
                );
            } else {
                [dbRows] = await db.execute(
                    `SELECT invoice_date, item_code, item_model_name AS item_description, qty, amount AS net_amount
                     FROM sales_invoice_cache
                     WHERE invoice_date BETWEEN ? AND ?
                       AND record_type = 'INVOICE'
                       AND invoice_no NOT LIKE 'ISBS%'`,
                    [firstDayLastMonthStr, targetDateStr]
                );
                [dbSrnRows] = await db.execute(
                    `SELECT invoice_date AS sales_return_date, item_code, item_model_name AS item_description, qty, amount AS net_amount
                     FROM sales_invoice_cache
                     WHERE invoice_date BETWEEN ? AND ?
                       AND record_type = 'RETURN'`,
                    [firstDayLastMonthStr, targetDateStr]
                );
            }
        }

        // 4. Accumulate totals directly (no brand map needed)
        const totals = {
            brand_name: 'Total',
            ftd_qty_ach: 0,
            ftd_value_ach: 0.00,
            lmftd_qty_ach: 0,
            lmftd_value_ach: 0.00,
            mtd_qty_ach: 0,
            mtd_value_ach: 0.00,
            lmtd_qty_ach: 0,
            lmtd_value_ach: 0.00,
            growth_qty_percentage: 0.00,
            growth_value_percentage: 0.00
        };

        // Add invoices
        for (const row of dbRows) {
            const invDate    = new Date(row.invoice_date);
            const invYYYYMMDD = formatToYYYYMMDD(invDate);
            const qty = parseFloat(row.qty) || 0;
            const val = parseFloat(row.net_amount) || 0;

            if (invYYYYMMDD === ftdYYYYMMDD)                                               { totals.ftd_qty_ach   += qty; totals.ftd_value_ach   += val; }
            if (invYYYYMMDD === lmftdYYYYMMDD)                                             { totals.lmftd_qty_ach += qty; totals.lmftd_value_ach += val; }
            if (invYYYYMMDD >= mtdStartYYYYMMDD && invYYYYMMDD <= ftdYYYYMMDD)            { totals.mtd_qty_ach   += qty; totals.mtd_value_ach   += val; }
            if (invYYYYMMDD >= lmtdStartYYYYMMDD && invYYYYMMDD <= lmftdYYYYMMDD)         { totals.lmtd_qty_ach  += qty; totals.lmtd_value_ach  += val; }
        }

        // Subtract returns
        for (const row of dbSrnRows) {
            const retDate    = new Date(row.sales_return_date);
            const retYYYYMMDD = formatToYYYYMMDD(retDate);
            const qty = parseFloat(row.qty) || 0;
            const val = parseFloat(row.net_amount) || 0;

            if (retYYYYMMDD === ftdYYYYMMDD)                                               { totals.ftd_qty_ach   -= qty; totals.ftd_value_ach   -= val; }
            if (retYYYYMMDD === lmftdYYYYMMDD)                                             { totals.lmftd_qty_ach -= qty; totals.lmftd_value_ach -= val; }
            if (retYYYYMMDD >= mtdStartYYYYMMDD && retYYYYMMDD <= ftdYYYYMMDD)            { totals.mtd_qty_ach   -= qty; totals.mtd_value_ach   -= val; }
            if (retYYYYMMDD >= lmtdStartYYYYMMDD && retYYYYMMDD <= lmftdYYYYMMDD)         { totals.lmtd_qty_ach  -= qty; totals.lmtd_value_ach  -= val; }
        }

        // Clamp negatives to 0
        if (totals.ftd_qty_ach   < 0) totals.ftd_qty_ach   = 0;
        if (totals.ftd_value_ach < 0) totals.ftd_value_ach = 0;
        if (totals.lmftd_qty_ach   < 0) totals.lmftd_qty_ach   = 0;
        if (totals.lmftd_value_ach < 0) totals.lmftd_value_ach = 0;
        if (totals.mtd_qty_ach   < 0) totals.mtd_qty_ach   = 0;
        if (totals.mtd_value_ach < 0) totals.mtd_value_ach = 0;
        if (totals.lmtd_qty_ach  < 0) totals.lmtd_qty_ach  = 0;
        if (totals.lmtd_value_ach < 0) totals.lmtd_value_ach = 0;

        // Growth %
        totals.growth_qty_percentage   = totals.mtd_qty_ach   !== 0 ? ((totals.mtd_qty_ach   - totals.lmtd_qty_ach)   / totals.mtd_qty_ach)   * 100 : 0.00;
        totals.growth_value_percentage = totals.mtd_value_ach !== 0 ? ((totals.mtd_value_ach - totals.lmtd_value_ach) / totals.mtd_value_ach) * 100 : 0.00;

        res.status(200).json({
            success: true,
            message: 'Brand Wise Sales Totals aggregated successfully',
            totals
        });

    } catch (error) {
        console.error('Error in getBrandWiseSalesTotalsController:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error while retrieving brand wise sales totals'
        });
    }
};

module.exports = {
    syncBrandWiseSalesController,
    getBrandWiseSalesController,
    getBrandWiseSalesTotalsController
};

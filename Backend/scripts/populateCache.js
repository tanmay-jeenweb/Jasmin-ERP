/**
 * Jasmin ERP - Historical Cache Population Script
 *
 * Usage from terminal or cPanel:
 *   node scripts/populateCache.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Use native Node.js https/http modules to avoid undici's WebAssembly dependency
// which causes "Out of memory: Cannot allocate Wasm memory" on LVE-limited servers.
const https = require('https');
const http = require('http');

/**
 * Make an HTTP/HTTPS GET request using native Node.js modules (no WebAssembly).
 * Falls back from HTTPS to HTTP automatically if HTTPS fails.
 * Returns a promise that resolves with { ok, status, statusText, json() }.
 */
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
                // Allow self-signed / untrusted certs on the external API
                rejectUnauthorized: false,
                timeout: 60000
            };

            const req = requester.request(reqOptions, (res) => {
                let data = '';
                res.setEncoding('utf8');
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    const status = res.statusCode;
                    const ok = status >= 200 && status < 300;
                    resolve({
                        ok,
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
                    const httpUrl = requestUrl.replace('https://', 'http://');
                    console.warn(`HTTPS request timed out, retrying with HTTP fallback: ${httpUrl}`);
                    doRequest(httpUrl, true);
                } else {
                    reject(new Error(`Request timed out: ${requestUrl}`));
                }
            });

            req.on('error', (err) => {
                if (!isRetry && requestUrl.startsWith('https://')) {
                    const httpUrl = requestUrl.replace('https://', 'http://');
                    console.warn(`HTTPS request failed (${err.message}), retrying with HTTP fallback: ${httpUrl}`);
                    doRequest(httpUrl, true);
                } else {
                    reject(new Error(`Request failed: ${err.message}`));
                }
            });

            req.end();
        };

        doRequest(url, false);
    });
}

const db = require("../config/db.js");
const { syncTargetVsAchievementsController } = require("../controllers/targetVsAchievementController.js");

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

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function populate() {
    console.log("Checking database schema...");
    try {
        const [cols] = await db.execute("SHOW COLUMNS FROM sales_invoice_cache LIKE 'item_code'");
        if (cols.length === 0) {
            console.log("Migrating: Adding item_code to sales_invoice_cache...");
            await db.execute("ALTER TABLE sales_invoice_cache ADD COLUMN item_code VARCHAR(100) DEFAULT NULL AFTER branch_name");
            console.log("✅ Migrated: item_code column added.");
        } else {
            console.log("✅ Database schema is up to date.");
        }
    } catch (migrationError) {
        console.error("Migration check failed:", migrationError.message);
    }

    console.log("Starting historical cache population...");
    const startDate = new Date("2026-04-01");
    const endDate = new Date(); // dynamic: today


    let currentStart = new Date(startDate);
    while (currentStart <= endDate) {
        let currentEnd = new Date(currentStart);
        currentEnd.setDate(currentEnd.getDate() + 9);
        if (currentEnd > endDate) {
            currentEnd = new Date(endDate);
        }


        const startStr = formatToYYYYMMDD(currentStart);
        const endStr = formatToYYYYMMDD(currentEnd);

        const startDbStr = formatToDbDateStr(currentStart);
        const endDbStr = formatToDbDateStr(currentEnd);

        console.log(`\n--------------------------------------------`);
        console.log(`Processing chunk: ${startDbStr} to ${endDbStr} (${startStr} to ${endStr})`);

        try {
            const apiUrl = `https://apxwapi.jasminmobile.com:81/api/apxapi/GetExtendedInvoiceDetails?CompanyCode=JITPL&InvoiceStartDate=${startStr}&InvoiceEndDate=${endStr}&SalespersonCode=0`;
            const response = await nativeFetch(apiUrl, {
                method: 'GET',
                headers: {
                    'userid': process.env.MODEL_API_USERID || 'WebSite',
                    'Securitycode': process.env.MODEL_API_SECURITYCODE || '1151-8111-6444-4166',
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                console.error(`Failed to fetch chunk ${startStr} to ${endStr}: ${response.statusText}`);
                currentStart.setDate(currentStart.getDate() + 10);
                continue;
            }

            const invoices = await response.json();
            console.log(`Fetched ${invoices.length || 0} invoices from external API.`);

            const srnApiUrl = `https://apxwapi.jasminmobile.com:81/api/apxapi/GetExtendedSalesReturnDetails?CompanyCode=JITPL&SRNStartDate=${startStr}&SRNEndDate=${endStr}&BranchCode=0&SalespersonCode=0`;
            const srnResponse = await nativeFetch(srnApiUrl, {
                method: 'GET',
                headers: {
                    'userid': process.env.MODEL_API_USERID || 'WebSite',
                    'Securitycode': process.env.MODEL_API_SECURITYCODE || '1151-8111-6444-4166',
                    'Accept': 'application/json'
                }
            });

            if (!srnResponse.ok) {
                console.error(`Failed to fetch sales returns chunk ${startStr} to ${endStr}: ${srnResponse.statusText}`);
                currentStart.setDate(currentStart.getDate() + 10);
                continue;
            }

            const salesReturns = await srnResponse.json();
            console.log(`Fetched ${salesReturns.length || 0} sales returns from external API.`);

            const insertValues = [];
            if (invoices && invoices.length > 0) {
                for (const invoice of invoices) {
                    const invoiceNo = invoice.invoicePrimaryData?.InvoiceNo;
                    const invoiceDateStr = invoice.invoicePrimaryData?.InvoiceDate; // "DD/MM/YYYY"
                    const branchCode = invoice.invoicePrimaryData?.BranchCode;
                    const branchName = invoice.invoicePrimaryData?.BranchName;
                    if (!invoiceNo || !invoiceDateStr) continue;

                    const [id, im, iy] = invoiceDateStr.split('/');
                    const invoiceDbDate = `${iy}-${im.padStart(2, '0')}-${id.padStart(2, '0')}`;

                    if (Array.isArray(invoice.invoiceItemData)) {
                        for (const item of invoice.invoiceItemData) {
                            const itemDesc = item.ItemDescription || '';
                            const parts = itemDesc.split(':');
                            if (parts.length < 2) continue;

                            // Product type may be first OR last segment depending on API version
                            const firstPart = parts[0].trim().toUpperCase();
                            const lastPart = parts[parts.length - 1].trim().toUpperCase();
                            let productType = null;
                            let itemModelName = '';
                            if (allowedProductTypes.includes(lastPart)) {
                                productType = lastPart;
                                itemModelName = parts.slice(0, parts.length - 1).join(':').trim();
                            } else if (allowedProductTypes.includes(firstPart)) {
                                productType = firstPart;
                                itemModelName = parts.slice(1).join(':').trim();
                            } else {
                                continue;
                            }

                            const qty = parseFloat(item.Qty || item.SalesQty) || 0;
                            const amount = parseFloat(item.NetAmount || item.TotalAmount) || 0;
                            const itemCode = item.ItemCode || '';

                            insertValues.push([
                                invoiceNo,
                                invoiceDbDate,
                                branchCode,
                                branchName,
                                itemCode,
                                itemModelName,
                                qty,
                                amount,
                                'INVOICE'
                            ]);
                        }
                    }
                }
            }

            if (salesReturns && salesReturns.length > 0) {
                for (const srn of salesReturns) {
                    const srnNo = srn.srnPrimaryData?.SRNNo || srn.srnPrimaryData?.InvoiceNo;
                    const srnDateStr = srn.srnPrimaryData?.SRNDate || srn.srnPrimaryData?.InvoiceDate;
                    const branchCode = srn.srnPrimaryData?.BranchCode;
                    const branchName = srn.srnPrimaryData?.BranchName;
                    if (!srnNo || !srnDateStr) continue;

                    const [sd, sm, sy] = srnDateStr.split('/');
                    const srnDbDate = `${sy}-${sm.padStart(2, '0')}-${sd.padStart(2, '0')}`;

                    if (Array.isArray(srn.srnItemData)) {
                        for (const item of srn.srnItemData) {
                            const itemDesc = item.ItemDescription || '';
                            const parts = itemDesc.split(':');
                            if (parts.length < 2) continue;

                            // Product type may be first OR last segment
                            const firstPart = parts[0].trim().toUpperCase();
                            const lastPart = parts[parts.length - 1].trim().toUpperCase();
                            let productType = null;
                            let itemModelName = '';
                            if (allowedProductTypes.includes(lastPart)) {
                                productType = lastPart;
                                itemModelName = parts.slice(0, parts.length - 1).join(':').trim();
                            } else if (allowedProductTypes.includes(firstPart)) {
                                productType = firstPart;
                                itemModelName = parts.slice(1).join(':').trim();
                            } else {
                                continue;
                            }

                            const qty = parseFloat(item.Qty || item.SRNQty) || 0;
                            const amount = parseFloat(item.NetAmount || item.TotalAmount) || 0;
                            const itemCode = item.ItemCode || '';

                            insertValues.push([
                                srnNo,
                                srnDbDate,
                                branchCode,
                                branchName,
                                itemCode,
                                itemModelName,
                                qty,
                                amount,
                                'RETURN'
                            ]);
                        }
                    }
                }
            }

            console.log(`Prepared ${insertValues.length} items for insertion into sales_invoice_cache.`);
            if (insertValues.length === 0 && invoices.length > 0) {
                // Log a sample description to help diagnose format issues
                const sampleInvoice = invoices.find(inv => Array.isArray(inv.invoiceItemData) && inv.invoiceItemData.length > 0);
                if (sampleInvoice) {
                    console.warn(`  [DEBUG] Sample ItemDescription: "${sampleInvoice.invoiceItemData[0]?.ItemDescription}"`);
                }
            }

            if (insertValues.length > 0) {
                const insertQuery = `
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
                `;
                await db.query(insertQuery, [insertValues]);
                console.log(`Upserted ${insertValues.length} records into sales_invoice_cache.`);
            }

        } catch (fetchErr) {
            console.error(`Error processing chunk ${startStr} to ${endStr}:`, fetchErr.message);
        }

        await sleep(500);
        currentStart.setDate(currentStart.getDate() + 10);
    }

    console.log("\n--------------------------------------------");
    console.log("Historical cache population finished.");
    console.log("Triggering final Target vs Achievement sync...");

    const mockReq = {
        user: { id: 1, name: 'System Populate' },
        headers: { 'x-device-id': 'System-Script' },
        body: { date: formatToDbDateStr(endDate) }
    };
    const mockRes = {
        status: (code) => {
            console.log(`Sync status response code: ${code}`);
            return {
                json: (data) => console.log("Sync JSON response payload:", data)
            };
        }
    };

    try {
        await syncTargetVsAchievementsController(mockReq, mockRes);
    } catch (syncErr) {
        console.error("Failed to run target vs achievement sync after populating:", syncErr.message);
    }

    console.log("Population and initial calculations completed successfully.");
    try {
        await db.end();
    } catch (e) {
        console.error("Error closing database connection pool:", e.message);
    }
    process.exit(0);
}

populate();

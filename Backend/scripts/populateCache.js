/**
 * Jasmin ERP - Historical Cache Population Script
 * 
 * Usage from terminal or cPanel:
 *   node scripts/populateCache.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Patch global.fetch to support HTTP fallback along with HTTPS for API requests
const originalFetch = global.fetch;
if (originalFetch) {
    global.fetch = async function (url, options = {}) {
        try {
            const response = await originalFetch(url, options);
            if (response.ok) return response;
            throw new Error(`HTTP error! status: ${response.status}`);
        } catch (err) {
            if (typeof url === "string" && url.startsWith("https://")) {
                const httpUrl = url.replace("https://", "http://");
                console.warn(`HTTPS sync request failed, retrying with HTTP fallback: ${httpUrl}`);
                try {
                    const response = await originalFetch(httpUrl, options);
                    if (response.ok) return response;
                    throw new Error(`HTTP error! status: ${response.status}`);
                } catch (httpErr) {
                    throw new Error(`Both HTTPS and HTTP failed. HTTPS error: ${err.message}. HTTP error: ${httpErr.message}`);
                }
            }
            throw err;
        }
    };
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
            const response = await fetch(apiUrl, {
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
            const srnResponse = await fetch(srnApiUrl, {
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

                            const rawType = parts[0].trim().toUpperCase();
                            if (!allowedProductTypes.includes(rawType)) continue;

                            const itemModelName = parts.slice(1).join(':').trim();
                            const qty = parseFloat(item.SalesQty) || 0;
                            const amount = parseFloat(item.TotalAmount) || 0;

                            insertValues.push([
                                invoiceNo,
                                invoiceDbDate,
                                branchCode,
                                branchName,
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

                            const rawType = parts[0].trim().toUpperCase();
                            if (!allowedProductTypes.includes(rawType)) continue;

                            const itemModelName = parts.slice(1).join(':').trim();
                            const qty = parseFloat(item.SRNQty || item.SalesQty) || 0;
                            const amount = parseFloat(item.TotalAmount) || 0;

                            insertValues.push([
                                srnNo,
                                srnDbDate,
                                branchCode,
                                branchName,
                                itemModelName,
                                qty,
                                amount,
                                'RETURN'
                            ]);
                        }
                    }
                }
            }

            if (insertValues.length > 0) {
                const insertQuery = `
                    INSERT INTO sales_invoice_cache 
                    (invoice_no, invoice_date, branch_code, branch_name, item_model_name, qty, amount, record_type)
                    VALUES ?
                    ON DUPLICATE KEY UPDATE
                        invoice_date = VALUES(invoice_date),
                        branch_code = VALUES(branch_code),
                        branch_name = VALUES(branch_name),
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

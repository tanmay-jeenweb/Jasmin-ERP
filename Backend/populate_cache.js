require("dotenv").config();
const db = require("./config/db.js");
const { syncTargetVsAchievementsController } = require("./controllers/targetVsAchievementController.js");

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
                            const lastPart = parts[parts.length - 1]?.trim().toUpperCase();

                            if (parts.length > 1 && allowedProductTypes.includes(lastPart)) {
                                insertValues.push([
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
            }

            const srnInsertValues = [];
            if (salesReturns && salesReturns.length > 0) {
                for (const srn of salesReturns) {
                    const srnNo = srn.SRNPrimaryData?.SalesReturnNo;
                    const srnDateStr = srn.SRNPrimaryData?.SalesReturnDate; // "DD/MM/YYYY"
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
                                srnInsertValues.push([
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
            }

            const connection = await db.getConnection();
            try {
                await connection.beginTransaction();

                console.log(`Deleting local database entries for range ${startDbStr} to ${endDbStr}...`);
                await connection.execute(
                    `DELETE FROM synced_invoice_items WHERE invoice_date BETWEEN ? AND ?`,
                    [startDbStr, endDbStr]
                );
                await connection.execute(
                    `DELETE FROM synced_sales_return_items WHERE sales_return_date BETWEEN ? AND ?`,
                    [startDbStr, endDbStr]
                );

                if (insertValues.length > 0) {
                    console.log(`Inserting ${insertValues.length} invoice items into synced_invoice_items...`);
                    const insertQuery = `
                        INSERT INTO synced_invoice_items (
                            invoice_no, invoice_date, branch_code, branch_name, item_code, item_description, qty, net_amount, product_type
                        ) VALUES ?
                    `;
                    await connection.query(insertQuery, [insertValues]);
                }

                if (srnInsertValues.length > 0) {
                    console.log(`Inserting ${srnInsertValues.length} return items into synced_sales_return_items...`);
                    const insertQuery = `
                        INSERT INTO synced_sales_return_items (
                            sales_return_no, sales_return_date, branch_code, branch_name, item_code, item_description, qty, net_amount, product_type
                        ) VALUES ?
                    `;
                    await connection.query(insertQuery, [srnInsertValues]);
                }

                await connection.commit();
                console.log(`Completed database updates for range ${startDbStr} to ${endDbStr}.`);
            } catch (dbErr) {
                await connection.rollback();
                console.error("Database transaction error for chunk:", dbErr.message);
            } finally {
                connection.release();
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

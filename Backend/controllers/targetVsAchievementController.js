const {
    getAllTargetVsAchievements,
    getABMWiseTargetVsAchievements,
    upsertTargetVsAchievements,
    upsertAchievements
} = require('../models/targetVsAchievementModel.js');
const { getAllBranches } = require('../models/branchModel.js');
const { createAuditLog } = require('../models/auditLogModel.js');
const db = require('../config/db.js');

const getAllTargetVsAchievementsController = async (req, res) => {
    try {
        const records = await getAllTargetVsAchievements();
        res.status(200).json({
            success: true,
            message: 'Target vs Achievement records retrieved successfully',
            data: records
        });
    } catch (error) {
        console.error('Error retrieving target vs achievement records:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const getABMWiseTargetVsAchievementsController = async (req, res) => {
    try {
        const records = await getABMWiseTargetVsAchievements();
        res.status(200).json({
            success: true,
            message: 'ABM Wise Target vs Achievement records retrieved successfully',
            data: records
        });
    } catch (error) {
        console.error('Error retrieving ABM wise target vs achievement records:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const importTargetVsAchievementsController = async (req, res) => {
    try {
        const records = req.body;
        const addedBy = req.user.id;
        const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';

        if (!Array.isArray(records) || records.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid records list'
            });
        }

        // Validate branch name is present in all rows
        for (const r of records) {
            if (!r.branch_name) {
                return res.status(400).json({
                    success: false,
                    message: 'Branch Name is required for all rows'
                });
            }
        }

        const now = new Date();
        const totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const remainingDays = totalDays - now.getDate() + 1;
        const remDays = remainingDays > 0 ? remainingDays : 1;

        await upsertTargetVsAchievements(records, addedBy, deviceId, remDays);

        try {
            await createAuditLog(
                addedBy,
                req.user?.name || req.user?.username || 'Unknown',
                deviceId,
                'Target vs Achievement Import',
                'updated',
                null,
                {
                    imported_count: records.length,
                    imported_at: new Date().toISOString()
                }
            );
        } catch (auditErr) {
            console.error("Failed to write audit log for target vs achievement import:", auditErr);
        }

        res.status(200).json({
            success: true,
            message: `Successfully imported ${records.length} target records.`
        });
    } catch (error) {
        console.error('Error importing target records:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error while importing targets'
        });
    }
};

const syncTargetVsAchievementsController = async (req, res) => {
    try {
        const addedBy = req.user.id;
        const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';

        // 1. Determine target date (default to current local date)
        let targetYear, targetMonth, targetDay;
        if (req.body.date) {
            const parts = req.body.date.split('-'); // Expected "YYYY-MM-DD"
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

        // Determine 5 days range ending on targetDate
        const syncStartDate = new Date(targetDate);
        syncStartDate.setDate(syncStartDate.getDate() - 4); // target date - 4 days = 5 days total inclusive

        const syncStartDateStr = formatToYYYYMMDD(syncStartDate);
        const syncEndDateStr = formatToYYYYMMDD(targetDate);

        const syncStartDbStr = formatToDbDateStr(syncStartDate);
        const syncEndDbStr = formatToDbDateStr(targetDate);

        console.log(`Syncing achievements from external API for range (last 5 days): ${syncStartDbStr} to ${syncEndDbStr}`);

        // 2. Fetch invoice details from external API for only the last 5 days
        const apiUrl = `https://apxwapi.jasminmobile.com:81/api/apxapi/GetExtendedInvoiceDetails?CompanyCode=JITPL&InvoiceStartDate=${syncStartDateStr}&InvoiceEndDate=${syncEndDateStr}&SalespersonCode=0`;
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
                message: `External API returned status: ${response.statusText}`
            });
        }

        const invoices = await response.json();
        console.log(`Fetched ${invoices.length || 0} invoice records from API for range ${syncStartDateStr} to ${syncEndDateStr}.`);

        // 2b. Fetch sales return details from external API for only the last 5 days
        const srnApiUrl = `https://apxwapi.jasminmobile.com:81/api/apxapi/GetExtendedSalesReturnDetails?CompanyCode=JITPL&SRNStartDate=${syncStartDateStr}&SRNEndDate=${syncEndDateStr}&BranchCode=0&SalespersonCode=0`;
        const srnResponse = await fetch(srnApiUrl, {
            method: 'GET',
            headers: {
                'userid': process.env.MODEL_API_USERID || 'WebSite',
                'Securitycode': process.env.MODEL_API_SECURITYCODE || '1151-8111-6444-4166',
                'Accept': 'application/json'
            }
        });

        if (!srnResponse.ok) {
            return res.status(srnResponse.status).json({
                success: false,
                message: `External Sales Return API returned status: ${srnResponse.statusText}`
            });
        }

        const salesReturns = await srnResponse.json();
        console.log(`Fetched ${salesReturns.length || 0} sales return records from API for range ${syncStartDateStr} to ${syncEndDateStr}.`);

        const allowedProductTypes = ['SMARTPHONE', 'FETURE PHONE', 'FEATURE PHONE', 'TABLET', 'I PAD', 'EOL MODEL'];
        const insertValues = [];
        const srnInsertValues = [];

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

        // DB operations: Transaction to delete & insert cache
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            console.log(`Deleting local cache for range ${syncStartDbStr} to ${syncEndDbStr}`);
            await connection.execute(
                `DELETE FROM synced_invoice_items WHERE invoice_date BETWEEN ? AND ?`,
                [syncStartDbStr, syncEndDbStr]
            );
            await connection.execute(
                `DELETE FROM synced_sales_return_items WHERE sales_return_date BETWEEN ? AND ?`,
                [syncStartDbStr, syncEndDbStr]
            );

            if (insertValues.length > 0) {
                console.log(`Inserting ${insertValues.length} invoice items into synced_invoice_items`);
                const insertQuery = `
                    INSERT INTO synced_invoice_items (
                        invoice_no, invoice_date, branch_code, branch_name, item_code, item_description, qty, net_amount, product_type
                    ) VALUES ?
                `;
                await connection.query(insertQuery, [insertValues]);
            }

            if (srnInsertValues.length > 0) {
                console.log(`Inserting ${srnInsertValues.length} return items into synced_sales_return_items`);
                const insertQuery = `
                    INSERT INTO synced_sales_return_items (
                        sales_return_no, sales_return_date, branch_code, branch_name, item_code, item_description, qty, net_amount, product_type
                    ) VALUES ?
                `;
                await connection.query(insertQuery, [srnInsertValues]);
            }

            await connection.commit();
        } catch (dbErr) {
            await connection.rollback();
            throw dbErr;
        } finally {
            connection.release();
        }

        // 3. Load branches to map branch codes to names
        const branches = await getAllBranches();
        const branchNameLookup = {};
        for (const b of branches) {
            if (b.code) {
                branchNameLookup[b.code.toUpperCase()] = b.name;
            }
            if (b.name) {
                branchNameLookup[b.name.toUpperCase()] = b.name;
            }
        }

        // Initialize achievement statistics map
        const achievementsMap = {};
        for (const b of branches) {
            achievementsMap[b.name] = {
                branch_name: b.name,
                ftd_qty_ach: 0,
                ftd_value_ach: 0.00,
                lmftd_qty_ach: 0,
                lmftd_value_ach: 0.00,
                mtd_qty_ach: 0,
                mtd_value_ach: 0.00,
                lmtd_qty_ach: 0,
                lmtd_value_ach: 0.00,
                btd_qty: 0,
                btd_value: 0.00,
                ddr_qty: 0,
                ddr_value: 0.00,
                growth_qty_percentage: 0.00,
                growth_value_percentage: 0.00
            };
        }

        // 4. Query local cache range: firstDayLastMonth to targetDate
        const startDateStr = formatToDbDateStr(firstDayLastMonth);
        const endDateStr = formatToDbDateStr(targetDate);
        console.log(`Querying local cache range: ${startDateStr} to ${endDateStr}`);

        const [dbRows] = await db.execute(
            `SELECT branch_code, branch_name, invoice_date, qty, net_amount 
             FROM synced_invoice_items 
             WHERE invoice_date BETWEEN ? AND ?`,
            [startDateStr, endDateStr]
        );
        console.log(`Retrieved ${dbRows.length} cached item rows from local database.`);

        const [dbSrnRows] = await db.execute(
            `SELECT branch_code, branch_name, sales_return_date, qty, net_amount 
             FROM synced_sales_return_items 
             WHERE sales_return_date BETWEEN ? AND ?`,
            [startDateStr, endDateStr]
        );
        console.log(`Retrieved ${dbSrnRows.length} cached sales return rows from local database.`);

        // Aggregate data
        const ftdYYYYMMDD = formatToYYYYMMDD(targetDate);
        const lmftdYYYYMMDD = formatToYYYYMMDD(lmTargetDate);
        const mtdStartYYYYMMDD = formatToYYYYMMDD(firstDayCurrentMonth);
        const lmtdStartYYYYMMDD = formatToYYYYMMDD(firstDayLastMonth);

        for (const row of dbRows) {
            const invoiceCode = (row.branch_code || '').toUpperCase();
            const invoiceName = (row.branch_name || '').toUpperCase();
            const branchName = branchNameLookup[invoiceCode] || branchNameLookup[invoiceName];

            if (!branchName) continue;

            const invDate = new Date(row.invoice_date);
            const invYYYYMMDD = formatToYYYYMMDD(invDate);

            const qty = parseFloat(row.qty) || 0;
            const value = parseFloat(row.net_amount) || 0;

            // FTD
            if (invYYYYMMDD === ftdYYYYMMDD) {
                achievementsMap[branchName].ftd_qty_ach += qty;
                achievementsMap[branchName].ftd_value_ach += value;
            }

            // LMFTD
            if (invYYYYMMDD === lmftdYYYYMMDD) {
                achievementsMap[branchName].lmftd_qty_ach += qty;
                achievementsMap[branchName].lmftd_value_ach += value;
            }

            // MTD
            if (invYYYYMMDD >= mtdStartYYYYMMDD && invYYYYMMDD <= ftdYYYYMMDD) {
                achievementsMap[branchName].mtd_qty_ach += qty;
                achievementsMap[branchName].mtd_value_ach += value;
            }

            // LMTD
            if (invYYYYMMDD >= lmtdStartYYYYMMDD && invYYYYMMDD <= lmftdYYYYMMDD) {
                achievementsMap[branchName].lmtd_qty_ach += qty;
                achievementsMap[branchName].lmtd_value_ach += value;
            }
        }

        // Subtract return details
        for (const row of dbSrnRows) {
            const srnCode = (row.branch_code || '').toUpperCase();
            const srnName = (row.branch_name || '').toUpperCase();
            const branchName = branchNameLookup[srnCode] || branchNameLookup[srnName];

            if (!branchName) continue;

            const srnDate = new Date(row.sales_return_date);
            const srnYYYYMMDD = formatToYYYYMMDD(srnDate);

            const qty = parseFloat(row.qty) || 0;
            const value = parseFloat(row.net_amount) || 0;

            // FTD
            if (srnYYYYMMDD === ftdYYYYMMDD) {
                achievementsMap[branchName].ftd_qty_ach -= qty;
                achievementsMap[branchName].ftd_value_ach -= value;
            }

            // LMFTD
            if (srnYYYYMMDD === lmftdYYYYMMDD) {
                achievementsMap[branchName].lmftd_qty_ach -= qty;
                achievementsMap[branchName].lmftd_value_ach -= value;
            }

            // MTD
            if (srnYYYYMMDD >= mtdStartYYYYMMDD && srnYYYYMMDD <= ftdYYYYMMDD) {
                achievementsMap[branchName].mtd_qty_ach -= qty;
                achievementsMap[branchName].mtd_value_ach -= value;
            }

            // LMTD
            if (srnYYYYMMDD >= lmtdStartYYYYMMDD && srnYYYYMMDD <= lmftdYYYYMMDD) {
                achievementsMap[branchName].lmtd_qty_ach -= qty;
                achievementsMap[branchName].lmtd_value_ach -= value;
            }
        }

        // Clamp negative achievements to 0
        for (const branchName of Object.keys(achievementsMap)) {
            const ach = achievementsMap[branchName];
            if (ach.ftd_qty_ach < 0) ach.ftd_qty_ach = 0;
            if (ach.ftd_value_ach < 0) ach.ftd_value_ach = 0;
            if (ach.lmftd_qty_ach < 0) ach.lmftd_qty_ach = 0;
            if (ach.lmftd_value_ach < 0) ach.lmftd_value_ach = 0;
            if (ach.mtd_qty_ach < 0) ach.mtd_qty_ach = 0;
            if (ach.mtd_value_ach < 0) ach.mtd_value_ach = 0;
            if (ach.lmtd_qty_ach < 0) ach.lmtd_qty_ach = 0;
            if (ach.lmtd_value_ach < 0) ach.lmtd_value_ach = 0;
        }

        // 5. Query current target values to calculate MTD percentages
        const currentTargetVsAchievements = await getAllTargetVsAchievements();
        const targetsLookup = {};
        for (const r of currentTargetVsAchievements) {
            targetsLookup[r.branch_name] = {
                qty_tgt: r.qty_tgt,
                value_tgt: r.value_tgt
            };
        }

        // 6. Calculate percentages, BTD, DDR, and Growth percentages
        const totalDays = new Date(targetYear, targetMonth + 1, 0).getDate();
        const remainingDays = totalDays - targetDay + 1;
        const remDays = remainingDays > 0 ? remainingDays : 1;

        for (const name of Object.keys(achievementsMap)) {
            const ach = achievementsMap[name];
            const target = targetsLookup[name] || { qty_tgt: null, value_tgt: null };

            const qtyTgt = parseFloat(target.qty_tgt) || 0;
            const valTgt = parseFloat(target.value_tgt) || 0;

            ach.mtd_qty_percentage_ach = qtyTgt > 0 ? (ach.mtd_qty_ach / qtyTgt) * 100 : 0.00;
            ach.mtd_value_percentage_ach = valTgt > 0 ? (ach.mtd_value_ach / valTgt) * 100 : 0.00;

            // BTD calculations
            ach.btd_qty = qtyTgt - ach.mtd_qty_ach;
            ach.btd_value = valTgt - ach.mtd_value_ach;

            // DDR calculations
            ach.ddr_qty = ach.btd_qty / remDays;
            ach.ddr_value = ach.btd_value / remDays;

            // Growth % calculations: ((MTD - LMTD) / MTD) * 100
            const mtdQty = parseFloat(ach.mtd_qty_ach) || 0;
            const lmtdQty = parseFloat(ach.lmtd_qty_ach) || 0;
            ach.growth_qty_percentage = mtdQty !== 0 ? ((mtdQty - lmtdQty) / mtdQty) * 100 : 0.00;

            const mtdVal = parseFloat(ach.mtd_value_ach) || 0;
            const lmtdVal = parseFloat(ach.lmtd_value_ach) || 0;
            ach.growth_value_percentage = mtdVal !== 0 ? ((mtdVal - lmtdVal) / mtdVal) * 100 : 0.00;
        }

        // 7. Save changes
        const recordsArray = Object.values(achievementsMap);
        await upsertAchievements(recordsArray, addedBy, deviceId);

        try {
            await createAuditLog(
                addedBy,
                req.user?.name || req.user?.username || 'Unknown',
                deviceId,
                'Target vs Achievement Sync',
                'updated',
                null,
                {
                    target_date: ftdYYYYMMDD,
                    sync_count: recordsArray.length,
                    synced_at: new Date().toISOString()
                }
            );
        } catch (auditErr) {
            console.error("Failed to write audit log for target sync:", auditErr);
        }

        res.status(200).json({
            success: true,
            message: ` Sync Successfull`
        });

    } catch (error) {
        console.error('Error syncing target vs achievements:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error while syncing achievements'
        });
    }
};

module.exports = {
    getAllTargetVsAchievementsController,
    getABMWiseTargetVsAchievementsController,
    importTargetVsAchievementsController,
    syncTargetVsAchievementsController
};

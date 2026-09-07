const {
    getAllTargetVsAchievements,
    getABMWiseTargetVsAchievements,
    upsertTargetVsAchievements,
    upsertAchievements
} = require('../models/targetVsAchievementModel.js');
const { getAllBranches } = require('../models/branchModel.js');
const { createAuditLog } = require('../models/auditLogModel.js');
const db = require('../config/db.js');
const https = require('https');
const http = require('http');

// Native fetch using Node.js https/http — avoids undici WebAssembly which
// crashes on CloudLinux/LVE shared hosting ("Out of memory: Cannot allocate Wasm memory").
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
                    console.warn(`HTTPS timed out, retrying with HTTP: ${httpUrl}`);
                    doRequest(httpUrl, true);
                } else {
                    reject(new Error(`Request timed out: ${requestUrl}`));
                }
            });
            req.on('error', (err) => {
                if (!isRetry && requestUrl.startsWith('https://')) {
                    const httpUrl = requestUrl.replace('https://', 'http://');
                    console.warn(`HTTPS failed (${err.message}), retrying with HTTP: ${httpUrl}`);
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

// Helper to filter records by user's state restrictions
const filterRecordsByUserState = async (userId, records) => {
    const [userRows] = await db.execute("SELECT state FROM users WHERE id = ?", [userId]);
    let userStates = null;
    if (userRows.length > 0 && userRows[0].state) {
        try {
            userStates = typeof userRows[0].state === 'string' ? JSON.parse(userRows[0].state) : userRows[0].state;
        } catch (e) {
            userStates = null;
        }
    }

    if (userStates && Array.isArray(userStates) && userStates.length > 0 && !userStates.includes("All")) {
        const upperUserStates = userStates.map(s => String(s).trim().toUpperCase());
        return records.filter(r => r.state_name && upperUserStates.includes(String(r.state_name).trim().toUpperCase()));
    }
    return records;
};

// Helper to retrieve allowed branch names for a user based on User Branch Mapping
const getUserAllowedBranchNames = async (user) => {
    if (!user || !user.id) return [];

    // Check if user is admin from JWT user object
    const isAdmin = user.role === 'admin' || user.role === 'super admin';
    if (isAdmin) {
        return null; // null indicates access to ALL branches
    }

    // Double check user role / user type in database
    const [userRows] = await db.execute(
        `SELECT u.id, u.role, ut.user_role, ut.type_name, u.state 
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

    // Fetch mapped branch names for non-admin user from user_branch_mappings
    const [mappingRows] = await db.execute(
        `SELECT bm.name AS branch_name
         FROM user_branch_mappings ubm
         JOIN branch_master bm ON ubm.branch_id = bm.id
         WHERE ubm.user_id = ?`,
        [user.id]
    );

    if (mappingRows.length > 0) {
        return mappingRows.map(r => String(r.branch_name).trim().toUpperCase());
    }

    // If no branch mappings exist, check if the user has state restrictions
    if (userRows.length > 0 && userRows[0].state) {
        try {
            const userStates = typeof userRows[0].state === 'string' ? JSON.parse(userRows[0].state) : userRows[0].state;
            if (userStates && Array.isArray(userStates) && userStates.length > 0 && !userStates.includes("All")) {
                return null;
            }
        } catch (e) {
            console.error("Error parsing user state in getUserAllowedBranchNames:", e);
        }
    }

    return [];
};

// Date formatting and parsing helpers
const toYYYYMMDD = (val) => {
    if (!val) return '';
    if (typeof val === 'string') {
        const datePart = val.split('T')[0].split(' ')[0];
        const parts = datePart.split('-');
        if (parts.length === 3) {
            return `${parts[0]}${parts[1].padStart(2, '0')}${parts[2].padStart(2, '0')}`;
        }
    }
    if (val instanceof Date) {
        const year = val.getFullYear();
        const month = String(val.getMonth() + 1).padStart(2, '0');
        const day = String(val.getDate()).padStart(2, '0');
        return `${year}${month}${day}`;
    }
    return '';
};

const formatToDbDateStr = (d) => {
    if (!d) return '';
    if (typeof d === 'string') {
        const datePart = d.split('T')[0].split(' ')[0];
        if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart;
    }
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const formatToYYYYMMDD = (d) => {
    return toYYYYMMDD(d);
};

const calculateAchievementsForTargetDate = async (targetDateStr, baseRecords) => {
    if (!targetDateStr || !Array.isArray(baseRecords) || baseRecords.length === 0) {
        return baseRecords;
    }

    const parts = targetDateStr.split('-');
    if (parts.length !== 3) return baseRecords;
    const targetYear = parseInt(parts[0], 10);
    const targetMonth = parseInt(parts[1], 10) - 1;
    const targetDay = parseInt(parts[2], 10);
    if (isNaN(targetYear) || isNaN(targetMonth) || isNaN(targetDay)) return baseRecords;

    const targetDate = new Date(targetYear, targetMonth, targetDay);
    const lmTargetDate = new Date(targetYear, targetMonth - 1, 1);
    const maxDaysLastMonth = new Date(targetYear, targetMonth, 0).getDate();
    lmTargetDate.setDate(Math.min(targetDay, maxDaysLastMonth));

    const firstDayCurrentMonth = new Date(targetYear, targetMonth, 1);
    const firstDayLastMonth = new Date(targetYear, targetMonth - 1, 1);

    const startDateStr = formatToDbDateStr(firstDayLastMonth);
    const endDateStr = formatToDbDateStr(targetDate);

    // Load branches to map branch codes to names
    const branches = await getAllBranches();
    const branchNameLookup = {};
    for (const b of branches) {
        if (b.code) branchNameLookup[b.code.toUpperCase()] = b.name;
        if (b.name) branchNameLookup[b.name.toUpperCase()] = b.name;
    }

    // Initialize achievement statistics map for all branches
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

    // Query sales_invoice_cache
    const [dbRows] = await db.execute(
        `SELECT branch_code, branch_name, invoice_date, qty, amount AS net_amount
         FROM sales_invoice_cache
         WHERE record_type = 'INVOICE'
           AND invoice_date BETWEEN ? AND ?`,
        [startDateStr, endDateStr]
    );

    const [dbSrnRows] = await db.execute(
        `SELECT branch_code, branch_name, invoice_date AS sales_return_date, qty, amount AS net_amount
         FROM sales_invoice_cache
         WHERE record_type = 'RETURN'
           AND invoice_date BETWEEN ? AND ?`,
        [startDateStr, endDateStr]
    );

    const ftdYYYYMMDD = formatToYYYYMMDD(targetDate);
    const lmftdYYYYMMDD = formatToYYYYMMDD(lmTargetDate);
    const mtdStartYYYYMMDD = formatToYYYYMMDD(firstDayCurrentMonth);
    const lmtdStartYYYYMMDD = formatToYYYYMMDD(firstDayLastMonth);

    for (const row of dbRows) {
        const invoiceCode = (row.branch_code || '').toUpperCase();
        const invoiceName = (row.branch_name || '').toUpperCase();
        const branchName = branchNameLookup[invoiceCode] || branchNameLookup[invoiceName];
        if (!branchName || !achievementsMap[branchName]) continue;

        const invYYYYMMDD = toYYYYMMDD(row.invoice_date);
        const qty = parseFloat(row.qty) || 0;
        const value = parseFloat(row.net_amount) || 0;

        if (invYYYYMMDD === ftdYYYYMMDD) {
            achievementsMap[branchName].ftd_qty_ach += qty;
            achievementsMap[branchName].ftd_value_ach += value;
        }
        if (invYYYYMMDD === lmftdYYYYMMDD) {
            achievementsMap[branchName].lmftd_qty_ach += qty;
            achievementsMap[branchName].lmftd_value_ach += value;
        }
        if (invYYYYMMDD >= mtdStartYYYYMMDD && invYYYYMMDD <= ftdYYYYMMDD) {
            achievementsMap[branchName].mtd_qty_ach += qty;
            achievementsMap[branchName].mtd_value_ach += value;
        }
        if (invYYYYMMDD >= lmtdStartYYYYMMDD && invYYYYMMDD <= lmftdYYYYMMDD) {
            achievementsMap[branchName].lmtd_qty_ach += qty;
            achievementsMap[branchName].lmtd_value_ach += value;
        }
    }

    // Subtract returns
    for (const row of dbSrnRows) {
        const srnCode = (row.branch_code || '').toUpperCase();
        const srnName = (row.branch_name || '').toUpperCase();
        const branchName = branchNameLookup[srnCode] || branchNameLookup[srnName];
        if (!branchName || !achievementsMap[branchName]) continue;

        const srnYYYYMMDD = toYYYYMMDD(row.sales_return_date);
        const qty = parseFloat(row.qty) || 0;
        const value = parseFloat(row.net_amount) || 0;

        if (srnYYYYMMDD === ftdYYYYMMDD) {
            achievementsMap[branchName].ftd_qty_ach -= qty;
            achievementsMap[branchName].ftd_value_ach -= value;
        }
        if (srnYYYYMMDD === lmftdYYYYMMDD) {
            achievementsMap[branchName].lmftd_qty_ach -= qty;
            achievementsMap[branchName].lmftd_value_ach -= value;
        }
        if (srnYYYYMMDD >= mtdStartYYYYMMDD && srnYYYYMMDD <= ftdYYYYMMDD) {
            achievementsMap[branchName].mtd_qty_ach += qty;
            achievementsMap[branchName].mtd_value_ach += value;
        }
        if (srnYYYYMMDD >= lmtdStartYYYYMMDD && srnYYYYMMDD <= lmftdYYYYMMDD) {
            achievementsMap[branchName].lmtd_qty_ach += qty;
            achievementsMap[branchName].lmtd_value_ach += value;
        }
    }

    // Clamp negative achievements to 0
    for (const bName of Object.keys(achievementsMap)) {
        const ach = achievementsMap[bName];
        if (ach.ftd_qty_ach < 0) ach.ftd_qty_ach = 0;
        if (ach.ftd_value_ach < 0) ach.ftd_value_ach = 0;
        if (ach.lmftd_qty_ach < 0) ach.lmftd_qty_ach = 0;
        if (ach.lmftd_value_ach < 0) ach.lmftd_value_ach = 0;
        if (ach.mtd_qty_ach < 0) ach.mtd_qty_ach = 0;
        if (ach.mtd_value_ach < 0) ach.mtd_value_ach = 0;
        if (ach.lmtd_qty_ach < 0) ach.lmtd_qty_ach = 0;
        if (ach.lmtd_value_ach < 0) ach.lmtd_value_ach = 0;
    }

    const totalDays = new Date(targetYear, targetMonth + 1, 0).getDate();
    const remainingDays = totalDays - targetDay + 1;
    const remDays = remainingDays > 0 ? remainingDays : 1;

    return baseRecords.map(record => {
        const bName = record.branch_name;
        const ach = achievementsMap[bName] || {
            ftd_qty_ach: 0, ftd_value_ach: 0.00,
            lmftd_qty_ach: 0, lmftd_value_ach: 0.00,
            mtd_qty_ach: 0, mtd_value_ach: 0.00,
            lmtd_qty_ach: 0, lmtd_value_ach: 0.00
        };

        const qtyTgt = parseFloat(record.qty_tgt) || 0;
        const valTgt = parseFloat(record.value_tgt) || 0;

        const mtdQtyAch = ach.mtd_qty_ach;
        const mtdValAch = ach.mtd_value_ach;
        const lmtdQtyAch = ach.lmtd_qty_ach;
        const lmtdValAch = ach.lmtd_value_ach;

        const mtdQtyPct = qtyTgt > 0 ? (mtdQtyAch / qtyTgt) * 100 : 0.00;
        const mtdValPct = valTgt > 0 ? (mtdValAch / valTgt) * 100 : 0.00;

        const btdQty = qtyTgt - mtdQtyAch;
        const btdVal = valTgt - mtdValAch;

        const ddrQty = btdQty / remDays;
        const ddrVal = btdVal / remDays;

        const growthQtyPct = mtdQtyAch !== 0 ? ((mtdQtyAch - lmtdQtyAch) / mtdQtyAch) * 100 : 0.00;
        const growthValPct = mtdValAch !== 0 ? ((mtdValAch - lmtdValAch) / mtdValAch) * 100 : 0.00;

        return {
            ...record,
            ftd_qty_ach: ach.ftd_qty_ach,
            ftd_value_ach: ach.ftd_value_ach,
            lmftd_qty_ach: ach.lmftd_qty_ach,
            lmftd_value_ach: ach.lmftd_value_ach,
            mtd_qty_ach: mtdQtyAch,
            mtd_value_ach: mtdValAch,
            mtd_qty_percentage_ach: mtdQtyPct,
            mtd_value_percentage_ach: mtdValPct,
            lmtd_qty_ach: lmtdQtyAch,
            lmtd_value_ach: lmtdValAch,
            btd_qty: btdQty,
            btd_value: btdVal,
            ddr_qty: ddrQty,
            ddr_value: ddrVal,
            growth_qty_percentage: growthQtyPct,
            growth_value_percentage: growthValPct
        };
    });
};

const getAllTargetVsAchievementsController = async (req, res) => {
    try {
        // Purge any dummy 'TOTAL' row from the DB table
        await db.execute("DELETE FROM target_vs_achievements WHERE UPPER(TRIM(branch_name)) = 'TOTAL'").catch(() => {});

        let records = await getAllTargetVsAchievements();
        const allowedBranchNames = await getUserAllowedBranchNames(req.user);

        if (allowedBranchNames !== null) {
            records = records.filter(r => r.branch_name && allowedBranchNames.includes(String(r.branch_name).trim().toUpperCase()));
        }

        // Apply user state restrictions
        records = await filterRecordsByUserState(req.user.id, records);

        // Filter out any dummy TOTAL row
        records = records.filter(r => r.branch_name && String(r.branch_name).trim().toUpperCase() !== 'TOTAL');

        // If date parameter is passed, dynamically compute achievements for that target date
        if (req.query.date) {
            records = await calculateAchievementsForTargetDate(req.query.date, records);
        }

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
        let records = await getABMWiseTargetVsAchievements();
        const allowedBranchNames = await getUserAllowedBranchNames(req.user);

        if (allowedBranchNames !== null) {
            records = records.filter(r => r.branch_name && allowedBranchNames.includes(String(r.branch_name).trim().toUpperCase()));
        }

        // Apply user state restrictions
        records = await filterRecordsByUserState(req.user.id, records);

        // Filter out any dummy TOTAL row
        records = records.filter(r => r.branch_name && String(r.branch_name).trim().toUpperCase() !== 'TOTAL' && (!r.abm_name || String(r.abm_name).trim().toUpperCase() !== 'TOTAL'));

        // If date parameter is passed, dynamically compute achievements for that target date
        if (req.query.date) {
            records = await calculateAchievementsForTargetDate(req.query.date, records);
        }

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

        // Fetch user's state restriction from DB
        const [userRows] = await db.execute("SELECT state FROM users WHERE id = ?", [req.user.id]);
        let userStates = null;
        if (userRows.length > 0 && userRows[0].state) {
            try {
                userStates = typeof userRows[0].state === 'string' ? JSON.parse(userRows[0].state) : userRows[0].state;
            } catch (e) {
                userStates = null;
            }
        }

        const allowedBranchNames = await getUserAllowedBranchNames(req.user);

        // Pre-fetch all branch names in allowed states if state restriction exists
        let allowedStateBranchNames = null;
        if (userStates && Array.isArray(userStates) && userStates.length > 0 && !userStates.includes("All")) {
            const upperUserStates = userStates.map(s => String(s).trim().toUpperCase());
            const placeholders = upperUserStates.map(() => '?').join(',');
            const [branchRows] = await db.execute(
                `SELECT UPPER(bm.name) AS name 
                 FROM branch_master bm
                 JOIN state_master sm ON bm.state_id = sm.id
                 WHERE UPPER(sm.name) IN (${placeholders})`,
                upperUserStates
            );
            allowedStateBranchNames = new Set(branchRows.map(b => b.name));
        }

        // Filter out summary/total rows (e.g. "TOTAL" row at the bottom of templates)
        const validRecords = records.filter(r => {
            const b = String(r.branch_name || '').trim().toUpperCase();
            return b && b !== 'TOTAL';
        });

        if (validRecords.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid branch target records found to import'
            });
        }

        // Validate branch name is present in all rows and user has mapping/state access
        for (const r of validRecords) {
            if (!r.branch_name) {
                return res.status(400).json({
                    success: false,
                    message: 'Branch Name is required for all rows'
                });
            }

            const branchUpper = String(r.branch_name).trim().toUpperCase();

            // 1. Check branch mapping permission (if not admin/state manager)
            if (allowedBranchNames !== null) {
                if (!allowedBranchNames.includes(branchUpper)) {
                    return res.status(403).json({
                        success: false,
                        message: `Access Denied: You do not have permission to import target data for branch "${r.branch_name}".`
                    });
                }
            }

            // 2. Check state restriction permission
            if (allowedStateBranchNames !== null) {
                if (!allowedStateBranchNames.has(branchUpper)) {
                    return res.status(403).json({
                        success: false,
                        message: `Access Denied: Branch "${r.branch_name}" is outside your permitted states (${userStates.join(', ')}).`
                    });
                }
            }
        }

        const now = new Date();
        const totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const remainingDays = totalDays - now.getDate() + 1;
        const remDays = remainingDays > 0 ? remainingDays : 1;

        await upsertTargetVsAchievements(validRecords, addedBy, deviceId, remDays);

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

        // Self-heal/ensure item_code column exists
        try {
            const [cols] = await db.execute("SHOW COLUMNS FROM sales_invoice_cache LIKE 'item_code'");
            if (cols.length === 0) {
                console.log("Migrating (Controller): Adding item_code to sales_invoice_cache...");
                await db.execute("ALTER TABLE sales_invoice_cache ADD COLUMN item_code VARCHAR(100) DEFAULT NULL AFTER branch_name");
                console.log("✅ Migrated (Controller): item_code column added.");
            }
        } catch (migrationError) {
            console.error("Controller migration check failed:", migrationError.message);
        }


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
        const response = await nativeFetch(apiUrl, {
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
        const srnResponse = await nativeFetch(srnApiUrl, {
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

        // Also upsert the fresh 5-day data into sales_invoice_cache so MTD/LMTD
        // calculations (which read from sales_invoice_cache) stay current.
        if (insertValues.length > 0) {
            const cacheInvoiceValues = insertValues.map(row => {
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
            await db.query(`
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
            console.log(`Upserted ${cacheInvoiceValues.length} fresh invoice items into sales_invoice_cache.`);
        }
        if (srnInsertValues.length > 0) {
            const cacheReturnValues = srnInsertValues.map(row => {
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
            await db.query(`
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
            console.log(`Upserted ${cacheReturnValues.length} fresh return items into sales_invoice_cache.`);
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

        // 4. Query sales_invoice_cache (full historical data) for MTD/LMTD range
        // This table contains all data from the populate script + freshly synced data above.
        const startDateStr = formatToDbDateStr(firstDayLastMonth);
        const endDateStr = formatToDbDateStr(targetDate);
        console.log(`Querying sales_invoice_cache range: ${startDateStr} to ${endDateStr}`);

        const [dbRows] = await db.execute(
            `SELECT branch_code, branch_name, invoice_date, qty, amount AS net_amount
             FROM sales_invoice_cache
             WHERE record_type = 'INVOICE'
               AND invoice_date BETWEEN ? AND ?`,
            [startDateStr, endDateStr]
        );
        console.log(`Retrieved ${dbRows.length} invoice rows from sales_invoice_cache.`);

        const [dbSrnRows] = await db.execute(
            `SELECT branch_code, branch_name, invoice_date AS sales_return_date, qty, amount AS net_amount
             FROM sales_invoice_cache
             WHERE record_type = 'RETURN'
               AND invoice_date BETWEEN ? AND ?`,
            [startDateStr, endDateStr]
        );
        console.log(`Retrieved ${dbSrnRows.length} return rows from sales_invoice_cache.`);

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
            message: 'Internal server error while syncing achievements',
            error: error.message || String(error)
        });
    }
};

const getABMWiseTargetVsAchievementsSummaryController = async (req, res) => {
    try {
        const { state, states } = req.query;

        // Fetch user's state restriction from DB
        const [userRows] = await db.execute("SELECT state FROM users WHERE id = ?", [req.user.id]);
        let userStates = null;
        if (userRows.length > 0 && userRows[0].state) {
            try {
                userStates = typeof userRows[0].state === 'string' ? JSON.parse(userRows[0].state) : userRows[0].state;
            } catch (e) {
                userStates = null;
            }
        }

        const allowedBranchNames = await getUserAllowedBranchNames(req.user);

        // Fetch unique states restricted by allowed branch mapping and user state restrictions
        let stateQuery = `
            SELECT DISTINCT sm.name AS state_name 
            FROM target_vs_achievements t
            JOIN branch_master bm ON t.branch_name = bm.name
            JOIN state_master sm ON bm.state_id = sm.id
        `;
        const stateParams = [];
        const stateWhereClauses = [];

        if (allowedBranchNames !== null) {
            if (allowedBranchNames.length > 0) {
                const placeholders = allowedBranchNames.map(() => '?').join(',');
                stateWhereClauses.push(` bm.name IN (${placeholders}) `);
                stateParams.push(...allowedBranchNames);
            } else {
                stateWhereClauses.push(` 1=0 `);
            }
        }

        if (userStates && Array.isArray(userStates) && userStates.length > 0 && !userStates.includes("All")) {
            const placeholders = userStates.map(() => '?').join(',');
            stateWhereClauses.push(` sm.name IN (${placeholders}) `);
            stateParams.push(...userStates);
        }

        if (stateWhereClauses.length > 0) {
            stateQuery += ` WHERE ` + stateWhereClauses.join(' AND ');
        }
        stateQuery += ` ORDER BY sm.name ASC `;
        const [stateRows] = await db.execute(stateQuery, stateParams);
        const uniqueStates = stateRows.map(r => r.state_name);

        // Fetch target achievements records filtered by state/states at the DB level
        let records = await getABMWiseTargetVsAchievements(state, states);

        // 1. Filter by allowed branch mapping
        if (allowedBranchNames !== null) {
            records = records.filter(r => r.branch_name && allowedBranchNames.includes(String(r.branch_name).trim().toUpperCase()));
        }

        // 2. Filter by user state restrictions
        if (userStates && Array.isArray(userStates) && userStates.length > 0 && !userStates.includes("All")) {
            const upperUserStates = userStates.map(s => String(s).trim().toUpperCase());
            records = records.filter(r => r.state_name && upperUserStates.includes(String(r.state_name).trim().toUpperCase()));
        }

        // 3. Perform ABM-wise aggregation
        const groups = {};
        records.forEach(item => {
            const abm = item.abm_name || "—";
            if (!groups[abm]) {
                groups[abm] = {
                    abm_name: abm,
                    qty_tgt: 0,
                    value_tgt: 0,
                    ftd_qty_ach: 0,
                    ftd_value_ach: 0,
                    lmftd_qty_ach: 0,
                    lmftd_value_ach: 0,
                    mtd_qty_ach: 0,
                    mtd_value_ach: 0,
                    lmtd_qty_ach: 0,
                    lmtd_value_ach: 0,
                    btd_qty: 0,
                    btd_value: 0,
                    ddr_qty: 0,
                    ddr_value: 0
                };
            }

            groups[abm].qty_tgt += Number(item.qty_tgt || 0);
            groups[abm].value_tgt += Number(item.value_tgt || 0);
            groups[abm].ftd_qty_ach += Number(item.ftd_qty_ach || 0);
            groups[abm].ftd_value_ach += Number(item.ftd_value_ach || 0);
            groups[abm].lmftd_qty_ach += Number(item.lmftd_qty_ach || 0);
            groups[abm].lmftd_value_ach += Number(item.lmftd_value_ach || 0);
            groups[abm].mtd_qty_ach += Number(item.mtd_qty_ach || 0);
            groups[abm].mtd_value_ach += Number(item.mtd_value_ach || 0);
            groups[abm].lmtd_qty_ach += Number(item.lmtd_qty_ach || 0);
            groups[abm].lmtd_value_ach += Number(item.lmtd_value_ach || 0);
            groups[abm].btd_qty += Number(item.btd_qty || 0);
            groups[abm].btd_value += Number(item.btd_value || 0);
            groups[abm].ddr_qty += Number(item.ddr_qty || 0);
            groups[abm].ddr_value += Number(item.ddr_value || 0);
        });

        // 4. Calculate group percentages
        const abmGroups = Object.values(groups).map((group, index) => {
            const qtyTgt = group.qty_tgt;
            const valueTgt = group.value_tgt;
            const mtdQty = group.mtd_qty_ach;
            const mtdVal = group.mtd_value_ach;
            const lmtdQty = group.lmtd_qty_ach;
            const lmtdVal = group.lmtd_value_ach;

            const mtd_qty_percentage_ach = qtyTgt > 0 ? (mtdQty / qtyTgt) * 100 : 0;
            const mtd_value_percentage_ach = valueTgt > 0 ? (mtdVal / valueTgt) * 100 : 0;

            const growth_qty_percentage = mtdQty !== 0 ? ((mtdQty - lmtdQty) / mtdQty) * 100 : 0;
            const growth_value_percentage = mtdVal !== 0 ? ((mtdVal - lmtdVal) / mtdVal) * 100 : 0;

            return {
                ...group,
                id: index + 1,
                sr_no: index + 1,
                mtd_qty_percentage_ach,
                mtd_value_percentage_ach,
                growth_qty_percentage,
                growth_value_percentage
            };
        });

        // 5. Calculate overall totals
        const totals = {
            qty_tgt: 0,
            value_tgt: 0,
            ftd_qty_ach: 0,
            ftd_value_ach: 0,
            lmftd_qty_ach: 0,
            lmftd_value_ach: 0,
            mtd_qty_ach: 0,
            mtd_value_ach: 0,
            lmtd_qty_ach: 0,
            lmtd_value_ach: 0,
            btd_qty: 0,
            btd_value: 0,
            ddr_qty: 0,
            ddr_value: 0,
            mtd_qty_percentage_ach: 0,
            mtd_value_percentage_ach: 0,
            growth_qty_percentage: 0,
            growth_value_percentage: 0
        };

        abmGroups.forEach(g => {
            totals.qty_tgt += g.qty_tgt;
            totals.value_tgt += g.value_tgt;
            totals.ftd_qty_ach += g.ftd_qty_ach;
            totals.ftd_value_ach += g.ftd_value_ach;
            totals.lmftd_qty_ach += g.lmftd_qty_ach;
            totals.lmftd_value_ach += g.lmftd_value_ach;
            totals.mtd_qty_ach += g.mtd_qty_ach;
            totals.mtd_value_ach += g.mtd_value_ach;
            totals.lmtd_qty_ach += g.lmtd_qty_ach;
            totals.lmtd_value_ach += g.lmtd_value_ach;
            totals.btd_qty += g.btd_qty;
            totals.btd_value += g.btd_value;
            totals.ddr_qty += g.ddr_qty;
            totals.ddr_value += g.ddr_value;
        });

        totals.mtd_qty_percentage_ach = totals.qty_tgt > 0 ? (totals.mtd_qty_ach / totals.qty_tgt) * 100 : 0;
        totals.mtd_value_percentage_ach = totals.value_tgt > 0 ? (totals.mtd_value_ach / totals.value_tgt) * 100 : 0;
        totals.growth_qty_percentage = totals.mtd_qty_ach !== 0 ? ((totals.mtd_qty_ach - totals.lmtd_qty_ach) / totals.mtd_qty_ach) * 100 : 0;
        totals.growth_value_percentage = totals.mtd_value_ach !== 0 ? ((totals.mtd_value_ach - totals.lmtd_value_ach) / totals.mtd_value_ach) * 100 : 0;

        res.status(200).json({
            success: true,
            message: 'ABM Wise Target vs Achievement summary retrieved successfully',
            data: abmGroups,
            totals,
            states: uniqueStates
        });
    } catch (error) {
        console.error('Error retrieving ABM wise target vs achievement summary:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

module.exports = {
    getAllTargetVsAchievementsController,
    getABMWiseTargetVsAchievementsController,
    getABMWiseTargetVsAchievementsSummaryController,
    importTargetVsAchievementsController,
    syncTargetVsAchievementsController
};

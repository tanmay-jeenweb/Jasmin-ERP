const https = require('https');
const http = require('http');
const {
    upsertContestWinnings,
    getAllContestWinnings,
    getContestWinningsForReconciliation,
    recordSyncLog,
    getLastSyncLog
} = require('../models/contestWinningModel.js');

// Native fetch to avoid undici issues on shared hosting
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
            if (options.body) {
                req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
            }
            req.end();
        };
        doRequest(url, false);
    });
}

// Normalize invoice numbers for robust matching
const normalizeInvoiceNo = (val) => {
    if (!val) return '';
    return String(val).trim().toUpperCase().replace(/\s+/g, '');
};

// Normalize phone numbers (last 10 digits)
const normalizePhone = (val) => {
    if (!val) return '';
    const digits = String(val).replace(/\D/g, '');
    return digits.length > 10 ? digits.slice(-10) : digits;
};

// Format time difference into a readable string
const formatTimeDiff = (diffMinutes) => {
    if (diffMinutes === null || diffMinutes === undefined || isNaN(diffMinutes)) return 'N/A';
    const isNegative = diffMinutes < 0;
    const absMins = Math.abs(diffMinutes);

    let timeStr = '';
    if (absMins < 60) {
        timeStr = `${absMins}m`;
    } else if (absMins < 1440) {
        const hours = Math.floor(absMins / 60);
        const mins = absMins % 60;
        timeStr = mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    } else {
        const days = Math.floor(absMins / 1440);
        const hours = Math.floor((absMins % 1440) / 60);
        timeStr = hours > 0 ? `${days}d ${hours}h` : `${days}d`;
    }

    return isNegative ? `${timeStr} before bill (Pre-scratch)` : `${timeStr} after bill`;
};

/**
 * Controller: Sync contest winnings from external API
 */
const syncContestWinningsController = async (req, res) => {
    const syncedBy = req.user ? req.user.id : null;
    const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Web';

    const apiUrl = process.env.CONTEST_WINNINGS_API_URL || 'https://win.jasminmobile.com/api/winnings';
    const token = process.env.CONTEST_WINNINGS_API_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwicm9sZSI6ImFkbWluIiwibmFtZSI6InRhdHZhbV9zaGFoIiwidXNlcm5hbWUiOiJ0YXR2YW1fc2hhaCIsIm1vYl9ubyI6Ijk4MjQwNjE2MjAiLCJpYXQiOjE3OTE0NTM2NzYsImV4cCI6MTc5MTU0MDA3Nn0.c2s3tWLj27w-Xsh2ImBOuD3851kP8z4KdaB8CfDj9Mc';

    try {
        console.log(`[ContestSync] Fetching winnings from ${apiUrl}...`);
        const response = await nativeFetch(apiUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            const errText = await response.text();
            await recordSyncLog({
                syncedBy,
                deviceId,
                recordsFetched: 0,
                recordsInserted: 0,
                recordsUpdated: 0,
                syncStatus: 'FAILED',
                errorMessage: `External API error (${response.status}): ${errText.substring(0, 500)}`
            });

            return res.status(response.status).json({
                success: false,
                message: `Failed to fetch contest winnings from external API: ${response.statusText}`
            });
        }

        const data = await response.json();
        const winnings = data.winnings || (Array.isArray(data) ? data : []);

        console.log(`[ContestSync] Received ${winnings.length} winning records. Upserting into DB...`);
        const result = await upsertContestWinnings(winnings);

        await recordSyncLog({
            syncedBy,
            deviceId,
            recordsFetched: winnings.length,
            recordsInserted: result.affectedRows,
            recordsUpdated: 0,
            syncStatus: 'SUCCESS',
            errorMessage: null
        });

        const lastSync = await getLastSyncLog();

        return res.status(200).json({
            success: true,
            message: `Successfully synced ${winnings.length} contest winnings records.`,
            totalFetched: winnings.length,
            lastSync
        });
    } catch (error) {
        console.error('[ContestSync] Error syncing contest winnings:', error);
        await recordSyncLog({
            syncedBy,
            deviceId,
            recordsFetched: 0,
            recordsInserted: 0,
            recordsUpdated: 0,
            syncStatus: 'FAILED',
            errorMessage: error.message
        });

        return res.status(500).json({
            success: false,
            message: `Error syncing contest winnings: ${error.message}`
        });
    }
};

/**
 * Controller: Get Contest Winnings Master with search, filter, pagination
 */
const getContestWinningsMasterController = async (req, res) => {
    try {
        const {
            search = '',
            branch_code = '',
            status = '',
            from_date = '',
            to_date = '',
            page = 1,
            limit = 50,
            exportAll = false
        } = req.query;

        const result = await getAllContestWinnings({
            search,
            branch_code,
            status,
            from_date,
            to_date,
            page: parseInt(page),
            limit: parseInt(limit),
            exportAll: exportAll === 'true' || exportAll === true
        });

        const lastSync = await getLastSyncLog();

        return res.status(200).json({
            success: true,
            data: result.records,
            total: result.total,
            stats: result.stats,
            page: result.page,
            limit: result.limit,
            totalPages: result.totalPages,
            lastSync
        });
    } catch (error) {
        console.error('Error fetching contest winnings master:', error);
        return res.status(500).json({
            success: false,
            message: `Error fetching contest winnings: ${error.message}`
        });
    }
};

/**
 * Controller: Get Last Sync Details
 */
const getLastSyncDetailsController = async (req, res) => {
    try {
        const lastSync = await getLastSyncLog();
        return res.status(200).json({
            success: true,
            lastSync
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Controller: Scratch & Win Contest vs Invoice Reconciliation Report
 * Rule: Invoices are retrieved starting from 5th October 2026 onwards for maximum efficiency
 */
const getScratchWinReconciliationController = async (req, res) => {
    try {
        const {
            startDate = '2026-10-05',
            endDate,
            branchCode = '',
            statusFilter = 'ALL', // 'ALL' | 'MATCHED' | 'INVOICE_NOT_SCRATCHED' | 'WINNING_NO_INVOICE'
            search = '',
            page = 1,
            limit = 50,
            exportAll = false
        } = req.query;

        // Enforce minimum start date of 2026-10-05 (5th October 2026) for optimization
        const minStartDate = '2026-10-05';
        let effectiveStartDate = startDate && startDate >= minStartDate ? startDate : minStartDate;

        // Default end date to current date if not provided
        let effectiveEndDate = endDate;
        if (!effectiveEndDate) {
            const now = new Date();
            const y = now.getFullYear();
            const m = String(now.getMonth() + 1).padStart(2, '0');
            const d = String(now.getDate()).padStart(2, '0');
            effectiveEndDate = `${y}-${m}-${d}`;
        }

        const startYYYYMMDD = effectiveStartDate.replace(/-/g, '');
        const endYYYYMMDD = effectiveEndDate.replace(/-/g, '');

        console.log(`[Reconciliation] Running comparison for date range: ${effectiveStartDate} (${startYYYYMMDD}) to ${effectiveEndDate} (${endYYYYMMDD})`);

        // Parse multiple branches if provided (comma-separated or single)
        const branchList = (req.query.branchCodes || req.query.branchCode || '')
            ? String(req.query.branchCodes || req.query.branchCode).split(',').map(s => s.trim()).filter(Boolean)
            : [];

        // 1. Fetch ERP Extended Invoices from External ERP API for date range
        const invoiceApiUrl = `https://apxwapi.jasminmobile.com:81/api/apxapi/GetExtendedInvoiceDetails?CompanyCode=JITPL&InvoiceStartDate=${startYYYYMMDD}&InvoiceEndDate=${endYYYYMMDD}&SalespersonCode=0`;
        
        let invoiceList = [];
        try {
            const invoiceRes = await nativeFetch(invoiceApiUrl, {
                method: 'GET',
                headers: {
                    'userid': process.env.MODEL_API_USERID || 'WebSite',
                    'Securitycode': process.env.MODEL_API_SECURITYCODE || '1151-8111-6444-4166',
                    'Accept': 'application/json'
                }
            });

            if (invoiceRes.ok) {
                invoiceList = await invoiceRes.json();
                console.log(`[Reconciliation] Fetched ${invoiceList.length} invoice records from ERP API.`);
            } else {
                console.error(`[Reconciliation] ERP Invoice API returned error: ${invoiceRes.status}`);
            }
        } catch (apiErr) {
            console.error('[Reconciliation] Failed to fetch invoices from external API:', apiErr.message);
        }

        // 2. Fetch Contest Winnings from local contest_winnings_master table
        const contestWinnings = await getContestWinningsForReconciliation(effectiveStartDate, effectiveEndDate, branchList.length > 0 ? branchList : null);
        console.log(`[Reconciliation] Fetched ${contestWinnings.length} contest winning records from DB.`);

        // 3. Group and structure ERP Invoices by InvoiceNo
        const erpInvoicesMap = new Map();
        const erpInvoicesByNormalizedNo = new Map();

        for (const rawInv of invoiceList) {
            const pData = rawInv.invoicePrimaryData || {};
            const invNo = pData.InvoiceNo;
            if (!invNo) continue;

            const normInvNo = normalizeInvoiceNo(invNo);

            // If branch filter specified, check branch
            if (branchList.length > 0 && !branchList.includes(pData.BranchCode)) {
                continue;
            }

            // Build item descriptions summary
            const items = rawInv.invoiceItemData || [];
            const itemNames = items.map(it => it.ItemDescription || it.ItemCode || '').filter(Boolean);
            const totalQty = items.reduce((acc, it) => acc + (parseFloat(it.Qty) || 0), 0);

            // Parse invoice datetime
            let invoiceDateTime = null;
            let invoiceDateFormatted = pData.InvoiceDate || '';
            let invoiceTimeFormatted = pData.InvoiceTime || '';
            if (pData.InvoiceDate) {
                const parts = pData.InvoiceDate.split('/'); // DD/MM/YYYY
                if (parts.length === 3) {
                    const [d, m, y] = parts;
                    const timeParts = (pData.InvoiceTime || '00:00:00').split(':');
                    const hh = (timeParts[0] || '00').padStart(2, '0');
                    const mm = (timeParts[1] || '00').padStart(2, '0');
                    const ss = (timeParts[2] || '00').padStart(2, '0');
                    // Explicitly treat ERP invoice time as IST (UTC+05:30)
                    invoiceDateTime = new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T${hh}:${mm}:${ss}+05:30`);
                    invoiceDateFormatted = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
                }
            }

            const invoiceObj = {
                invoice_number: invNo,
                normalized_invoice_no: normInvNo,
                invoice_date: invoiceDateFormatted,
                invoice_time: invoiceTimeFormatted,
                invoice_datetime: invoiceDateTime,
                branch_code: pData.BranchCode || '',
                branch_name: pData.BranchName || '',
                customer_name: pData.PartyName || '',
                customer_phone: pData.PartyContactNo || '',
                normalized_phone: normalizePhone(pData.PartyContactNo),
                invoice_value: parseFloat(pData.InvoiceValue) || 0,
                salesperson_name: pData.SalespersonName || '',
                item_summary: itemNames.slice(0, 3).join(', ') + (itemNames.length > 3 ? ` (+${itemNames.length - 3} more)` : ''),
                item_count: items.length,
                total_qty: totalQty,
                raw_items: items
            };

            erpInvoicesMap.set(invNo, invoiceObj);
            erpInvoicesByNormalizedNo.set(normInvNo, invoiceObj);
        }

        // 4. Map Contest Winnings by normalized invoice number & customer phone
        const contestByNormInvNo = new Map();
        const contestByPhone = new Map();

        for (const win of contestWinnings) {
            const normInv = normalizeInvoiceNo(win.invoice_number);
            const normPh = normalizePhone(win.customer_phone);

            if (normInv) {
                contestByNormInvNo.set(normInv, win);
            }
            if (normPh) {
                if (!contestByPhone.has(normPh)) {
                    contestByPhone.set(normPh, []);
                }
                contestByPhone.get(normPh).push(win);
            }
        }

        // 5. Full Outer Join Reconciliation
        const matchedRows = [];
        const unmatchedInvoices = [];
        const matchedContestIds = new Set();
        let totalTimeDiffMinutes = 0;
        let matchedTimeDiffCount = 0;

        // Pass 1: Compare ERP Invoices against Contest Winnings
        for (const [normInvNo, inv] of erpInvoicesByNormalizedNo.entries()) {
            let matchedWin = contestByNormInvNo.get(normInvNo);

            // If not matched by invoice number, check fallback matching on normalized phone if present
            if (!matchedWin && inv.normalized_phone && contestByPhone.has(inv.normalized_phone)) {
                const candidates = contestByPhone.get(inv.normalized_phone);
                // Pick candidate that hasn't been matched yet
                const unassigned = candidates.find(c => !matchedContestIds.has(c.id));
                if (unassigned) {
                    matchedWin = unassigned;
                }
            }

            if (matchedWin) {
                matchedContestIds.add(matchedWin.id);

                // Compute time difference
                let scratchDateTime = matchedWin.scratch_created_at ? new Date(matchedWin.scratch_created_at) : null;
                let timeDiffMinutes = null;
                let timeDiffHuman = 'N/A';

                if (inv.invoice_datetime && scratchDateTime && !isNaN(scratchDateTime.getTime()) && !isNaN(inv.invoice_datetime.getTime())) {
                    const diffMs = scratchDateTime.getTime() - inv.invoice_datetime.getTime();
                    timeDiffMinutes = Math.round(diffMs / 60000);
                    timeDiffHuman = formatTimeDiff(timeDiffMinutes);
                    totalTimeDiffMinutes += timeDiffMinutes;
                    matchedTimeDiffCount++;
                }

                // Check exact match conditions:
                const invNoMatched = Boolean(normInvNo && normalizeInvoiceNo(matchedWin.invoice_number) === normInvNo);
                const phoneMatched = Boolean(inv.normalized_phone && normalizePhone(matchedWin.customer_phone) === inv.normalized_phone);

                // Fully matched = both invoice and phone match; Partially matched = only one matches
                const isFullyMatched = invNoMatched && phoneMatched;
                const matchStatus = isFullyMatched ? 'MATCHED' : 'PARTIALLY_MATCHED';
                const matchStatusLabel = isFullyMatched
                    ? 'Fully Matched'
                    : (invNoMatched ? 'Partially Matched (Phone Mismatch)' : 'Partially Matched (Invoice Mismatch)');
                const matchStatusColor = isFullyMatched ? 'green' : 'sky';

                matchedRows.push({
                    reconciliation_id: `MATCH-${inv.invoice_number}-${matchedWin.id}`,
                    match_status: matchStatus,
                    match_status_label: matchStatusLabel,
                    match_status_color: matchStatusColor,
                    is_fully_matched: isFullyMatched,
                    is_partially_matched: !isFullyMatched,
                    inv_no_matched: invNoMatched,
                    phone_match: phoneMatched,
                    time_diff_minutes: timeDiffMinutes,
                    time_diff_human: timeDiffHuman,
                    
                    // Invoice Details (ERP)
                    invoice_number: inv.invoice_number,
                    invoice_date: inv.invoice_date,
                    invoice_time: inv.invoice_time,
                    invoice_datetime: inv.invoice_datetime,
                    invoice_branch_code: inv.branch_code,
                    invoice_branch_name: inv.branch_name,
                    invoice_customer_name: inv.customer_name,
                    invoice_customer_phone: inv.customer_phone,
                    invoice_value: inv.invoice_value,
                    invoice_items: inv.item_summary,
                    salesperson_name: inv.salesperson_name,

                    // Contest Winning Details
                    contest_id: matchedWin.id,
                    contest_external_id: matchedWin.external_id,
                    contest_invoice_number: matchedWin.invoice_number,
                    contest_customer_name: matchedWin.customer_name,
                    contest_customer_phone: matchedWin.customer_phone,
                    contest_birthdate: matchedWin.birthdate,
                    contest_branch_code: matchedWin.branch_code,
                    contest_branch_name: matchedWin.branch_name,
                    contest_prize: matchedWin.product_name,
                    contest_status: matchedWin.status,
                    contest_campaign: matchedWin.form_name,
                    contest_scratch_time: matchedWin.scratch_created_at
                });
            } else {
                unmatchedInvoices.push({
                    reconciliation_id: `INV-${inv.invoice_number}`,
                    match_status: 'INVOICE_NOT_SCRATCHED',
                    match_status_label: 'Invoice Not Scratched',
                    match_status_color: 'amber',
                    is_fully_matched: false,
                    is_partially_matched: false,
                    inv_no_matched: false,
                    phone_match: null,
                    time_diff_minutes: null,
                    time_diff_human: 'Not Scratched',
                    phone_match: null,

                    // Invoice Details (ERP)
                    invoice_number: inv.invoice_number,
                    invoice_date: inv.invoice_date,
                    invoice_time: inv.invoice_time,
                    invoice_datetime: inv.invoice_datetime,
                    invoice_branch_code: inv.branch_code,
                    invoice_branch_name: inv.branch_name,
                    invoice_customer_name: inv.customer_name,
                    invoice_customer_phone: inv.customer_phone,
                    invoice_value: inv.invoice_value,
                    invoice_items: inv.item_summary,
                    salesperson_name: inv.salesperson_name,

                    // Contest Winning Details (Empty)
                    contest_id: null,
                    contest_external_id: null,
                    contest_invoice_number: null,
                    contest_customer_name: null,
                    contest_customer_phone: null,
                    contest_birthdate: null,
                    contest_branch_code: null,
                    contest_branch_name: null,
                    contest_prize: null,
                    contest_status: null,
                    contest_campaign: null,
                    contest_scratch_time: null
                });
            }
        }

        // Pass 2: Identify Contest Winnings that had no matching invoice in ERP
        const unmatchedContestWinnings = [];
        for (const win of contestWinnings) {
            if (!matchedContestIds.has(win.id)) {
                unmatchedContestWinnings.push({
                    reconciliation_id: `WIN-${win.id}`,
                    match_status: 'WINNING_NO_INVOICE',
                    match_status_label: 'Winning Without Invoice',
                    match_status_color: 'red',
                    time_diff_minutes: null,
                    time_diff_human: 'No Invoice Found',
                    phone_match: null,

                    // Invoice Details (Empty)
                    invoice_number: null,
                    invoice_date: null,
                    invoice_time: null,
                    invoice_datetime: null,
                    invoice_branch_code: null,
                    invoice_branch_name: null,
                    invoice_customer_name: null,
                    invoice_customer_phone: null,
                    invoice_value: null,
                    invoice_items: null,
                    salesperson_name: null,

                    // Contest Winning Details
                    contest_id: win.id,
                    contest_external_id: win.external_id,
                    contest_invoice_number: win.invoice_number,
                    contest_customer_name: win.customer_name,
                    contest_customer_phone: win.customer_phone,
                    contest_birthdate: win.birthdate,
                    contest_branch_code: win.branch_code,
                    contest_branch_name: win.branch_name,
                    contest_prize: win.product_name,
                    contest_status: win.status,
                    contest_campaign: win.form_name,
                    contest_scratch_time: win.scratch_created_at
                });
            }
        }

        // Combine all records
        let allReconciledRecords = [
            ...matchedRows,
            ...unmatchedInvoices,
            ...unmatchedContestWinnings
        ];

        // Apply Status Filter
        if (statusFilter && statusFilter !== 'ALL') {
            allReconciledRecords = allReconciledRecords.filter(r => r.match_status === statusFilter);
        }

        // Apply Search Filter
        if (search && search.trim()) {
            const q = search.trim().toLowerCase();
            allReconciledRecords = allReconciledRecords.filter(r => {
                const invNo = String(r.invoice_number || r.contest_invoice_number || '').toLowerCase();
                const custName = String(r.invoice_customer_name || r.contest_customer_name || '').toLowerCase();
                const phone = String(r.invoice_customer_phone || r.contest_customer_phone || '').toLowerCase();
                const branch = String(r.invoice_branch_name || r.contest_branch_name || r.invoice_branch_code || r.contest_branch_code || '').toLowerCase();
                const prize = String(r.contest_prize || '').toLowerCase();
                return invNo.includes(q) || custName.includes(q) || phone.includes(q) || branch.includes(q) || prize.includes(q);
            });
        }

        // Sort records: Matched first, then by date descending
        allReconciledRecords.sort((a, b) => {
            const dateA = a.invoice_datetime || (a.contest_scratch_time ? new Date(a.contest_scratch_time) : new Date(0));
            const dateB = b.invoice_datetime || (b.contest_scratch_time ? new Date(b.contest_scratch_time) : new Date(0));
            return dateB - dateA;
        });

        // Statistics
        const totalInvoices = erpInvoicesMap.size;
        const totalWinnings = contestWinnings.length;
        const fullyMatchedCount = matchedRows.filter(r => r.match_status === 'MATCHED').length;
        const partiallyMatchedCount = matchedRows.filter(r => r.match_status === 'PARTIALLY_MATCHED').length;
        const invoiceNotScratchedCount = unmatchedInvoices.length;
        const winningNoInvoiceCount = unmatchedContestWinnings.length;
        const totalAllReconciled = allReconciledRecords.length;
        const matchRate = totalInvoices > 0 ? (((fullyMatchedCount + partiallyMatchedCount) / totalInvoices) * 100).toFixed(1) : 0;
        const avgTimeDiffMins = matchedTimeDiffCount > 0 ? Math.round(totalTimeDiffMinutes / matchedTimeDiffCount) : 0;

        // Pagination
        const totalRecords = allReconciledRecords.length;
        let paginatedRecords = allReconciledRecords;

        if (exportAll !== 'true' && exportAll !== true) {
            const p = Math.max(1, parseInt(page));
            const l = parseInt(limit);
            const offset = (p - 1) * l;
            paginatedRecords = allReconciledRecords.slice(offset, offset + l);
        }

        const lastSync = await getLastSyncLog();

        return res.status(200).json({
            success: true,
            data: paginatedRecords,
            summary: {
                totalInvoices,
                totalWinnings,
                matchedCount: fullyMatchedCount,
                fullyMatchedCount,
                partiallyMatchedCount,
                invoiceNotScratchedCount,
                winningNoInvoiceCount,
                totalAllReconciled: (fullyMatchedCount + partiallyMatchedCount + invoiceNotScratchedCount + winningNoInvoiceCount),
                matchRatePercent: Number(matchRate),
                avgTimeDiffMinutes: avgTimeDiffMins,
                avgTimeDiffHuman: formatTimeDiff(avgTimeDiffMins)
            },
            pagination: {
                total: totalRecords,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: exportAll === 'true' || exportAll === true ? 1 : Math.ceil(totalRecords / parseInt(limit))
            },
            filters: {
                startDate: effectiveStartDate,
                endDate: effectiveEndDate,
                branchCode,
                statusFilter
            },
            lastSync
        });
    } catch (error) {
        console.error('Error generating scratch win reconciliation report:', error);
        return res.status(500).json({
            success: false,
            message: `Error generating reconciliation report: ${error.message}`
        });
    }
};

module.exports = {
    syncContestWinningsController,
    getContestWinningsMasterController,
    getLastSyncDetailsController,
    getScratchWinReconciliationController
};

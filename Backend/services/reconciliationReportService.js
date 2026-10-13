const db = require('../config/db.js');
const {
    getContestWinningsForReconciliation,
    getContestInvoicesForReconciliation,
    getContestInvoicesCount,
    getLastSyncLog
} = require('../models/contestWinningModel.js');
const { fetchAndCacheErpInvoices, syncContestWinningsController } = require('../controllers/contestWinningController.js');

// Normalizers
const normalizeInvoiceNo = (val) => {
    if (!val) return '';
    return String(val).trim().toUpperCase().replace(/\s+/g, '');
};

const normalizePhone = (val) => {
    if (!val) return '';
    const digits = String(val).replace(/\D/g, '');
    return digits.length > 10 ? digits.slice(-10) : digits;
};

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
 * Returns previous calendar date formatted as YYYY-MM-DD in Indian Standard Time (IST)
 */
const getPreviousDateIST = () => {
    const now = new Date();
    // Convert to IST (UTC + 5:30)
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + (now.getTimezoneOffset() * 60 * 1000) + istOffsetMs);
    istDate.setDate(istDate.getDate() - 1);

    const y = istDate.getFullYear();
    const m = String(istDate.getMonth() + 1).padStart(2, '0');
    const d = String(istDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

/**
 * Sync ERP Invoices and Contest Winnings for the given date range
 */
const syncReconciliationDataForRange = async (startDate, endDate) => {
    console.log(`[ReconService] Syncing ERP Invoices for date range ${startDate} to ${endDate}...`);
    try {
        await fetchAndCacheErpInvoices(startDate, endDate);
    } catch (err) {
        console.warn(`[ReconService] Warning syncing ERP invoices:`, err.message);
    }

    // Run contest winnings sync
    console.log(`[ReconService] Syncing Contest Winnings...`);
    try {
        await new Promise((resolve) => {
            const fakeReq = { user: { id: 1 }, headers: { 'x-device-id': 'cPanel-ReconCron' } };
            const fakeRes = {
                status() { return this; },
                json() { resolve(); return this; }
            };
            syncContestWinningsController(fakeReq, fakeRes).catch(() => resolve());
        });
    } catch (err) {
        console.warn(`[ReconService] Warning syncing contest winnings:`, err.message);
    }
};

/**
 * Executes full reconciliation calculation for specified date range
 */
const getReconciliationRecords = async ({
    startDate,
    endDate,
    branchCodes = null,
    statusFilter = 'ALL',
    autoSync = true
}) => {
    if (!startDate) startDate = getPreviousDateIST();
    if (!endDate) endDate = startDate;

    if (autoSync) {
        const countInfo = await getContestInvoicesCount(startDate, endDate);
        if (Number(countInfo.cnt || 0) === 0) {
            await syncReconciliationDataForRange(startDate, endDate);
        }
    }

    // 1. Fetch cached invoices
    const cachedInvoices = await getContestInvoicesForReconciliation(startDate, endDate, branchCodes);
    console.log(`[ReconService] Loaded ${cachedInvoices.length} invoices from cache for ${startDate} to ${endDate}.`);

    // 2. Fetch contest winnings
    const contestWinnings = await getContestWinningsForReconciliation(startDate, endDate, branchCodes);
    console.log(`[ReconService] Fetched ${contestWinnings.length} contest winning records for ${startDate} to ${endDate}.`);

    // 3. Map ERP Invoices
    const erpInvoicesMap = new Map();
    const erpInvoicesByNormalizedNo = new Map();

    for (const inv of cachedInvoices) {
        const invNo = inv.invoice_number;
        if (!invNo) continue;

        const normInvNo = inv.normalized_invoice_no || normalizeInvoiceNo(invNo);
        let invoiceDateTime = inv.invoice_datetime ? new Date(inv.invoice_datetime) : null;

        const invoiceObj = {
            invoice_number: invNo,
            normalized_invoice_no: normInvNo,
            invoice_date: inv.invoice_date,
            invoice_time: inv.invoice_time || '',
            invoice_datetime: invoiceDateTime,
            branch_code: inv.branch_code || '',
            branch_name: inv.branch_name || '',
            customer_name: inv.customer_name || '',
            customer_phone: inv.customer_phone || '',
            normalized_phone: inv.normalized_phone || normalizePhone(inv.customer_phone),
            invoice_value: parseFloat(inv.invoice_value) || 0,
            salesperson_name: inv.salesperson_name || '',
            item_summary: inv.item_summary || '',
            item_count: inv.item_count || 0,
            total_qty: parseFloat(inv.total_qty) || 0
        };

        erpInvoicesMap.set(invNo, invoiceObj);
        erpInvoicesByNormalizedNo.set(normInvNo, invoiceObj);
    }

    // 4. Map Contest Winnings
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

    // 5. Full Outer Join
    const matchedRows = [];
    const unmatchedInvoices = [];
    const matchedContestIds = new Set();
    let totalTimeDiffMinutes = 0;
    let matchedTimeDiffCount = 0;

    // Pass 1: Compare ERP Invoices against Contest Winnings
    for (const [normInvNo, inv] of erpInvoicesByNormalizedNo.entries()) {
        let matchedWin = contestByNormInvNo.get(normInvNo);

        if (!matchedWin && inv.normalized_phone && contestByPhone.has(inv.normalized_phone)) {
            const candidates = contestByPhone.get(inv.normalized_phone);
            const unassigned = candidates.find(c => !matchedContestIds.has(c.id));
            if (unassigned) matchedWin = unassigned;
        }

        if (matchedWin) {
            matchedContestIds.add(matchedWin.id);

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

            const invNoMatched = Boolean(normInvNo && normalizeInvoiceNo(matchedWin.invoice_number) === normInvNo);
            const phoneMatched = Boolean(inv.normalized_phone && normalizePhone(matchedWin.customer_phone) === inv.normalized_phone);

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

    // Pass 2: Unmatched Contest Winnings
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

    let allReconciledRecords = [
        ...matchedRows,
        ...unmatchedInvoices,
        ...unmatchedContestWinnings
    ];

    if (statusFilter && statusFilter !== 'ALL') {
        allReconciledRecords = allReconciledRecords.filter(r => r.match_status === statusFilter);
    }

    // Sort: invoice_datetime or scratch_time descending
    allReconciledRecords.sort((a, b) => {
        const dateA = a.invoice_datetime || (a.contest_scratch_time ? new Date(a.contest_scratch_time) : new Date(0));
        const dateB = b.invoice_datetime || (b.contest_scratch_time ? new Date(b.contest_scratch_time) : new Date(0));
        return dateB - dateA;
    });

    // Summary KPIs
    const totalInvoices = erpInvoicesMap.size;
    const totalWinnings = contestWinnings.length;
    const fullyMatchedCount = matchedRows.filter(r => r.match_status === 'MATCHED').length;
    const partiallyMatchedCount = matchedRows.filter(r => r.match_status === 'PARTIALLY_MATCHED').length;
    const invoiceNotScratchedCount = unmatchedInvoices.length;
    const winningNoInvoiceCount = unmatchedContestWinnings.length;
    const matchRate = totalInvoices > 0 ? (((fullyMatchedCount + partiallyMatchedCount) / totalInvoices) * 100).toFixed(1) : 0;
    const avgTimeDiffMins = matchedTimeDiffCount > 0 ? Math.round(totalTimeDiffMinutes / matchedTimeDiffCount) : 0;

    // Total Prizes and breakdown
    const prizeCounts = {};
    let totalPrizes = 0;
    allReconciledRecords.forEach((r) => {
        if (r.contest_prize && String(r.contest_prize).trim() !== '' && r.contest_prize !== '—') {
            const p = String(r.contest_prize).trim();
            prizeCounts[p] = (prizeCounts[p] || 0) + 1;
            totalPrizes++;
        }
    });

    const prizeEntries = Object.entries(prizeCounts).sort((a, b) => b[1] - a[1]);
    const prizeBreakdownStr = prizeEntries.map(([name, count]) => `${name}: ${count}`).join(', ');

    return {
        records: allReconciledRecords,
        summary: {
            totalRecords: allReconciledRecords.length,
            totalInvoices,
            totalWinnings,
            matchedCount: fullyMatchedCount,
            fullyMatchedCount,
            partiallyMatchedCount,
            invoiceNotScratchedCount,
            winningNoInvoiceCount,
            matchRatePercent: Number(matchRate),
            avgTimeDiffMinutes: avgTimeDiffMins,
            avgTimeDiffHuman: formatTimeDiff(avgTimeDiffMins),
            totalPrizes,
            prizeCounts,
            prizeBreakdownStr
        },
        startDate,
        endDate
    };
};

module.exports = {
    getPreviousDateIST,
    syncReconciliationDataForRange,
    getReconciliationRecords
};

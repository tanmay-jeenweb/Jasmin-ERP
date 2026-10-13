/**
 * Jasmin ERP - Daily Scratch & Win vs Invoice Reconciliation Report Email Script
 * 
 * Scheduled to run every day at 12:05 AM via cPanel Cron Job:
 *   5 0 * * * cd /home/adminjasminmobil/public_html/backend && node scripts/cronDailyReconciliationEmail.js >> logs/cron_recon.log 2>&1
 * 
 * Can also be triggered manually for any specific past date:
 *   node scripts/cronDailyReconciliationEmail.js --date=2026-10-11
 *   node scripts/cronDailyReconciliationEmail.js --save-only
 */

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const db = require('../config/db.js');
const {
    getPreviousDateIST,
    getReconciliationRecords
} = require('../services/reconciliationReportService.js');
const {
    generateReconciliationPdfBuffer
} = require('../services/reconciliationPdfGenerator.js');
const {
    sendDailyReconciliationEmail
} = require('../services/mailerService.js');

// --- Lock file mechanism to prevent overlapping cron runs ---
const LOCK_FILE = path.join(__dirname, '.cronDailyReconEmail.lock');
const LOCK_MAX_AGE_MS = 6 * 60 * 1000; // 6 minutes stale lock threshold

function acquireLock() {
    try {
        if (fs.existsSync(LOCK_FILE)) {
            const lockContent = fs.readFileSync(LOCK_FILE, 'utf8').trim();
            const lockTime = parseInt(lockContent, 10);
            const lockAge = Date.now() - lockTime;
            if (lockAge < LOCK_MAX_AGE_MS) {
                console.log(`[${new Date().toISOString()}] Another reconciliation email task is already running (lock age: ${Math.round(lockAge / 1000)}s). Exiting.`);
                return false;
            }
        }
        fs.writeFileSync(LOCK_FILE, String(Date.now()));
        return true;
    } catch (err) {
        return true; // Proceed anyway if lock mechanism fails
    }
}

function releaseLock() {
    try {
        if (fs.existsSync(LOCK_FILE)) fs.unlinkSync(LOCK_FILE);
    } catch (e) {}
}

if (!acquireLock()) {
    process.exit(0);
}

// Safety timeout: force-kill process after 5 minutes if external API or SMTP hangs
const SAFETY_TIMEOUT_MS = 300000;
const safetyTimeout = setTimeout(() => {
    console.error(`[${new Date().toISOString()}] Fatal: Daily reconciliation email script exceeded ${SAFETY_TIMEOUT_MS / 1000}s safety timeout. Force terminating.`);
    releaseLock();
    try { db.end(); } catch (e) {}
    process.exit(1);
}, SAFETY_TIMEOUT_MS);
safetyTimeout.unref();

async function main() {
    const args = process.argv.slice(2);
    let targetDate = null;
    let recipientOverride = null;
    let saveOnly = false;
    let skipSync = false;

    args.forEach(arg => {
        if (arg.startsWith('--date=')) {
            targetDate = arg.split('=')[1].trim();
        } else if (arg.startsWith('--email=')) {
            recipientOverride = arg.split('=')[1].trim();
        } else if (arg === '--save-only') {
            saveOnly = true;
        } else if (arg === '--no-sync') {
            skipSync = true;
        }
    });

    if (!targetDate) {
        targetDate = getPreviousDateIST();
    }

    console.log(`========================================================================`);
    console.log(`[${new Date().toISOString()}] Starting Daily Reconciliation Report Process`);
    console.log(`Target Date (Previous Calendar Day): ${targetDate}`);
    console.log(`========================================================================`);

    try {
        // 1. Fetch & reconcile records for the target date
        console.log(`\n[Step 1/3] Generating reconciliation data for ${targetDate}...`);
        const reconData = await getReconciliationRecords({
            startDate: targetDate,
            endDate: targetDate,
            branchCodes: null, // Full access to all branches
            statusFilter: 'ALL',
            autoSync: !skipSync
        });

        const allRecords = reconData.records;
        const totalRecords = allRecords.length;
        console.log(`Found ${totalRecords} reconciled records for ${targetDate}.`);

        // Filter 4 additional specialized datasets
        const partialRecords = allRecords.filter(r => r.match_status === 'PARTIALLY_MATCHED');
        const nonInvoiceRecords = allRecords.filter(r => r.match_status === 'WINNING_NO_INVOICE');
        const beforeTimeRecords = allRecords.filter(r => r.time_diff_minutes !== null && r.time_diff_minutes < 0);
        const after45MinsRecords = allRecords.filter(r => r.time_diff_minutes !== null && r.time_diff_minutes > 45);

        console.log(`Categorization Breakdown:`);
        console.log(`- Main (All Records): ${totalRecords}`);
        console.log(`- Report 1 (Only Partial): ${partialRecords.length}`);
        console.log(`- Report 2 (Separate Non-Invoice): ${nonInvoiceRecords.length}`);
        console.log(`- Report 3 (All Before Time): ${beforeTimeRecords.length}`);
        console.log(`- Report 4 (After 45 Mins): ${after45MinsRecords.length}`);

        // Enrich summary with counts for email overview
        const enhancedSummary = {
            ...reconData.summary,
            beforeTimeCount: beforeTimeRecords.length,
            after45MinsCount: after45MinsRecords.length
        };

        // 2. Generate 5 separate landscape A4 PDF reports with jsPDF
        console.log(`\n[Step 2/3] Generating 5 separate landscape A4 PDF reports with branch-wise serial numbering...`);
        const reportsDir = path.join(__dirname, '../uploads/reports/reconciliation');
        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
        }

        const reportConfigs = [
            {
                key: 'MAIN',
                name: 'Daily Master Reconciliation (All Records)',
                filename: `Scratch_Win_Reconciliation_${targetDate}.pdf`,
                records: allRecords,
                reportTitle: 'Jasmin ERP - Scratch & Win vs Invoice Reconciliation (Daily Master Report)',
                reportSubtitle: 'All Reconciled Categories'
            },
            {
                key: 'PARTIAL',
                name: 'Only Partial Report',
                filename: `Scratch_Win_Reconciliation_Partial_${targetDate}.pdf`,
                records: partialRecords,
                reportTitle: 'Jasmin ERP - Scratch & Win Contest (Partially Matched Records Only)',
                reportSubtitle: 'Partially Matched Only (Phone / Invoice Discrepancy)'
            },
            {
                key: 'NON_INVOICE',
                name: 'Separate Non-Invoice Report',
                filename: `Scratch_Win_Reconciliation_Non_Invoice_${targetDate}.pdf`,
                records: nonInvoiceRecords,
                reportTitle: 'Jasmin ERP - Scratch & Win Contest (Winnings Without Invoice / Non-Invoice)',
                reportSubtitle: 'Winning Without Invoice Only (Non-Invoice Claims)'
            },
            {
                key: 'BEFORE_TIME',
                name: 'All Before Time Report',
                filename: `Scratch_Win_Reconciliation_Before_Time_${targetDate}.pdf`,
                records: beforeTimeRecords,
                reportTitle: 'Jasmin ERP - Scratch & Win Contest (Scratched Before Bill / Pre-scratch)',
                reportSubtitle: 'Audit: Scratched Before Invoice Generation (Pre-scratch)'
            },
            {
                key: 'AFTER_45_MINS',
                name: 'After 45 Mins Report',
                filename: `Scratch_Win_Reconciliation_After_45_Mins_${targetDate}.pdf`,
                records: after45MinsRecords,
                reportTitle: 'Jasmin ERP - Scratch & Win Contest (Scratched After 45 Minutes of Bill)',
                reportSubtitle: 'Audit: Scratched More Than 45 Mins After Invoice Generation'
            }
        ];

        const attachments = [];

        for (const config of reportConfigs) {
            console.log(`  -> Generating PDF: ${config.name} (${config.records.length} records)...`);
            const buffer = generateReconciliationPdfBuffer({
                records: config.records,
                startDate: targetDate,
                endDate: targetDate,
                activeTab: config.key,
                reportTitle: config.reportTitle,
                reportSubtitle: config.reportSubtitle,
                generatedByName: 'System Scheduler (12:05 AM Auto Report)'
            });

            // Save local archive copy
            try {
                const archivePath = path.join(reportsDir, config.filename);
                fs.writeFileSync(archivePath, buffer);
                console.log(`     Archived locally at: ${archivePath} [${(buffer.length / 1024).toFixed(2)} KB]`);
            } catch (archiveErr) {
                console.warn(`     Could not save archive copy for ${config.filename}:`, archiveErr.message);
            }

            attachments.push({
                filename: config.filename,
                content: buffer,
                contentType: 'application/pdf'
            });
        }

        // 3. Send email with all 5 PDF attachments
        if (saveOnly) {
            console.log(`\n[Step 3/3] --save-only flag specified. Skipping email dispatch.`);
        } else {
            console.log(`\n[Step 3/3] Sending email with all ${attachments.length} PDF attachments...`);
            await sendDailyReconciliationEmail({
                targetDate,
                attachments,
                summary: enhancedSummary,
                recipients: recipientOverride
            });
            console.log(`Email dispatched successfully with 5 report attachments!`);
        }

        console.log(`\n========================================================================`);
        console.log(`[${new Date().toISOString()}] Process finished successfully.`);
        console.log(`========================================================================`);
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Error running daily reconciliation report:`, err);
    } finally {
        releaseLock();
        try { await db.end(); } catch (e) {}
        process.exit(0);
    }
}

main();

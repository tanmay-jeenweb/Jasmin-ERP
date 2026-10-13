const { jsPDF } = require('jspdf');
const autoTable = require('jspdf-autotable').default || require('jspdf-autotable');

// Helper to format date and time in IST
const formatDateTime = (val) => {
    if (!val) return '—';
    try {
        const d = new Date(val);
        if (isNaN(d.getTime())) return String(val);
        return d.toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
    } catch {
        return String(val);
    }
};

/**
 * Generate Scratch & Win vs Invoice Reconciliation PDF Buffer
 * Exactly matching the layout, colors, table columns and styles of the frontend PDF export.
 */
function generateReconciliationPdfBuffer({
    records = [],
    startDate,
    endDate,
    activeTab = 'ALL',
    reportTitle,
    reportSubtitle,
    generatedByName = 'Automated System (cPanel Cron)'
}) {
    const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
    });

    const exportRows = records;

    // 1. Top Header Banner
    doc.setFillColor(15, 23, 42); // Slate 900
    doc.rect(0, 0, 297, 16, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(reportTitle || 'Jasmin ERP - Scratch & Win Contest vs Invoice Reconciliation', 10, 10.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(226, 232, 240);
    const generatedAtStr = new Date().toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
    const userNameStr = generatedByName ? `User: ${generatedByName} | ` : '';
    doc.text(`${userNameStr}Generated: ${generatedAtStr}`, 287, 10.5, { align: 'right' });

    // 2. Compute duration totals from exportRows
    const totalDurationRecords = exportRows.length;
    const durationMatched = exportRows.filter((r) => r.match_status === 'MATCHED').length;
    const durationPartial = exportRows.filter((r) => r.match_status === 'PARTIALLY_MATCHED').length;
    const durationNoScratch = exportRows.filter((r) => r.match_status === 'INVOICE_NOT_SCRATCHED').length;
    const durationWithoutInv = exportRows.filter((r) => r.match_status === 'WINNING_NO_INVOICE').length;
    const durationTotalPrizes = exportRows.filter((r) => Boolean(r.contest_prize && String(r.contest_prize).trim() !== '' && r.contest_prize !== '—')).length;

    // Prize counts breakdown for duration
    const durationPrizeCounts = {};
    exportRows.forEach((r) => {
        if (r.contest_prize && String(r.contest_prize).trim() !== '' && r.contest_prize !== '—') {
            const p = String(r.contest_prize).trim();
            durationPrizeCounts[p] = (durationPrizeCounts[p] || 0) + 1;
        }
    });
    const durationPrizeEntries = Object.entries(durationPrizeCounts).sort((a, b) => b[1] - a[1]);
    const durationPrizeBreakdownStr = durationPrizeEntries.map(([name, count]) => `${name}: ${count}`).join(', ');

    // 3. Secondary Info Bar: Line 1 (Filters & Records Counts)
    doc.setTextColor(51, 65, 85);
    doc.setFontSize(7.2);
    doc.setFont('helvetica', 'bold');
    const tabLabel = reportSubtitle || (activeTab === 'ALL' ? 'All Categories' : (exportRows[0]?.match_status_label || activeTab));
    doc.text(`Date Range: ${startDate} to ${endDate}   |   Status: ${tabLabel}   |  Branches: All Branches`, 10, 19.8);

    // Total Records breakdown on right
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    const kpiStr = `Total: ${totalDurationRecords} Records (Matched: ${durationMatched}, Partial: ${durationPartial}, No Scratch: ${durationNoScratch}, Without Invoice: ${durationWithoutInv})`;
    doc.text(kpiStr, 287, 19.8, { align: 'right' });

    // Secondary Info Bar: Line 2 - Dedicated separate line for prizes
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(180, 83, 9);
    const durationPrizeLineText = durationTotalPrizes > 0
        ? `Total Prizes for Duration: ${durationTotalPrizes.toLocaleString('en-IN')}   |   Prizes Won: ${durationPrizeBreakdownStr}`
        : `Total Prizes for Duration: 0 (No prizes won during this duration)`;
    const prizeLines = doc.splitTextToSize(durationPrizeLineText, 277);
    doc.text(prizeLines, 10, 24.5);
    const tableStartY = Math.max(28, 24.5 + (prizeLines.length * 3.8));

    // 4. Headers & Body
    const headers = [[
        'Sr',
        'Status',
        'Branch',
        'Invoice No',
        'Invoice Date/Time',
        'ERP Customer',
        'Inv Value (Rs.)',
        'Win ID',
        'Contest Customer',
        'Prize Won',
        'Scratch Time',
        'Time Diff'
    ]];

    // Group records by Branch Name (for ascending branch ordering and branch-wise separation)
    const branchMap = new Map();

    exportRows.forEach((row) => {
        const bName = String(row.invoice_branch_name || row.contest_branch_name || '').trim();
        const bCode = String(row.invoice_branch_code || row.contest_branch_code || '').trim();
        const displayName = bName || (bCode ? `Branch ${bCode}` : 'Unassigned Branch');
        const displayCode = bCode || '—';
        const groupKey = displayName.toUpperCase();

        if (!branchMap.has(groupKey)) {
            branchMap.set(groupKey, {
                branchName: displayName,
                branchCode: displayCode,
                sortKey: groupKey,
                rows: []
            });
        }
        branchMap.get(groupKey).rows.push(row);
    });

    // Sort branches in strictly ascending alphabetical order by branch name (A to Z)
    const sortedBranches = Array.from(branchMap.values()).sort((a, b) =>
        a.sortKey.localeCompare(b.sortKey, undefined, { numeric: true, sensitivity: 'base' })
    );

    const body = [];

    if (exportRows.length === 0) {
        const emptyRow = [
            {
                content: `No records found matching this criterion for the date range ${startDate} to ${endDate}.`,
                colSpan: 12,
                styles: {
                    fillColor: [248, 250, 252],
                    textColor: [100, 116, 139],
                    fontStyle: 'italic',
                    fontSize: 7.5,
                    halign: 'center',
                    cellPadding: 6
                }
            }
        ];
        emptyRow._isSpecialRow = true;
        body.push(emptyRow);
    }

    sortedBranches.forEach((branchGroup, branchIdx) => {
        let branchSrNo = 1;

        // Sort rows within the branch by datetime
        branchGroup.rows.sort((a, b) => {
            const tA = new Date(a.invoice_datetime || a.contest_scratch_time || a.invoice_date || 0).getTime();
            const tB = new Date(b.invoice_datetime || b.contest_scratch_time || b.invoice_date || 0).getTime();
            return tA - tB;
        });

        // Calculate branch totals
        const branchTotalVal = branchGroup.rows.reduce((sum, r) => {
            const v = Number(r.invoice_value);
            return !isNaN(v) ? sum + v : sum;
        }, 0);
        const branchMatched = branchGroup.rows.filter((r) => r.match_status === 'MATCHED').length;
        const branchPartial = branchGroup.rows.filter((r) => r.match_status === 'PARTIALLY_MATCHED').length;
        const branchNoScratch = branchGroup.rows.filter((r) => r.match_status === 'INVOICE_NOT_SCRATCHED').length;
        const branchWithoutInv = branchGroup.rows.filter((r) => r.match_status === 'WINNING_NO_INVOICE').length;
        const branchTotalPrizes = branchGroup.rows.filter((r) => Boolean(r.contest_prize && String(r.contest_prize).trim() !== '' && r.contest_prize !== '—')).length;

        // Group prize counts for this branch
        const branchPrizeCounts = {};
        branchGroup.rows.forEach((r) => {
            if (r.contest_prize && String(r.contest_prize).trim() !== '' && r.contest_prize !== '—') {
                const p = String(r.contest_prize).trim();
                branchPrizeCounts[p] = (branchPrizeCounts[p] || 0) + 1;
            }
        });
        const branchPrizeEntries = Object.entries(branchPrizeCounts).sort((a, b) => b[1] - a[1]);
        const branchPrizeBreakdownStr = branchPrizeEntries.map(([name, count]) => `${name}: ${count}`).join(', ');

        // Branch Section Header Row
        const branchHeaderRow = [
            {
                content: `BRANCH: ${branchGroup.branchName.toUpperCase()} (${branchGroup.branchCode})  —  ${branchGroup.rows.length} ${branchGroup.rows.length === 1 ? 'Record' : 'Records'}`,
                colSpan: 12,
                styles: {
                    fillColor: [241, 245, 249], // Slate 100
                    textColor: [15, 23, 42],     // Slate 900
                    fontStyle: 'bold',
                    fontSize: 7.2,
                    halign: 'left',
                    cellPadding: 1.8
                }
            }
        ];
        branchHeaderRow._isSpecialRow = true;
        body.push(branchHeaderRow);

        // Branch Records
        branchGroup.rows.forEach((row) => {
            const bCode = row.invoice_branch_code || row.contest_branch_code || branchGroup.branchCode;
            const bName = row.invoice_branch_name || row.contest_branch_name || branchGroup.branchName;
            const branchCell = bName ? `${bCode}\n${bName}` : bCode;

            const erpCust = [row.invoice_customer_name, row.invoice_customer_phone].filter(Boolean).join('\n') || '—';
            const winCust = [row.contest_customer_name, row.contest_customer_phone].filter(Boolean).join('\n') || '—';

            const invDateTime = row.invoice_datetime ? formatDateTime(row.invoice_datetime) : (row.invoice_date || '—');
            const scratchDateTime = row.contest_scratch_time ? formatDateTime(row.contest_scratch_time) : '—';

            const numVal = Number(row.invoice_value);
            const invVal = row.invoice_value !== null && row.invoice_value !== undefined && !isNaN(numVal) && String(row.invoice_value).trim() !== ''
                ? numVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : '—';

            const winId = row.contest_external_id || (row.contest_id ? `#${row.contest_id}` : '—');

            const dataRow = [
                branchSrNo++,
                row.match_status_label || row.match_status || '—',
                branchCell,
                row.invoice_number || row.contest_invoice_number || '—',
                invDateTime,
                erpCust,
                invVal,
                winId,
                winCust,
                row.contest_prize || '—',
                scratchDateTime,
                row.time_diff_human || '—'
            ];
            dataRow._rawRecord = row;
            body.push(dataRow);
        });

        // Branch Separation Row
        const branchSeparationRow = [
            {
                content: `--- End of ${branchGroup.branchName} (${branchGroup.branchCode}) | Total: ${branchGroup.rows.length} Records (Matched: ${branchMatched}, Partial: ${branchPartial}, No Scratch: ${branchNoScratch}, Without Invoice: ${branchWithoutInv}) | Branch Inv Value: Rs. ${branchTotalVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ---`,
                colSpan: 12,
                styles: {
                    fillColor: [226, 232, 240], // Slate 200
                    textColor: [30, 41, 59],     // Slate 800
                    fontStyle: 'bold',
                    fontSize: 6.5,
                    halign: 'right',
                    cellPadding: 1.8
                }
            }
        ];
        branchSeparationRow._isSpecialRow = true;
        body.push(branchSeparationRow);

        // Branch Prizes Row
        const branchPrizesRow = [
            {
                content: `Branch Prizes: Total Prizes: ${branchTotalPrizes}${branchPrizeBreakdownStr ? ` | Prizes Won: ${branchPrizeBreakdownStr}` : ' (No Prizes Won)'}`,
                colSpan: 12,
                styles: {
                    fillColor: branchTotalPrizes > 0 ? [254, 243, 199] : [241, 245, 249], // Amber 100 if prizes won, else Slate 100
                    textColor: branchTotalPrizes > 0 ? [146, 64, 14] : [71, 85, 105],     // Amber 800 or Slate 600
                    fontStyle: 'bold',
                    fontSize: 6.5,
                    halign: 'right',
                    cellPadding: 1.8
                }
            }
        ];
        branchPrizesRow._isSpecialRow = true;
        body.push(branchPrizesRow);

        // Divider spacing row between branches
        if (branchIdx < sortedBranches.length - 1) {
            const spacerRow = [
                {
                    content: '',
                    colSpan: 12,
                    styles: {
                        fillColor: [255, 255, 255],
                        cellPadding: 0.6,
                        minCellHeight: 2
                    }
                }
            ];
            spacerRow._isSpecialRow = true;
            body.push(spacerRow);
        }
    });

    // Grand Total rows when multiple branches exist
    if (sortedBranches.length > 1) {
        const overallTotalInvVal = exportRows.reduce((sum, r) => {
            const v = Number(r.invoice_value);
            return !isNaN(v) ? sum + v : sum;
        }, 0);
        const grandTotalRow = [
            {
                content: `=== REPORT GRAND TOTAL (${sortedBranches.length} Branches) | Total: ${totalDurationRecords} Records (Matched: ${durationMatched}, Partial: ${durationPartial}, No Scratch: ${durationNoScratch}, Without Invoice: ${durationWithoutInv}) | Overall Inv Value: Rs. ${overallTotalInvVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ===`,
                colSpan: 12,
                styles: {
                    fillColor: [203, 213, 225], // Slate 300
                    textColor: [15, 23, 42],     // Slate 900
                    fontStyle: 'bold',
                    fontSize: 6.8,
                    halign: 'right',
                    cellPadding: 2.2
                }
            }
        ];
        grandTotalRow._isSpecialRow = true;
        body.push(grandTotalRow);

        const grandTotalPrizesRow = [
            {
                content: `=== GRAND TOTAL PRIZES: ${durationTotalPrizes} | Prizes Won: ${durationPrizeBreakdownStr || 'No Prizes Won'} ===`,
                colSpan: 12,
                styles: {
                    fillColor: durationTotalPrizes > 0 ? [253, 230, 138] : [226, 232, 240], // Amber 200 or Slate 200
                    textColor: [120, 53, 15], // Amber 900
                    fontStyle: 'bold',
                    fontSize: 6.8,
                    halign: 'right',
                    cellPadding: 2.2
                }
            }
        ];
        grandTotalPrizesRow._isSpecialRow = true;
        body.push(grandTotalPrizesRow);
    }

    // 5. Render AutoTable
    autoTable(doc, {
        head: headers,
        body: body,
        startY: tableStartY,
        theme: 'grid',
        headStyles: {
            fillColor: [30, 41, 59], // Slate 800
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 7,
            halign: 'center',
            valign: 'middle',
            cellPadding: 1.5
        },
        bodyStyles: {
            fontSize: 6.2,
            textColor: [30, 41, 59],
            cellPadding: 1.5,
            valign: 'middle'
        },
        alternateRowStyles: {
            fillColor: [248, 250, 252]
        },
        columnStyles: {
            0: { halign: 'center', cellWidth: 7 },   // Sr
            1: { halign: 'center', cellWidth: 24 },  // Status
            2: { halign: 'left', cellWidth: 26 },    // Branch
            3: { halign: 'center', cellWidth: 23 },  // Invoice No
            4: { halign: 'center', cellWidth: 26 },  // Invoice Date/Time
            5: { halign: 'left', cellWidth: 28 },    // ERP Customer
            6: { halign: 'right', cellWidth: 24, fontStyle: 'bold' }, // Inv Value (Rs.)
            7: { halign: 'center', cellWidth: 15 },  // Win ID
            8: { halign: 'left', cellWidth: 28 },    // Contest Customer
            9: { halign: 'left', cellWidth: 28 },    // Prize Won
            10: { halign: 'center', cellWidth: 26 }, // Scratch Time
            11: { halign: 'center', cellWidth: 22 }  // Time Diff
        },
        didParseCell: (data) => {
            if (data.section === 'body') {
                if (data.cell.colSpan > 1 || (data.row.raw && data.row.raw._isSpecialRow)) {
                    return;
                }
                const rawRow = data.row.raw && data.row.raw._rawRecord;
                if (rawRow) {
                    if (rawRow.match_status === 'MATCHED') {
                        data.cell.styles.fillColor = [240, 253, 244]; // emerald-50
                    } else if (rawRow.match_status === 'PARTIALLY_MATCHED') {
                        data.cell.styles.fillColor = [240, 249, 255]; // sky-50
                    } else if (rawRow.match_status === 'INVOICE_NOT_SCRATCHED') {
                        data.cell.styles.fillColor = [255, 251, 235]; // amber-50
                    } else if (rawRow.match_status === 'WINNING_NO_INVOICE') {
                        data.cell.styles.fillColor = [254, 242, 242]; // red-50
                    }
                }
            }
        },
        margin: { left: 10, right: 10, bottom: 12 },
        didDrawPage: (data) => {
            const pageCount = doc.internal.getNumberOfPages();
            const currentPage = data.pageNumber;
            doc.setFontSize(6.8);
            doc.setTextColor(148, 163, 184);
            doc.text(
                `${reportTitle || 'Jasmin ERP - Scratch & Win Reconciliation Report'} | Automated Delivery`,
                10,
                204
            );
            doc.text(
                `Page ${currentPage} of ${pageCount}`,
                287,
                204,
                { align: 'right' }
            );
        }
    });

    return Buffer.from(doc.output('arraybuffer'));
}

module.exports = {
    generateReconciliationPdfBuffer
};

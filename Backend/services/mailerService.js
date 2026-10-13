const nodemailer = require('nodemailer');

/**
 * Creates and returns configured Nodemailer transport
 */
function createTransporter() {
    const host = process.env.SMTP_HOST || 'localhost';
    const port = parseInt(process.env.SMTP_PORT || '465', 10);
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;
    const user = process.env.SMTP_USER || '';
    const pass = process.env.SMTP_PASS || '';

    if (!user || !pass) {
        console.warn('[Mailer] Warning: SMTP_USER or SMTP_PASS is not configured in .env.');
    }

    const transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: user && pass ? { user, pass } : undefined,
        tls: {
            rejectUnauthorized: false // Prevents failure with shared cPanel SSL certificates
        },
        connectionTimeout: 30000,
        greetingTimeout: 30000
    });

    return transporter;
}

/**
 * Sends Daily Reconciliation Report Email with PDF attachments
 */
async function sendDailyReconciliationEmail({
    targetDate,
    pdfBuffer,
    attachments = null,
    summary = {},
    recipients = null
}) {
    const transporter = createTransporter();

    // Determine recipients
    const toEmails = (recipients || process.env.RECONCILIATION_REPORT_EMAILS || '')
        .split(',')
        .map(e => e.trim())
        .filter(Boolean);

    if (toEmails.length === 0) {
        throw new Error('No recipient email addresses found. Please configure RECONCILIATION_REPORT_EMAILS in .env');
    }

    const fromAddress = process.env.SMTP_FROM || `"Jasmin ERP Reports" <${process.env.SMTP_USER || 'reports@jasminmobile.com'}>`;
    
    // Build attachments array
    let mailAttachments = [];
    if (Array.isArray(attachments) && attachments.length > 0) {
        mailAttachments = attachments;
    } else if (pdfBuffer) {
        mailAttachments = [
            {
                filename: `Scratch_Win_Reconciliation_${targetDate}.pdf`,
                content: pdfBuffer,
                contentType: 'application/pdf'
            }
        ];
    }

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 20px; color: #1e293b; }
        .card { max-width: 680px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; }
        .header { background: #0f172a; padding: 24px; color: #ffffff; text-align: left; }
        .header h1 { margin: 0 0 6px 0; font-size: 18px; font-weight: bold; letter-spacing: -0.02em; }
        .header p { margin: 0; font-size: 13px; color: #94a3b8; }
        .content { padding: 24px; }
        .kpi-grid { display: table; width: 100%; margin: 16px 0 20px 0; border-collapse: separate; border-spacing: 8px; }
        .kpi-row { display: table-row; }
        .kpi-box { display: table-cell; width: 33.3%; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; text-align: center; }
        .kpi-val { font-size: 18px; font-weight: bold; color: #0f172a; }
        .kpi-lbl { font-size: 11px; text-transform: uppercase; color: #64748b; margin-top: 4px; font-weight: 600; }
        .badge-green { color: #15803d; }
        .badge-sky { color: #0369a1; }
        .badge-amber { color: #b45309; }
        .badge-red { color: #b91c1c; }
        .prize-box { background: #fef3c7; border: 1px solid #fde68a; border-radius: 6px; padding: 14px; margin: 16px 0; color: #92400e; font-size: 13px; }
        .reports-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px; margin: 18px 0; }
        .footer { padding: 16px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <h1>Jasmin ERP — Scratch & Win Reconciliation Reports</h1>
          <p>Daily Automated Summary for Previous Date: <strong>${targetDate}</strong></p>
        </div>
        <div class="content">
          <p style="font-size: 14px; line-height: 1.5; margin-top: 0;">
            Hello,<br/><br/>
            Attached are the daily <strong>Scratch & Win Contest vs Invoice Reconciliation Reports</strong> for <strong>${targetDate}</strong> generated automatically by the system.
          </p>

          <table class="kpi-grid">
            <tr class="kpi-row">
              <td class="kpi-box">
                <div class="kpi-val">${summary.totalRecords || 0}</div>
                <div class="kpi-lbl">Total Records</div>
              </td>
              <td class="kpi-box">
                <div class="kpi-val badge-green">${summary.fullyMatchedCount || 0}</div>
                <div class="kpi-lbl">Fully Matched</div>
              </td>
              <td class="kpi-box">
                <div class="kpi-val badge-sky">${summary.partiallyMatchedCount || 0}</div>
                <div class="kpi-lbl">Partially Matched</div>
              </td>
            </tr>
            <tr class="kpi-row">
              <td class="kpi-box">
                <div class="kpi-val badge-amber">${summary.invoiceNotScratchedCount || 0}</div>
                <div class="kpi-lbl">Invoices Not Scratched</div>
              </td>
              <td class="kpi-box">
                <div class="kpi-val badge-red">${summary.winningNoInvoiceCount || 0}</div>
                <div class="kpi-lbl">Winning Without Invoice</div>
              </td>
              <td class="kpi-box">
                <div class="kpi-val">${summary.totalPrizes || 0}</div>
                <div class="kpi-lbl">Total Prizes Won</div>
              </td>
            </tr>
            <tr class="kpi-row">
              <td class="kpi-box" style="background:#fef2f2; border-color:#fecaca;">
                <div class="kpi-val" style="color:#b91c1c;">${summary.beforeTimeCount || 0}</div>
                <div class="kpi-lbl" style="color:#991b1b;">Scratched Before Bill</div>
              </td>
              <td class="kpi-box" style="background:#fffbeb; border-color:#fde68a;">
                <div class="kpi-val" style="color:#b45309;">${summary.after45MinsCount || 0}</div>
                <div class="kpi-lbl" style="color:#92400e;">Scratched After 45 Mins</div>
              </td>
              <td class="kpi-box">
                <div class="kpi-val" style="color:#0f172a;">${summary.matchRatePercent !== undefined ? summary.matchRatePercent : 0}%</div>
                <div class="kpi-lbl">Match Rate</div>
              </td>
            </tr>
          </table>

          ${summary.totalPrizes > 0 ? `
          <div class="prize-box">
            <strong>🎁 Prizes Won on ${targetDate}:</strong><br/>
            ${summary.prizeBreakdownStr || 'Prizes claimed.'}
          </div>
          ` : `
          <div class="prize-box" style="background:#f1f5f9; border-color:#cbd5e1; color:#475569;">
            No prizes won on ${targetDate}.
          </div>
          `}

          <div class="reports-box">
            <strong style="color:#0f172a; font-size:13px;">📎 Attached Reports (${mailAttachments.length} PDF Files):</strong>
            <ul style="margin: 8px 0 0 0; padding-left: 20px; font-size: 12.5px; color: #334155; line-height: 1.7;">
              <li><strong>1. Main Complete Report:</strong> All reconciled records organized branch-by-branch</li>
              <li><strong>2. Only Partial Report:</strong> Records with customer phone or invoice number discrepancies (${summary.partiallyMatchedCount || 0} records)</li>
              <li><strong>3. Non-Invoice Report:</strong> Contest winnings with no matching ERP invoice (${summary.winningNoInvoiceCount || 0} records)</li>
              <li><strong>4. All Before Time Report:</strong> Scratches made before bill generation (${summary.beforeTimeCount || 0} records)</li>
              <li><strong>5. After 45 Mins Report:</strong> Scratches made more than 45 minutes after bill generation (${summary.after45MinsCount || 0} records)</li>
            </ul>
            <p style="margin: 8px 0 0 0; font-size: 11.5px; color: #64748b; font-style: italic;">
              * Note: In all attached PDF reports, serial numbers are branch-wise (starting from 1 for each branch) and branches are sorted alphabetically from A to Z.
            </p>
          </div>
        </div>
        <div class="footer">
          This is an automated report dispatched by Jasmin ERP cPanel Scheduler at 12:05 AM. Please do not reply directly to this email.
        </div>
      </div>
    </body>
    </html>
    `;

    console.log(`[Mailer] Sending reports (${mailAttachments.length} attachments) for ${targetDate} to: ${toEmails.join(', ')}...`);

    const mailOptions = {
        from: fromAddress,
        to: toEmails.join(', '),
        subject: `Jasmin ERP — Scratch & Win vs Invoice Reconciliation Reports (${targetDate})`,
        html: htmlContent,
        attachments: mailAttachments
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[Mailer] Email sent successfully! MessageId: ${info.messageId}`);
    return info;
}

module.exports = {
    createTransporter,
    sendDailyReconciliationEmail
};

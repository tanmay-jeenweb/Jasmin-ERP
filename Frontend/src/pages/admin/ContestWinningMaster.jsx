import { useEffect, useState, useMemo } from "react";
import Navbar from "../../components/Navbar";
import DataTable from "../../components/DataTable";
import {
  getContestWinningsMaster,
  syncContestWinnings,
  getLastSyncDetails
} from "../../api/contestWinningApi";
import { getBranches } from "../../api/branchApi";
import toast from "react-hot-toast";
import { usePermission } from "../../context/PermissionContext";
import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Format date time helper (IST)
const formatDateTime = (val) => {
  if (!val) return "—";
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    });
  } catch {
    return String(val);
  }
};

export default function ContestWinningMaster() {
  const { hasPermission, isAdmin } = usePermission();
  const canWrite = hasPermission("contest_winnings_master", "write") || hasPermission("scratch_win_reconciliation", "write");

  const [winnings, setWinnings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [serverAllowedBranchCodes, setServerAllowedBranchCodes] = useState(null);
  const [lastSync, setLastSync] = useState(null);

  // Filters
  const [selectedBranch, setSelectedBranch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [branches, setBranches] = useState([]);

  // Load branches
  useEffect(() => {
    getBranches()
      .then((res) => {
        const data = res.data?.data || res.data || [];
        setBranches(Array.isArray(data) ? data : []);
      })
      .catch((err) => console.error("Failed to load branches", err));
  }, []);

  // Fetch Winning Records
  const fetchWinnings = async () => {
    setLoading(true);
    try {
      const params = {
        exportAll: true,
        branch_code: selectedBranch,
        from_date: fromDate,
        to_date: toDate
      };
      const res = await getContestWinningsMaster(params);
      if (res.data?.success) {
        const rawList = res.data.data || [];
        const indexed = rawList.map((item, idx) => ({
          ...item,
          _sr: idx + 1
        }));
        setWinnings(indexed);
        if (res.data.lastSync) setLastSync(res.data.lastSync);
        if (res.data.allowedBranchCodes !== undefined) {
          setServerAllowedBranchCodes(res.data.allowedBranchCodes);
        }
      }
    } catch (err) {
      console.error("Failed to fetch contest winnings", err);
      toast.error(err.response?.data?.message || "Failed to load contest winnings.");
    } finally {
      setLoading(false);
    }
  };

  const localUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  }, []);

  const isUserAdmin = Boolean(
    isAdmin ||
    (localUser.role && (localUser.role.toLowerCase() === "admin" || localUser.role.toLowerCase() === "super admin")) ||
    (localUser.user_role && localUser.user_role.toLowerCase() === "admin")
  );

  const authorizedBranchCodes = useMemo(() => {
    if (isUserAdmin) return null;
    const codes = new Set();
    if (Array.isArray(serverAllowedBranchCodes)) {
      serverAllowedBranchCodes.forEach((c) => codes.add(String(c).trim().toUpperCase()));
    }
    if (Array.isArray(branches)) {
      branches.forEach((b) => {
        const c = String(b.code || b.branch_code || "").trim().toUpperCase();
        if (c) codes.add(c);
      });
    }
    return codes;
  }, [isUserAdmin, serverAllowedBranchCodes, branches]);

  useEffect(() => {
    fetchWinnings();
  }, [selectedBranch, fromDate, toDate]);

  // Sync Handler
  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    const toastId = toast.loading("Syncing contest winnings from external API...");
    try {
      const res = await syncContestWinnings();
      if (res.data?.success) {
        toast.success(res.data.message || "Synced successfully!", { id: toastId });
        if (res.data.lastSync) setLastSync(res.data.lastSync);
        await fetchWinnings();
      } else {
        toast.error(res.data?.message || "Sync failed", { id: toastId });
      }
    } catch (err) {
      console.error("Sync error:", err);
      toast.error(err.response?.data?.message || "Failed to sync contest winnings", { id: toastId });
    } finally {
      setSyncing(false);
    }
  };

  // Reset Filters
  const handleResetFilters = () => {
    setSelectedBranch("");
    setFromDate("");
    setToDate("");
  };

  // Export to Excel
  const handleExportExcel = async () => {
    if (winnings.length === 0) {
      toast.error("No data available to export");
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Winning Master");

      // Title & Header styling
      worksheet.mergeCells("A1:K1");
      const titleCell = worksheet.getCell("A1");
      titleCell.value = "Scratch & Win Winning Master";
      titleCell.font = { name: "Calibri", size: 16, bold: true, color: { argb: "FFFFFFFF" } };
      titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A8A" } };
      titleCell.alignment = { vertical: "middle", horizontal: "center" };
      worksheet.getRow(1).height = 30;

      // Subtitle
      worksheet.mergeCells("A2:K2");
      const subCell = worksheet.getCell("A2");
      subCell.value = `Exported on: ${new Date().toLocaleString("en-IN")} | Total Records: ${winnings.length}`;
      subCell.font = { name: "Calibri", size: 10, italic: true, color: { argb: "FF334155" } };
      subCell.alignment = { vertical: "middle", horizontal: "left" };
      worksheet.getRow(2).height = 20;

      // Column Headers
      const headers = [
        "SR No.",
        "External ID",
        "Contest Campaign",
        "Invoice Number",
        "Customer Name",
        "Customer Phone",
        "Branch Code",
        "Branch Name",
        "Prize Won",
        "Claim Status",
        "Scratch Date & Time"
      ];

      const headerRow = worksheet.addRow(headers);
      headerRow.height = 24;
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.border = {
          top: { style: "thin", color: { argb: "FFCBD5E1" } },
          bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
          left: { style: "thin", color: { argb: "FFCBD5E1" } },
          right: { style: "thin", color: { argb: "FFCBD5E1" } }
        };
      });

      // Data Rows
      winnings.forEach((row, idx) => {
        const r = worksheet.addRow([
          idx + 1,
          row.external_id || row.id,
          row.form_name || "—",
          row.invoice_number || "—",
          row.customer_name || "—",
          row.customer_phone || "—",
          row.branch_code || "—",
          row.branch_name || "—",
          row.product_name || "—",
          (row.status || "claimed").toUpperCase(),
          formatDateTime(row.scratch_created_at)
        ]);

        r.height = 20;
        r.eachCell((cell) => {
          cell.alignment = { vertical: "middle" };
          cell.border = {
            top: { style: "thin", color: { argb: "FFE2E8F0" } },
            bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
            left: { style: "thin", color: { argb: "FFE2E8F0" } },
            right: { style: "thin", color: { argb: "FFE2E8F0" } }
          };
        });
      });

      // Set column widths
      worksheet.columns = [
        { width: 8 },
        { width: 14 },
        { width: 30 },
        { width: 18 },
        { width: 25 },
        { width: 16 },
        { width: 14 },
        { width: 28 },
        { width: 24 },
        { width: 15 },
        { width: 24 }
      ];

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `Winning_Master_${new Date().toISOString().slice(0, 10)}.xlsx`;
      anchor.click();
      window.URL.revokeObjectURL(url);
      toast.success("Excel exported successfully!");
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Failed to export Excel file");
    }
  };

  // Handle PDF Export (Strictly restricted to user's authorized branches)
  const handleDownloadPdf = async () => {
    if (winnings.length === 0) {
      toast.error("No data available to download");
      return;
    }

    setDownloadingPdf(true);
    const toastId = toast.loading("Generating PDF report...");

    try {
      let exportRows = winnings;

      if (!isUserAdmin) {
        if (!authorizedBranchCodes || authorizedBranchCodes.size === 0) {
          toast.error("You are not authorized to view any branches", { id: toastId });
          setDownloadingPdf(false);
          return;
        }

        exportRows = exportRows.filter((row) => {
          const bCode = String(row.branch_code || "").trim().toUpperCase();
          return bCode && authorizedBranchCodes.has(bCode);
        });
      }

      if (selectedBranch) {
        const selCode = String(selectedBranch).trim().toUpperCase();
        exportRows = exportRows.filter((row) => String(row.branch_code || "").trim().toUpperCase() === selCode);
      }

      if (exportRows.length === 0) {
        toast.error("No authorized records found for the selected criteria", { id: toastId });
        setDownloadingPdf(false);
        return;
      }

      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4"
      });

      doc.setFillColor(15, 23, 42); // Slate 900
      doc.rect(0, 0, 297, 16, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("Jasmin ERP - Winning Master (Scratch & Win)", 10, 10.5);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(226, 232, 240);
      const generatedAtStr = new Date().toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
      });
      const userNameStr = localUser.name ? `User: ${localUser.name} | ` : "";
      doc.text(`${userNameStr}Generated: ${generatedAtStr}`, 287, 10.5, { align: "right" });

      doc.setTextColor(51, 65, 85);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "bold");
      const dateRangeText = (fromDate || toDate) ? `Date: ${fromDate || "Start"} to ${toDate || "Present"}` : "Date: All Time";
      doc.text(dateRangeText, 10, 21);

      let branchText = "";
      if (isUserAdmin) {
        branchText = selectedBranch ? `|  Branch: ${selectedBranch}` : "|  Branches: All Branches (Admin)";
      } else {
        const authArr = Array.from(authorizedBranchCodes || []);
        branchText = selectedBranch ? `|  Branch (Filtered): ${selectedBranch}` : `|  Authorized Branches (${authArr.length}): ${authArr.join(", ")}`;
      }
      doc.setFont("helvetica", "normal");
      doc.text(branchText, 60, 21);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text(`Total Records: ${exportRows.length}`, 287, 21, { align: "right" });

      const headers = [[
        "Sr",
        "Win ID",
        "Prize Won",
        "Campaign",
        "Customer Name",
        "Customer Phone",
        "Branch Code",
        "Branch Name",
        "City",
        "Invoice No",
        "Status",
        "Scratch Time (IST)"
      ]];

      const body = exportRows.map((row, idx) => [
        idx + 1,
        row.external_id || (row.id ? `#${row.id}` : "—"),
        row.product_name || "Gift Prize",
        row.form_name || "Scratch & Win",
        row.customer_name || "—",
        row.customer_phone || "—",
        row.branch_code || "—",
        row.branch_name || "—",
        row.branch_city || "—",
        row.invoice_number || "—",
        (row.status || "claimed").toUpperCase(),
        formatDateTime(row.scratch_created_at)
      ]);

      autoTable(doc, {
        head: headers,
        body: body,
        startY: 25,
        theme: "grid",
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 7.2,
          halign: "center",
          valign: "middle",
          cellPadding: 1.5
        },
        bodyStyles: {
          fontSize: 6.5,
          textColor: [30, 41, 59],
          cellPadding: 1.5,
          valign: "middle"
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        columnStyles: {
          0: { halign: "center", cellWidth: 8 },
          1: { halign: "center", cellWidth: 16 },
          2: { halign: "left", cellWidth: 30 },
          3: { halign: "left", cellWidth: 26 },
          4: { halign: "left", cellWidth: 28 },
          5: { halign: "center", cellWidth: 24 },
          6: { halign: "center", cellWidth: 18 },
          7: { halign: "left", cellWidth: 28 },
          8: { halign: "left", cellWidth: 20 },
          9: { halign: "center", cellWidth: 22 },
          10: { halign: "center", cellWidth: 18 },
          11: { halign: "center", cellWidth: 28 }
        },
        margin: { left: 8, right: 8, bottom: 12 },
        didDrawPage: (data) => {
          const pageCount = doc.internal.getNumberOfPages();
          const currentPage = data.pageNumber;
          doc.setFontSize(6.8);
          doc.setTextColor(148, 163, 184);
          doc.text(
            `Jasmin ERP | Winning Master Report | Authorized Branch Access Only`,
            8,
            204
          );
          doc.text(
            `Page ${currentPage} of ${pageCount}`,
            289,
            204,
            { align: "right" }
          );
        }
      });

      doc.save(`Winning_Master_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("PDF report downloaded successfully!", { id: toastId });
    } catch (err) {
      console.error("PDF export error:", err);
      toast.error("Failed to generate PDF report", { id: toastId });
    } finally {
      setDownloadingPdf(false);
    }
  };

  // DataTable Columns Definition
  const columns = useMemo(
    () => [
      {
        key: "sr_no",
        label: "Sr No",
        header: "Sr No",
        minWidth: "70px",
        render: (row) => <span className="text-gray-500 font-semibold">{row._sr || "—"}</span>
      },
      {
        key: "external_id",
        label: "Win ID",
        header: "Win ID",
        minWidth: "100px",
        render: (row) => (
          <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-800">
            #{row.external_id || row.id}
          </span>
        )
      },
      {
        key: "invoice_number",
        label: "Invoice No",
        header: "Invoice No",
        minWidth: "140px",
        render: (row) => (
          row.invoice_number ? (
            <span className="font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-md text-xs font-mono">
              {row.invoice_number}
            </span>
          ) : (
            <span className="text-gray-400 italic">None</span>
          )
        )
      },
      {
        key: "customer_details",
        label: "Customer",
        header: "Customer",
        minWidth: "200px",
        render: (row) => (
          <div>
            <div className="font-semibold text-gray-900 text-sm">{row.customer_name || "—"}</div>
            {row.customer_phone && (
              <div className="text-xs text-gray-500 flex items-center gap-1 font-mono">
                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                {row.customer_phone}
              </div>
            )}
          </div>
        )
      },
      {
        key: "branch_info",
        label: "Branch",
        header: "Branch",
        minWidth: "180px",
        render: (row) => (
          <div>
            <div className="font-medium text-gray-800 text-xs">{row.branch_name || "—"}</div>
            {row.branch_code && (
              <span className="text-[11px] font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                {row.branch_code}
              </span>
            )}
            {row.branch_city && (
              <span className="text-[11px] text-gray-400 ml-1">({row.branch_city})</span>
            )}
          </div>
        )
      },
      {
        key: "product_name",
        label: "Prize Won",
        header: "Prize Won",
        minWidth: "180px",
        render: (row) => (
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600 border border-amber-200">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V6a2 2 0 10-2 2h2zm0 0H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V10a2 2 0 00-2-2h-8z" />
              </svg>
            </span>
            <div>
              <div className="font-semibold text-gray-900 text-xs">{row.product_name || "Gift Prize"}</div>
              <div className="text-[11px] text-gray-500">{row.form_name || "Scratch & Win"}</div>
            </div>
          </div>
        )
      },
      {
        key: "status",
        label: "Status",
        header: "Status",
        minWidth: "120px",
        render: (row) => {
          const st = (row.status || "claimed").toLowerCase();
          const isClaimed = st === "claimed";
          return (
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                isClaimed
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-amber-50 text-amber-700 border border-amber-200"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isClaimed ? "bg-emerald-500" : "bg-amber-500"}`} />
              {st.toUpperCase()}
            </span>
          );
        }
      },
      {
        key: "scratch_created_at",
        label: "Scratch Time (IST)",
        header: "Scratch Time (IST)",
        minWidth: "170px",
        render: (row) => (
          <div className="text-xs font-mono text-gray-700">
            {formatDateTime(row.scratch_created_at)}
          </div>
        )
      }
    ],
    []
  );

  const hasActiveFilters = Boolean(selectedBranch || fromDate || toDate);

  return (
    <div className="flex flex-col flex-1 bg-slate-50 font-sans min-h-screen">
      <Navbar title="ERP Admin" />

      <main className="flex-1 flex flex-col w-full mx-auto px-4 sm:px-[30px] py-6 sm:py-8">
        <DataTable
          tableId="contest_winnings_master"
          title="Winning Master"
          data={winnings}
          columns={columns}
          loading={loading}
          searchPlaceholder="Search Customer, Mobile, Invoice, Prize..."
          toggleActions={
            <div className="flex flex-wrap items-center gap-2">
              {/* Branch Filter */}
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="h-10 px-3 rounded-lg border border-slate-300 bg-slate-50 text-xs font-medium text-slate-700 outline-none focus:border-blue-600 cursor-pointer max-w-[190px]"
              >
                <option value="">All Branches</option>
                {branches.map((b) => {
                  const bCode = b.code || b.branch_code || String(b.id);
                  const bName = b.name || b.branch_name || bCode;
                  return (
                    <option key={b.id || bCode} value={bCode}>
                      {bName} ({bCode})
                    </option>
                  );
                })}
              </select>

              {/* From Date */}
              <div className="flex items-center gap-1.5 h-10 px-2.5 rounded-lg border border-slate-300 bg-slate-50 text-xs text-slate-600">
                <span className="text-[11px] font-semibold text-slate-400 uppercase">From:</span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="bg-transparent text-xs text-slate-700 outline-none cursor-pointer"
                />
              </div>

              {/* To Date */}
              <div className="flex items-center gap-1.5 h-10 px-2.5 rounded-lg border border-slate-300 bg-slate-50 text-xs text-slate-600">
                <span className="text-[11px] font-semibold text-slate-400 uppercase">To:</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="bg-transparent text-xs text-slate-700 outline-none cursor-pointer"
                />
              </div>

              {/* Clear filters button */}
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  title="Clear filters"
                  className="h-10 px-2.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:border-rose-300 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>Clear</span>
                </button>
              )}
            </div>
          }
          actionButton={
            <div className="flex items-center gap-2">
              {canWrite && (
                <button
                  type="button"
                  onClick={handleSync}
                  disabled={syncing}
                  title="Sync Winnings from external API"
                  className="flex h-10 items-center gap-1.5 px-3.5 rounded-lg text-white font-semibold text-xs bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-sm disabled:opacity-50 cursor-pointer transition-all whitespace-nowrap"
                >
                  <svg
                    className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>{syncing ? "Syncing..." : "Sync"}</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleExportExcel}
                title="Export to Excel"
                className="flex h-10 items-center gap-1.5 px-3.5 rounded-lg text-white font-semibold text-xs bg-emerald-600 hover:bg-emerald-700 shadow-sm cursor-pointer transition-all whitespace-nowrap"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Export</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={downloadingPdf || winnings.length === 0}
                title="Download PDF report (Authorized branches only)"
                className="flex h-10 items-center gap-1.5 px-3.5 rounded-lg text-white font-semibold text-xs bg-rose-600 hover:bg-rose-700 shadow-sm disabled:opacity-50 cursor-pointer transition-all whitespace-nowrap"
              >
                {downloadingPdf ? (
                  <>
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Generating PDF...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-6 4h4" />
                    </svg>
                    <span>Download PDF</span>
                  </>
                )}
              </button>
            </div>
          }
        />
      </main>
    </div>
  );
}

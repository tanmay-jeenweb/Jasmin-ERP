import { useEffect, useState, useMemo, useRef } from "react";
import Navbar from "../../components/Navbar";
import DataTable from "../../components/DataTable";
import {
  getScratchWinReconciliation,
  syncContestWinnings
} from "../../api/contestWinningApi";
import { getBranches } from "../../api/branchApi";
import toast from "react-hot-toast";
import { usePermission } from "../../context/PermissionContext";
import ExcelJS from "exceljs";

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

// Format currency helper
const formatCurrency = (val) => {
  if (val === null || val === undefined || isNaN(val)) return "—";
  return `₹${Number(val).toLocaleString("en-IN")}`;
};

export default function ScratchWinReconciliation() {
  const { hasPermission } = usePermission();
  const canWrite = hasPermission("contest_winnings_master", "write") || hasPermission("scratch_win_reconciliation", "write");

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [summary, setSummary] = useState({});
  const [lastSync, setLastSync] = useState(null);

  // Filters
  const [startDate, setStartDate] = useState("2026-10-05");
  const [endDate, setEndDate] = useState(new Date().toLocaleDateString("en-CA"));
  const [selectedBranches, setSelectedBranches] = useState([]); // array of branch codes
  const [activeTab, setActiveTab] = useState("ALL"); // 'ALL' | 'MATCHED' | 'PARTIALLY_MATCHED' | 'INVOICE_NOT_SCRATCHED' | 'WINNING_NO_INVOICE'
  const [branches, setBranches] = useState([]);

  // Multi-select branch dropdown state
  const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
  const [branchSearch, setBranchSearch] = useState("");
  const branchDropdownRef = useRef(null);

  // Load branches from Branch Master
  useEffect(() => {
    getBranches()
      .then((res) => {
        const data = res.data?.data || res.data || [];
        setBranches(Array.isArray(data) ? data : []);
      })
      .catch((err) => console.error("Failed to load branches", err));
  }, []);

  // Click outside to close branch dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (branchDropdownRef.current && !branchDropdownRef.current.contains(e.target)) {
        setIsBranchDropdownOpen(false);
      }
    };
    if (isBranchDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isBranchDropdownOpen]);

  // Fetch Reconciliation Data
  const fetchReconciliation = async () => {
    setLoading(true);
    try {
      const params = {
        exportAll: true,
        startDate: startDate || "2026-10-05",
        endDate: endDate || new Date().toLocaleDateString("en-CA"),
        branchCodes: selectedBranches.join(","),
        statusFilter: activeTab
      };
      const res = await getScratchWinReconciliation(params);
      if (res.data?.success) {
        const rawList = res.data.data || [];
        // Map clean sortable fields so DataTable sorting and searching works on every column
        const indexedList = rawList.map((item, idx) => ({
          ...item,
          _sr: idx + 1,
          sr_no: idx + 1,
          time_difference: item.time_diff_minutes !== null && item.time_diff_minutes !== undefined ? Number(item.time_diff_minutes) : null,
          invoice_details: item.invoice_value !== null && item.invoice_value !== undefined ? Number(item.invoice_value) : null,
          customer_comparison: String(item.invoice_customer_name || item.contest_customer_name || ""),
          branch_name: String(item.invoice_branch_name || item.contest_branch_name || ""),
          timestamps: item.invoice_datetime || item.contest_scratch_time || "",
          prize_details: String(item.contest_prize || "")
        }));
        setRecords(indexedList);
        setSummary(res.data.summary || {});
        if (res.data.lastSync) setLastSync(res.data.lastSync);
      }
    } catch (err) {
      console.error("Failed to load reconciliation data", err);
      toast.error(err.response?.data?.message || "Failed to load reconciliation report.");
    } finally {
      setLoading(false);
    }
  };

  // Immediate reactive refetch when date, branch or status tab changes
  useEffect(() => {
    fetchReconciliation();
  }, [startDate, endDate, selectedBranches, activeTab]);

  // Sync contest winnings
  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    const toastId = toast.loading("Syncing contest winnings from external API...");
    try {
      const res = await syncContestWinnings();
      if (res.data?.success) {
        toast.success(res.data.message || "Synced successfully!", { id: toastId });
        if (res.data.lastSync) setLastSync(res.data.lastSync);
        await fetchReconciliation();
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
    setStartDate("2026-10-05");
    setEndDate(new Date().toLocaleDateString("en-CA"));
    setSelectedBranches([]);
    setActiveTab("ALL");
  };

  // Branch multi-select toggle handlers
  const handleToggleBranch = (code) => {
    setSelectedBranches((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const handleSelectAllBranches = () => {
    const allCodes = branches.map((b) => b.code || b.branch_code).filter(Boolean);
    setSelectedBranches(allCodes);
  };

  const handleClearAllBranches = () => {
    setSelectedBranches([]);
  };

  const filteredBranchList = useMemo(() => {
    if (!branchSearch.trim()) return branches;
    const q = branchSearch.trim().toLowerCase();
    return branches.filter((b) => {
      const name = String(b.name || b.branch_name || "").toLowerCase();
      const code = String(b.code || b.branch_code || "").toLowerCase();
      const city = String(b.city || "").toLowerCase();
      return name.includes(q) || code.includes(q) || city.includes(q);
    });
  }, [branches, branchSearch]);

  // Export to Excel
  const handleExportExcel = async () => {
    if (records.length === 0) {
      toast.error("No data available to export");
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Scratch & Win Reconciliation");

      // Title
      worksheet.mergeCells("A1:P1");
      const titleCell = worksheet.getCell("A1");
      titleCell.value = "Scratch & Win Contest vs Invoice Reconciliation Report";
      titleCell.font = { name: "Calibri", size: 16, bold: true, color: { argb: "FFFFFFFF" } };
      titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
      titleCell.alignment = { vertical: "middle", horizontal: "center" };
      worksheet.getRow(1).height = 32;

      // Subtitle
      worksheet.mergeCells("A2:P2");
      const subCell = worksheet.getCell("A2");
      subCell.value = `Date Range: ${startDate} to ${endDate} | Total Invoices: ${summary.totalInvoices || 0} | Total Winnings: ${summary.totalWinnings || 0} | Fully Matched: ${summary.fullyMatchedCount || 0} | Partially Matched: ${summary.partiallyMatchedCount || 0} | Exported on: ${new Date().toLocaleString("en-IN")}`;
      subCell.font = { name: "Calibri", size: 10, italic: true, color: { argb: "FF334155" } };
      subCell.alignment = { vertical: "middle", horizontal: "left" };
      worksheet.getRow(2).height = 20;

      // Headers
      const headers = [
        "SR No.",
        "Status",
        "Time Difference",
        "Invoice Number",
        "Invoice Date & Time",
        "ERP Customer Name",
        "ERP Customer Mobile",
        "Branch Code",
        "Branch Name",
        "Invoice Value (₹)",
        "Contest Win ID",
        "Contest Customer Name",
        "Contest Customer Phone",
        "Prize Won",
        "Scratch Date & Time"
      ];

      const headerRow = worksheet.addRow(headers);
      headerRow.height = 26;
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.border = {
          top: { style: "thin", color: { argb: "FF94A3B8" } },
          bottom: { style: "thin", color: { argb: "FF94A3B8" } },
          left: { style: "thin", color: { argb: "FF94A3B8" } },
          right: { style: "thin", color: { argb: "FF94A3B8" } }
        };
      });

      // Data Rows
      records.forEach((row, idx) => {
        const r = worksheet.addRow([
          idx + 1,
          row.match_status_label,
          row.time_diff_human || "—",
          row.invoice_number || row.contest_invoice_number || "—",
          row.invoice_datetime ? formatDateTime(row.invoice_datetime) : (row.invoice_date || "—"),
          row.invoice_customer_name || "—",
          row.invoice_customer_phone || "—",
          row.invoice_branch_code || row.contest_branch_code || "—",
          row.invoice_branch_name || row.contest_branch_name || "—",
          row.invoice_value || 0,
          row.contest_external_id || (row.contest_id ? `#${row.contest_id}` : "—"),
          row.contest_customer_name || "—",
          row.contest_customer_phone || "—",
          row.contest_prize || "—",
          formatDateTime(row.contest_scratch_time)
        ]);

        r.height = 20;

        let bgColor = "FFFFFFFF";
        if (row.match_status === "MATCHED") bgColor = "FFF0FDF4"; // green
        else if (row.match_status === "PARTIALLY_MATCHED") bgColor = "FFF0F9FF"; // sky blue
        else if (row.match_status === "INVOICE_NOT_SCRATCHED") bgColor = "FFFFFBEB"; // amber
        else if (row.match_status === "WINNING_NO_INVOICE") bgColor = "FFFEF2F2"; // red

        r.eachCell((cell) => {
          cell.alignment = { vertical: "middle" };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgColor } };
          cell.border = {
            top: { style: "thin", color: { argb: "FFE2E8F0" } },
            bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
            left: { style: "thin", color: { argb: "FFE2E8F0" } },
            right: { style: "thin", color: { argb: "FFE2E8F0" } }
          };
        });
      });

      worksheet.columns = [
        { width: 8 },
        { width: 22 },
        { width: 24 },
        { width: 18 },
        { width: 22 },
        { width: 24 },
        { width: 16 },
        { width: 14 },
        { width: 24 },
        { width: 16 },
        { width: 14 },
        { width: 24 },
        { width: 16 },
        { width: 22 },
        { width: 22 }
      ];

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `Scratch_Win_Reconciliation_${startDate}_to_${endDate}.xlsx`;
      anchor.click();
      window.URL.revokeObjectURL(url);
      toast.success("Excel exported successfully!");
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Failed to export Excel file");
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
        key: "match_status",
        label: "Status",
        header: "Status",
        minWidth: "150px",
        render: (row) => {
          if (row.match_status === "MATCHED") {
            return (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Fully Matched
              </span>
            );
          }
          if (row.match_status === "PARTIALLY_MATCHED") {
            return (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200"
                title={row.match_status_label}
              >
                <span className="w-2 h-2 rounded-full bg-sky-500" />
                Partially Matched
              </span>
            );
          }
          if (row.match_status === "INVOICE_NOT_SCRATCHED") {
            return (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Not Scratched
              </span>
            );
          }
          return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              No Invoice Found
            </span>
          );
        }
      },
      {
        key: "time_difference",
        label: "Time Difference",
        header: "Time Difference",
        minWidth: "160px",
        render: (row) => {
          if (!row.is_fully_matched && !row.is_partially_matched) {
            return <span className="text-gray-400 italic text-xs">—</span>;
          }
          if (!row.time_diff_human || row.time_diff_human === "N/A") {
            return <span className="text-gray-400 italic text-xs">—</span>;
          }

          const isNegative = row.time_diff_minutes < 0;
          const isSuperFast = !isNegative && row.time_diff_minutes <= 15;

          return (
            <div className="flex flex-col gap-0.5">
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold font-mono ${
                  isNegative
                    ? "bg-amber-100 text-amber-800 border border-amber-300"
                    : isSuperFast
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                    : "bg-blue-50 text-blue-700 border border-blue-200"
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {row.time_diff_human}
              </span>
              {isNegative && (
                <span className="text-[10px] text-amber-600 font-medium">Scratched before billing</span>
              )}
            </div>
          );
        }
      },
      {
        key: "invoice_number",
        label: "Invoice Number",
        header: "Invoice Number",
        minWidth: "150px",
        render: (row) => {
          const inv = row.invoice_number || row.contest_invoice_number;
          if (!inv) return <span className="text-gray-400 italic text-xs">No Bill</span>;
          return (
            <div>
              <span className="font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded font-mono text-xs">
                {inv}
              </span>
              {row.invoice_number && row.contest_invoice_number && row.invoice_number !== row.contest_invoice_number && (
                <div className="text-[10px] text-amber-600 mt-1">
                  Contest: <span className="font-mono">{row.contest_invoice_number}</span>
                </div>
              )}
            </div>
          );
        }
      },
      {
        key: "customer_comparison",
        label: "Customer (ERP vs Contest)",
        header: "Customer (ERP vs Contest)",
        minWidth: "220px",
        render: (row) => {
          const erpName = row.invoice_customer_name;
          const erpPhone = row.invoice_customer_phone;
          const contestName = row.contest_customer_name;
          const contestPhone = row.contest_customer_phone;

          return (
            <div className="space-y-1 text-xs">
              {/* ERP Customer */}
              {erpName || erpPhone ? (
                <div>
                  <div className="font-semibold text-gray-900">{erpName || "—"}</div>
                  <div className="text-gray-500 font-mono text-[11px] flex items-center gap-1">
                    <span className="text-[10px] font-sans text-gray-400">ERP:</span> {erpPhone || "—"}
                  </div>
                </div>
              ) : (
                <div className="text-gray-400 italic">No ERP Customer</div>
              )}

              {/* Contest Customer */}
              {(contestName || contestPhone) && (
                <div className="pt-1 border-t border-gray-100 text-slate-700">
                  <div className="font-medium text-slate-800 text-[11px] flex items-center gap-1">
                    <span className="text-[10px] font-sans text-amber-600 font-bold">Contest:</span>
                    {contestName || "—"}
                  </div>
                  <div className="text-slate-500 font-mono text-[11px] flex items-center gap-1">
                    <span>{contestPhone || "—"}</span>
                    {row.phone_match === false && (
                      <span className="text-[10px] bg-amber-100 text-amber-800 px-1 py-0.2 rounded font-semibold">
                        Phone Differs
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        }
      },
      {
        key: "branch_name",
        label: "Branch",
        header: "Branch",
        minWidth: "160px",
        render: (row) => {
          const branchName = row.invoice_branch_name || row.contest_branch_name || "—";
          const branchCode = row.invoice_branch_code || row.contest_branch_code || "";
          return (
            <div className="text-xs">
              <div className="font-medium text-gray-800">{branchName}</div>
              {branchCode && (
                <span className="text-[11px] font-mono text-gray-500 bg-gray-100 px-1.5 py-0.2 rounded">
                  {branchCode}
                </span>
              )}
            </div>
          );
        }
      },
      {
        key: "timestamps",
        label: "Bill Time vs Scratch Time",
        header: "Bill Time vs Scratch Time",
        minWidth: "210px",
        render: (row) => (
          <div className="space-y-1 text-xs font-mono">
            {row.invoice_datetime || row.invoice_date ? (
              <div className="text-blue-900">
                <span className="text-[10px] font-sans font-bold text-blue-600 mr-1">BILL:</span>
                {row.invoice_datetime ? formatDateTime(row.invoice_datetime) : row.invoice_date}
              </div>
            ) : (
              <div className="text-gray-400 italic">No Bill Time</div>
            )}

            {row.contest_scratch_time ? (
              <div className="text-amber-900">
                <span className="text-[10px] font-sans font-bold text-amber-600 mr-1">WIN:</span>
                {formatDateTime(row.contest_scratch_time)}
              </div>
            ) : (
              <div className="text-gray-400 italic">Not Scratched</div>
            )}
          </div>
        )
      },
      {
        key: "invoice_details",
        label: "Invoice Amount",
        header: "Invoice Amount",
        minWidth: "120px",
        render: (row) => (
          <div className="text-xs font-semibold text-slate-900">
            {row.invoice_value !== null && row.invoice_value !== undefined ? (
              formatCurrency(row.invoice_value)
            ) : (
              <span className="text-gray-400 font-normal italic">—</span>
            )}
          </div>
        )
      },
      {
        key: "prize_details",
        label: "Contest Prize Won",
        header: "Contest Prize Won",
        minWidth: "180px",
        render: (row) => (
          <div>
            {row.contest_prize ? (
              <div className="flex items-center gap-2">
                <span className="p-1 rounded bg-amber-50 text-amber-600 border border-amber-200">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V6a2 2 0 10-2 2h2zm0 0H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V10a2 2 0 00-2-2h-8z" />
                  </svg>
                </span>
                <div>
                  <div className="font-semibold text-slate-900 text-xs">{row.contest_prize}</div>
                  <div className="text-[10px] text-gray-400">{row.contest_campaign || "Diwali Bumper Offer"}</div>
                </div>
              </div>
            ) : (
              <span className="text-gray-400 italic text-xs">No Scratch Record</span>
            )}
          </div>
        )
      }
    ],
    []
  );

  // Total records across all categories
  const totalAllRecordsCount = useMemo(() => {
    if (summary.totalAllReconciled !== undefined && summary.totalAllReconciled !== null) {
      return summary.totalAllReconciled;
    }
    return (
      (summary.fullyMatchedCount || summary.matchedCount || 0) +
      (summary.partiallyMatchedCount || 0) +
      (summary.invoiceNotScratchedCount || 0) +
      (summary.winningNoInvoiceCount || 0)
    );
  }, [summary]);

  // Top row filter controls: Compact Branch multi-select + From Date + To Date + Reset
  const tableToggleActions = useMemo(() => (
    <div className="flex flex-wrap items-center gap-2">
      {/* Compact Branch Multi-select Dropdown with Search */}
      <div className="relative" ref={branchDropdownRef}>
        <button
          type="button"
          onClick={() => setIsBranchDropdownOpen((v) => !v)}
          title="Filter by Branches"
          className="h-10 w-36 sm:w-40 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50 text-slate-700 outline-none focus:border-blue-600 cursor-pointer flex items-center justify-between gap-1 shadow-sm hover:bg-slate-100 transition"
        >
          <span className="truncate text-xs font-medium text-left">
            {selectedBranches.length === 0
              ? "All Branches"
              : selectedBranches.length === 1
              ? `${selectedBranches[0]}`
              : `${selectedBranches.length} Branches`}
          </span>
          <svg
            className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${isBranchDropdownOpen ? "rotate-180 text-blue-600" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Wider Floating Dropdown with Search & Checkboxes */}
        {isBranchDropdownOpen && (
          <div className="absolute left-0 sm:right-0 sm:left-auto top-11 z-50 w-72 rounded-xl border border-slate-200 bg-white shadow-2xl p-2.5 space-y-2">
            {/* Search within dropdown */}
            <div className="relative">
              <input
                type="text"
                value={branchSearch}
                onChange={(e) => setBranchSearch(e.target.value)}
                placeholder="Search branches..."
                className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-600 bg-slate-50"
                autoFocus
              />
              <svg className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center justify-between px-1 text-[11px] text-slate-500 border-b border-slate-100 pb-1.5">
              <span>{selectedBranches.length} selected</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllBranches}
                  className="text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                >
                  Select All
                </button>
                <span>|</span>
                <button
                  type="button"
                  onClick={handleClearAllBranches}
                  className="text-slate-500 hover:text-slate-700 font-semibold cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Scrollable list of branches */}
            <div className="max-h-60 overflow-y-auto space-y-0.5 pr-1">
              {filteredBranchList.length === 0 ? (
                <div className="p-3 text-center text-xs text-slate-400">No branches found</div>
              ) : (
                filteredBranchList.map((b) => {
                  const bCode = b.code || b.branch_code || String(b.id);
                  const bName = b.name || b.branch_name || bCode;
                  const isChecked = selectedBranches.includes(bCode);
                  return (
                    <label
                      key={b.id || bCode}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs cursor-pointer select-none transition ${
                        isChecked ? "bg-blue-50 text-blue-900 font-semibold" : "hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleBranch(bCode)}
                        className="accent-blue-600 h-3.5 w-3.5 rounded flex-shrink-0 cursor-pointer"
                      />
                      <span className="truncate flex-1">
                        {bName} <span className="text-[10px] text-slate-400 font-mono">({bCode})</span>
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* From Date */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-semibold text-slate-500 whitespace-nowrap hidden sm:inline">From:</span>
        <input
          type="date"
          min="2026-10-05"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="h-10 px-2.5 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50 text-slate-700 outline-none focus:border-blue-600"
          title="From Date (Min 05-10-2026)"
        />
      </div>

      {/* To Date */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-semibold text-slate-500 whitespace-nowrap hidden sm:inline">To:</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="h-10 px-2.5 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50 text-slate-700 outline-none focus:border-blue-600"
          title="To Date"
        />
      </div>

      {/* Quick Reset if filters active */}
      {(selectedBranches.length > 0 || startDate !== "2026-10-05" || endDate !== new Date().toLocaleDateString("en-CA")) && (
        <button
          type="button"
          onClick={handleResetFilters}
          title="Reset filters to default"
          className="h-10 px-3 border border-slate-300 hover:bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg transition cursor-pointer flex items-center gap-1"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Reset
        </button>
      )}
    </div>
  ), [selectedBranches, isBranchDropdownOpen, branchSearch, filteredBranchList, startDate, endDate]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-white px-5 py-3.5 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="p-2 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-xl shadow-md shadow-blue-500/20 shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </span>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight truncate">
              Scratch & Win vs Invoice Reconciliation Report
            </h1>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            {lastSync && (
              <div className="text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 whitespace-nowrap">
                Winnings Synced: <span className="font-semibold text-slate-700">{formatDateTime(lastSync.created_at)}</span>
              </div>
            )}

            {canWrite && (
              <button
                type="button"
                onClick={handleSync}
                disabled={syncing}
                title="Sync Winnings"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm transition cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                <svg className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>{syncing ? "Syncing..." : "Sync"}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-sm transition cursor-pointer whitespace-nowrap"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Export Excel</span>
            </button>
          </div>
        </div>

        {/* Summary Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Total Invoices */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Invoices</div>
            <div className="text-xl font-bold text-slate-900 mt-1">{summary.totalInvoices || 0}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">ERP Bills (from 5th Oct)</div>
          </div>

          {/* Total Winnings */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Contest Wins</div>
            <div className="text-xl font-bold text-purple-700 mt-1">{summary.totalWinnings || 0}</div>
            <div className="text-[10px] text-purple-500 mt-0.5">Scratch entries</div>
          </div>

          {/* Fully Matched Records */}
          <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200 shadow-sm">
            <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Fully Matched (🟢)</div>
            <div className="text-xl font-bold text-emerald-800 mt-1">{summary.fullyMatchedCount || summary.matchedCount || 0}</div>
            <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">Bill & Phone match</div>
          </div>

          {/* Partially Matched Records */}
          <div className="bg-sky-50/70 p-4 rounded-2xl border border-sky-200 shadow-sm">
            <div className="text-[11px] font-bold text-sky-700 uppercase tracking-wider">Partial Match (🔵)</div>
            <div className="text-xl font-bold text-sky-800 mt-1">{summary.partiallyMatchedCount || 0}</div>
            <div className="text-[10px] text-sky-600 font-semibold mt-0.5">Bill OR Phone match</div>
          </div>

          {/* Invoices Not Scratched */}
          <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200 shadow-sm">
            <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Not Scratched (🟡)</div>
            <div className="text-xl font-bold text-amber-800 mt-1">{summary.invoiceNotScratchedCount || 0}</div>
            <div className="text-[10px] text-amber-600 mt-0.5">Missed scratch</div>
          </div>

          {/* Winnings Without Invoice */}
          <div className="bg-rose-50/70 p-4 rounded-2xl border border-rose-200 shadow-sm">
            <div className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">No Invoice (🔴)</div>
            <div className="text-xl font-bold text-rose-800 mt-1">{summary.winningNoInvoiceCount || 0}</div>
            <div className="text-[10px] text-rose-600 mt-0.5">Discrepancy / No bill</div>
          </div>
        </div>

        {/* Status Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("ALL")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer ${
              activeTab === "ALL"
                ? "bg-slate-900 text-white shadow"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            All Records
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === "ALL" ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-700 font-bold"}`}>
              {totalAllRecordsCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("MATCHED")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer ${
              activeTab === "MATCHED"
                ? "bg-emerald-600 text-white shadow"
                : "bg-white text-emerald-700 hover:bg-emerald-50 border border-emerald-200"
            }`}
          >
            🟢 Fully Matched
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === "MATCHED" ? "bg-emerald-700 text-white" : "bg-emerald-100 text-emerald-800 font-bold"}`}>
              {summary.fullyMatchedCount || summary.matchedCount || 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("PARTIALLY_MATCHED")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer ${
              activeTab === "PARTIALLY_MATCHED"
                ? "bg-sky-600 text-white shadow"
                : "bg-white text-sky-700 hover:bg-sky-50 border border-sky-200"
            }`}
          >
            🔵 Partially Matched
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === "PARTIALLY_MATCHED" ? "bg-sky-700 text-white" : "bg-sky-100 text-sky-800 font-bold"}`}>
              {summary.partiallyMatchedCount || 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("INVOICE_NOT_SCRATCHED")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer ${
              activeTab === "INVOICE_NOT_SCRATCHED"
                ? "bg-amber-600 text-white shadow"
                : "bg-white text-amber-700 hover:bg-amber-50 border border-amber-200"
            }`}
          >
            🟡 Invoices Not Scratched
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === "INVOICE_NOT_SCRATCHED" ? "bg-amber-700 text-white" : "bg-amber-100 text-amber-800 font-bold"}`}>
              {summary.invoiceNotScratchedCount || 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("WINNING_NO_INVOICE")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer ${
              activeTab === "WINNING_NO_INVOICE"
                ? "bg-rose-600 text-white shadow"
                : "bg-white text-rose-700 hover:bg-rose-50 border border-rose-200"
            }`}
          >
            🔴 Winnings Without Invoice
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === "WINNING_NO_INVOICE" ? "bg-rose-700 text-white" : "bg-rose-100 text-rose-800 font-bold"}`}>
              {summary.winningNoInvoiceCount || 0}
            </span>
          </button>
        </div>

        {/* Data Table with Integrated Filters in top header row */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-500">
              <div className="inline-block animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mb-3" />
              <p className="font-medium text-sm">Comparing invoices against contest winnings...</p>
            </div>
          ) : records.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-base font-semibold text-slate-700">No reconciliation records found</p>
              <p className="text-xs text-slate-400 mt-1">Try changing dates or branch filters.</p>
            </div>
          ) : (
            <DataTable
              title="Reconciliation Table"
              tableId="scratch_win_reconciliation_table"
              columns={columns}
              data={records}
              toggleActions={tableToggleActions}
              searchPlaceholder="Search Invoice, Mobile, Customer Name, Prize..."
              initialPageSize={50}
              pageSizeOptions={[25, 50, 100, 200]}
              showColumnToggle={true}
              showPagination={true}
            />
          )}
        </div>
      </main>
    </div>
  );
}

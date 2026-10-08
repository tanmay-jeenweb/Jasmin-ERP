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
  const { hasPermission } = usePermission();
  const canWrite = hasPermission("contest_winnings_master", "write") || hasPermission("scratch_win_reconciliation", "write");

  const [winnings, setWinnings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [stats, setStats] = useState({});
  const [lastSync, setLastSync] = useState(null);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
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
        search: search.trim(),
        branch_code: selectedBranch,
        status: statusFilter,
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
        setStats(res.data.stats || {});
        if (res.data.lastSync) setLastSync(res.data.lastSync);
      }
    } catch (err) {
      console.error("Failed to fetch contest winnings", err);
      toast.error(err.response?.data?.message || "Failed to load contest winnings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWinnings();
  }, [selectedBranch, statusFilter, fromDate, toDate]);

  // Handle Search Debounce / Trigger
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchWinnings();
  };

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
    setSearch("");
    setSelectedBranch("");
    setStatusFilter("all");
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
      const worksheet = workbook.addWorksheet("Contest Winnings Master");

      // Title & Header styling
      worksheet.mergeCells("A1:K1");
      const titleCell = worksheet.getCell("A1");
      titleCell.value = "Scratch & Win Contest Winnings Master";
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
      anchor.download = `Contest_Winnings_Master_${new Date().toISOString().slice(0, 10)}.xlsx`;
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

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-gradient-to-tr from-amber-500 to-orange-400 text-white rounded-xl shadow-md shadow-orange-500/20">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V6a2 2 0 10-2 2h2zm0 0H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V10a2 2 0 00-2-2h-8z" />
                </svg>
              </span>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Contest Winnings Master</h1>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Live Scratch & Win contest entries and prize claims synced from win.jasminmobile.com
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Last Sync indicator */}
            {lastSync && (
              <div className="text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                Last synced: <span className="font-semibold text-slate-700">{formatDateTime(lastSync.created_at)}</span>
              </div>
            )}

            {/* Sync Button */}
            {canWrite && (
              <button
                type="button"
                onClick={handleSync}
                disabled={syncing}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-blue-500/20 transition-all duration-200 cursor-pointer disabled:opacity-50"
              >
                <svg
                  className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {syncing ? "Syncing API..." : "Sync Winnings Now"}
              </button>
            )}

            {/* Export Excel Button */}
            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-emerald-500/20 transition-all duration-200 cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export Excel
            </button>
          </div>
        </div>

        {/* Stats KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Winnings</div>
              <div className="text-2xl font-bold text-slate-900 mt-0.5">{stats.total_winnings || winnings.length}</div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Claimed Gifts</div>
              <div className="text-2xl font-bold text-slate-900 mt-0.5">{stats.claimed_count || winnings.length}</div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Unique Branches</div>
              <div className="text-2xl font-bold text-slate-900 mt-0.5">{stats.unique_branches || 0}</div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Unique Customers</div>
              <div className="text-2xl font-bold text-slate-900 mt-0.5">{stats.unique_customers || 0}</div>
            </div>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Search */}
            <div className="lg:col-span-2 relative">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Search</label>
              <div className="relative">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Customer Name, Mobile, Invoice No, Prize..."
                  className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <svg className="w-4 h-4 text-slate-400 absolute left-3 top-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            {/* Branch Filter */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Branch</label>
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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
            </div>

            {/* From Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">From Date</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>

            {/* To Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">To Date</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
          </form>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
            <span>Showing {winnings.length} winning records</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSearchSubmit}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
              >
                Apply Search
              </button>
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-3 py-1.5 text-slate-600 hover:text-slate-800 font-medium rounded-lg hover:bg-slate-100 transition"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-500">
              <div className="inline-block animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mb-3" />
              <p className="font-medium text-sm">Loading contest winning records...</p>
            </div>
          ) : winnings.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p className="text-base font-semibold text-slate-700">No contest winnings found</p>
              <p className="text-xs text-slate-400 mt-1">Try changing filters or click "Sync Winnings Now" to fetch latest records.</p>
            </div>
          ) : (
            <DataTable
              title="Contest Winnings Table"
              tableId="contest_winnings_master_table"
              columns={columns}
              data={winnings}
              initialPageSize={50}
              pageSizeOptions={[25, 50, 100, 200]}
              showColumnToggle={true}
              showPagination={true}
              searchable={true}
            />
          )}
        </div>
      </main>
    </div>
  );
}

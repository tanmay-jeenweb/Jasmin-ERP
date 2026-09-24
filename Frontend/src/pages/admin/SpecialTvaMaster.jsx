import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import DataTable from "../../components/DataTable";
import {
  getAllSpecialTvas,
  createSpecialTva,
  updateSpecialTva,
  deleteSpecialTva,
  importSpecialTvaTargets
} from "../../api/specialTvaApi";
import { getBranches } from "../../api/branchApi";
import toast from "react-hot-toast";
import { usePermission } from "../../context/PermissionContext";
import ExcelJS from "exceljs";
import * as XLSX from "xlsx-js-style";

// Format date helper
const formatDate = (val) => {
  if (!val) return "—";
  const str = String(val).split("T")[0];
  const parts = str.split("-");
  if (parts.length === 3) {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const [y, m, d] = parts;
    const mName = months[parseInt(m, 10) - 1] || m;
    return `${parseInt(d, 10)} ${mName} ${y}`;
  }
  return str;
};

// Calculate days between two dates inclusive
const calculateDays = (start, end) => {
  if (!start || !end) return 0;
  const d1 = new Date(start);
  const d2 = new Date(end);
  const diffTime = d2.getTime() - d1.getTime();
  if (isNaN(diffTime) || diffTime < 0) return 0;
  return Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
};

// ─── Create / Edit Special TVA Modal ──────────────────────────────────────────
function SpecialTvaModal({ isOpen, row, onClose, onSave, saving }) {
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    if (row) {
      setTitle(row.title || "");
      setStartDate(row.start_date ? String(row.start_date).split("T")[0] : "");
      setEndDate(row.end_date ? String(row.end_date).split("T")[0] : "");
    } else {
      const today = new Date();
      const nextMonth = new Date(today);
      nextMonth.setMonth(today.getMonth() + 1);

      setTitle("");
      setStartDate(today.toISOString().split("T")[0]);
      setEndDate(nextMonth.toISOString().split("T")[0]);
    }
  }, [row, isOpen]);

  if (!isOpen) return null;

  const isEdit = Boolean(row);
  const days = calculateDays(startDate, endDate);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!startDate || !endDate) {
      toast.error("Both start and end dates are required");
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      toast.error("Start date cannot be after End date");
      return;
    }

    onSave({
      id: isEdit ? row.id : null,
      title: title.trim(),
      start_date: startDate,
      end_date: endDate
    });
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-900/55 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-[18px] w-full max-w-[550px] mx-auto shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-br from-indigo-600 to-indigo-700 shrink-0">
          <div>
            <h2 className="m-0 text-base sm:text-lg font-bold text-white">
              {isEdit ? "Edit Special TVA Master" : "Create Special TVA Master"}
            </h2>
            <p className="mt-0.5 text-xs text-indigo-100">
              {isEdit ? "Update title and period dates" : "Define campaign period and allocate target table"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="bg-white/15 border-none rounded-lg w-[32px] h-[32px] cursor-pointer flex items-center justify-center text-white hover:bg-white/20 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-[18px] h-[18px]">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="px-6 py-5 space-y-4 overflow-y-auto">
            {/* Title Input */}
            <div>
              <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1.5">
                Campaign / Master Title <span className="text-rose-650">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="e.g. Diwali 2026 Special Target, Festival Campaign"
                className="w-full border-[1.5px] border-slate-300 rounded-[9px] px-3.5 py-2.5 text-sm outline-none text-slate-800 focus:border-indigo-650 transition-colors"
              />
            </div>

            {/* Date Pickers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1.5">
                  Start Date <span className="text-rose-650">*</span>
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  className="w-full border-[1.5px] border-slate-300 rounded-[9px] px-3 py-2 text-sm outline-none text-slate-800 focus:border-indigo-650 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1.5">
                  End Date <span className="text-rose-650">*</span>
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                  className="w-full border-[1.5px] border-slate-300 rounded-[9px] px-3 py-2 text-sm outline-none text-slate-800 focus:border-indigo-650 transition-colors"
                />
              </div>
            </div>

            {/* Duration pill */}
            <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-3 flex items-center justify-between text-xs">
              <span className="text-indigo-800 font-semibold flex items-center gap-1.5">
                <i className="fa-regular fa-calendar-days text-indigo-500"></i>
                Campaign Duration:
              </span>
              <span className="bg-indigo-600 text-white font-bold px-2.5 py-0.5 rounded-full text-xs">
                {days > 0 ? `${days} Days` : "Invalid Date Range"}
              </span>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="px-6 py-3.5 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-lg border-[1.5px] border-slate-300 text-slate-600 bg-white font-semibold text-xs cursor-pointer hover:bg-slate-100 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim() || !startDate || !endDate}
              className="px-5 py-2 rounded-lg border-none text-white font-bold text-xs transition-all bg-gradient-to-br from-indigo-600 to-indigo-750 shadow-md cursor-pointer disabled:bg-slate-400 disabled:cursor-not-allowed hover:opacity-95"
            >
              {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Master Entry"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Quick Target Import / Export Modal ───────────────────────────────────────
function TargetImportModal({ isOpen, row, onClose, onRefresh }) {
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef(null);

  if (!isOpen || !row) return null;

  // Handle Download Excel Template
  const handleDownloadTemplate = async () => {
    setExporting(true);
    try {
      const response = await getBranches();
      const branches = response.data?.success ? (response.data.data || []) : (response.data || []);

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Target Template", {
        views: [{ showGridLines: true }]
      });

      worksheet.columns = [
        { header: "Sr. No.", key: "sr_no", width: 10 },
        { header: "Branch Name", key: "branch_name", width: 32 },
        { header: "Type", key: "type", width: 16 },
        { header: "State", key: "state", width: 20 },
        { header: "Zone", key: "zone", width: 18 },
        { header: "MF", key: "mf", width: 14 },
        { header: "Target", key: "target", width: 18 }
      ];

      // Add branch rows
      let sNo = 1;
      branches.forEach((b) => {
        if (!b.name) return;
        worksheet.addRow({
          sr_no: sNo++,
          branch_name: b.name || "",
          type: b.store_type ? (b.store_type.charAt(0).toUpperCase() + b.store_type.slice(1)) : "Branch",
          state: b.state_name || "",
          zone: b.branch_cls_05 || "",
          mf: "",
          target: ""
        });
      });

      // Style header row
      const headerRow = worksheet.getRow(1);
      headerRow.height = 28;
      headerRow.eachCell((cell) => {
        cell.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF4F46E5" } // Indigo header
        };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom: { style: "medium", color: { argb: "FF3730A3" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } }
        };
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Special_TVA_Target_Template_${row.title.replace(/\s+/g, "_")}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success("Excel template downloaded successfully!");
    } catch (err) {
      console.error("Failed to generate Excel template:", err);
      toast.error("Failed to download template. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  // Handle Excel File Upload & Import
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const buffer = evt.target.result;
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        if (!jsonData || jsonData.length === 0) {
          toast.error("The uploaded Excel sheet contains no rows.");
          setImporting(false);
          return;
        }

        const firstRow = jsonData[0];
        const keys = Object.keys(firstRow);

        const branchNameKey = keys.find(k =>
          k.toLowerCase().includes("branch name") ||
          k.toLowerCase().includes("party name") ||
          k.toLowerCase() === "branch" ||
          k.toLowerCase() === "branch_name"
        );

        const targetKey = keys.find(k =>
          k.toLowerCase().includes("target") ||
          k.toLowerCase() === "target" ||
          k.toLowerCase().includes("2 month target")
        );

        const mfKey = keys.find(k =>
          k.toLowerCase() === "mf" ||
          k.toLowerCase().includes("mf")
        );

        if (!branchNameKey) {
          toast.error("Could not find 'Branch Name' or 'Party Name' column in Excel file.");
          setImporting(false);
          return;
        }

        if (!targetKey) {
          toast.error("Could not find 'Target' column in Excel file.");
          setImporting(false);
          return;
        }

        const mappedRecords = jsonData.map(r => ({
          branch_name: String(r[branchNameKey] || "").trim(),
          target: r[targetKey] !== undefined && r[targetKey] !== "" ? Number(r[targetKey]) : 0,
          mf: mfKey && r[mfKey] !== undefined ? String(r[mfKey]).trim() : ""
        })).filter(r => r.branch_name && r.branch_name.toUpperCase() !== "TOTAL");

        if (mappedRecords.length === 0) {
          toast.error("No valid branch rows found in the sheet.");
          setImporting(false);
          return;
        }

        const res = await importSpecialTvaTargets(row.id, mappedRecords);
        if (res.data?.success) {
          toast.success(res.data.message || "Targets imported successfully!");
          onRefresh();
          onClose();
        } else {
          toast.error(res.data?.message || "Import failed");
        }
      } catch (err) {
        console.error("Failed to parse/import targets:", err);
        toast.error(err.response?.data?.message || err.message || "Failed to import Excel");
      } finally {
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };

    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-900/55 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-[18px] w-full max-w-[500px] mx-auto shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-br from-indigo-600 to-indigo-700 shrink-0">
          <div>
            <h2 className="m-0 text-base font-bold text-white">Import / Export Targets</h2>
            <p className="mt-0.5 text-xs text-indigo-100">{row.title}</p>
          </div>
          <button
            onClick={onClose}
            className="bg-white/15 border-none rounded-lg w-[32px] h-[32px] cursor-pointer flex items-center justify-center text-white hover:bg-white/20 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-[18px] h-[18px]">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Step 1: Download */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-800">Step 1: Download Template</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Pre-filled with all branches, ready for target input</p>
            </div>
            <button
              onClick={handleDownloadTemplate}
              disabled={exporting}
              className="px-3.5 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 font-bold text-xs hover:bg-indigo-100 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <i className="fa-solid fa-file-excel text-emerald-600"></i>
              {exporting ? "Generating..." : "Download"}
            </button>
          </div>

          {/* Step 2: Upload */}
          <div className="border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/30 rounded-xl p-6 text-center transition-colors">
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx, .xls"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 mb-3 text-lg">
                <i className="fa-solid fa-cloud-arrow-up"></i>
              </div>
              <p className="text-xs font-bold text-slate-800">Step 2: Upload Filled Template</p>
              <p className="text-[11px] text-slate-500 mt-0.5 mb-3">Only the Target column needs to be filled</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <i className="fa-solid fa-upload"></i>
                {importing ? "Uploading & Processing..." : "Select Excel File"}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-300 text-slate-600 bg-white font-semibold text-xs cursor-pointer hover:bg-slate-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SpecialTvaMaster() {
  const navigate = useNavigate();
  const { hasPermission, isAdmin } = usePermission();
  const canWrite = isAdmin || hasPermission("special_tva_master", "write");
  const canUpdate = isAdmin || hasPermission("special_tva_master", "update");
  const canDelete = isAdmin || hasPermission("special_tva_master", "delete");

  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [saving, setSaving] = useState(false);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [targetModalRow, setTargetModalRow] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getAllSpecialTvas();
      if (res.data?.success) {
        setCampaigns(res.data.data || []);
      } else {
        setError(res.data?.message || "Failed to load Special TVA masters");
      }
    } catch (err) {
      console.error("Failed to load Special TVA masters:", err);
      setError("Unable to load Special TVA records. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async (formData) => {
    setSaving(true);
    try {
      if (formData.id) {
        const res = await updateSpecialTva(formData.id, formData);
        if (res.data?.success) {
          toast.success("Special TVA updated successfully");
          setIsModalOpen(false);
          loadData();
        } else {
          toast.error(res.data?.message || "Update failed");
        }
      } else {
        const res = await createSpecialTva(formData);
        if (res.data?.success) {
          toast.success("Special TVA campaign created successfully");
          setIsModalOpen(false);
          loadData();
        } else {
          toast.error(res.data?.message || "Creation failed");
        }
      }
    } catch (err) {
      console.error("Failed to save Special TVA:", err);
      toast.error(err.response?.data?.message || err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Are you sure you want to delete '${row.title}'? This will also remove all its branch targets and table.`)) {
      return;
    }

    try {
      const res = await deleteSpecialTva(row.id);
      if (res.data?.success) {
        toast.success("Special TVA master deleted successfully");
        loadData();
      } else {
        toast.error(res.data?.message || "Failed to delete");
      }
    } catch (err) {
      console.error("Failed to delete Special TVA:", err);
      toast.error(err.response?.data?.message || err.message || "Failed to delete");
    }
  };

  const columns = [
    {
      key: "title",
      label: "Campaign Title",
      minWidth: "220px",
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 font-bold">
            <i className="fa-solid fa-bullseye text-sm"></i>
          </div>
          <div>
            <p className="font-bold text-slate-800 text-sm">{row.title}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Table: {row.table_name}</p>
          </div>
        </div>
      )
    },
    {
      key: "period",
      label: "Period",
      minWidth: "190px",
      render: (row) => (
        <div className="flex flex-col text-xs">
          <span className="font-semibold text-slate-700">
            {formatDate(row.start_date)} — {formatDate(row.end_date)}
          </span>
          <span className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
            <i className="fa-regular fa-clock text-[10px]"></i>
            {calculateDays(row.start_date, row.end_date)} days duration
          </span>
        </div>
      )
    },
    {
      key: "total_target",
      label: "Total Target",
      minWidth: "130px",
      render: (row) => (
        <span className="font-bold text-slate-800 text-sm">
          {Number(row.total_target || 0).toLocaleString("en-IN")}
        </span>
      )
    },
    {
      key: "branch_count",
      label: "Branches",
      minWidth: "110px",
      render: (row) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
          {row.branch_count || 0} Branches
        </span>
      )
    },
    {
      key: "added_by_name",
      label: "Created By",
      minWidth: "130px",
      render: (row) => (
        <span className="text-xs text-slate-600 font-medium">{row.added_by_name || "—"}</span>
      )
    },
    {
      key: "actions",
      label: "Actions",
      minWidth: "220px",
      align: "center",
      render: (row) => (
        <div className="flex items-center justify-center gap-1.5">
          {/* View Report Button */}
          <button
            onClick={() => navigate(`/admin/special-tva-report/${row.id}`)}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
            title="View Live Report"
          >
            <i className="fa-solid fa-chart-column"></i>
            Report
          </button>

          {/* Import / Export Target Button */}
          {canWrite && (
            <button
              onClick={() => {
                setTargetModalRow(row);
                setIsImportModalOpen(true);
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              title="Import or Export Targets"
            >
              <i className="fa-solid fa-file-arrow-up"></i>
              Targets
            </button>
          )}

          {/* Edit Master Button */}
          {canUpdate && (
            <button
              onClick={() => {
                setSelectedRow(row);
                setIsModalOpen(true);
              }}
              className="flex w-8 h-8 items-center justify-center rounded-lg border border-purple-200 bg-purple-50 text-indigo-650 cursor-pointer hover:bg-purple-100 transition-colors"
              title="Edit"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-[15px] h-[15px]">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931Z" />
              </svg>
            </button>
          )}

          {/* Delete Master Button */}
          {canDelete && (
            <button
              onClick={() => handleDelete(row)}
              className="flex w-8 h-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 cursor-pointer hover:bg-rose-100 transition-colors"
              title="Delete"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-[15px] h-[15px]">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 7.5h12m-1.5 0-.563 12.375A2.25 2.25 0 0113.693 21H10.307a2.25 2.25 0 01-2.244-2.125L7.5 7.5m3-3h3A1.5 1.5 0 0115 6v1.5H9V6a1.5 1.5 0 011.5-1.5Z" />
              </svg>
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans">
      <Navbar title="ERP Admin" />

      {/* Create / Edit Modal */}
      <SpecialTvaModal
        isOpen={isModalOpen}
        row={selectedRow}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedRow(null);
        }}
        onSave={handleSave}
        saving={saving}
      />

      {/* Target Import/Export Modal */}
      <TargetImportModal
        isOpen={isImportModalOpen}
        row={targetModalRow}
        onClose={() => {
          setIsImportModalOpen(false);
          setTargetModalRow(null);
        }}
        onRefresh={loadData}
      />

      <main className="flex-1 flex flex-col w-full mx-auto px-4 sm:px-[30px] py-6 sm:py-8">
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-750 px-4 py-3 rounded-lg mb-5 text-sm font-medium">
            {error}
          </div>
        )}

        <DataTable
          tableId="special_tva_master"
          title="Special TVA Master"
          data={campaigns}
          columns={columns}
          loading={loading}
          searchPlaceholder="Search campaign title..."
          actionButton={
            canWrite ? (
              <button
                onClick={() => {
                  setSelectedRow(null);
                  setIsModalOpen(true);
                }}
                className="flex w-10 h-10 items-center justify-center rounded-[9px] bg-gradient-to-br from-indigo-655 to-indigo-755 text-white border-none cursor-pointer shadow-[0_2px_8px_rgba(104,4,161,0.35)] hover:opacity-95 transition-opacity"
                title="Create Special TVA"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-[18px] h-[18px]">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>
            ) : null
          }
        />
      </main>
    </div>
  );
}

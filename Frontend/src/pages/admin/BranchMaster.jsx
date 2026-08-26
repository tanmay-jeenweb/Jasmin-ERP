import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import { getBranches, updateBranch, deleteBranch, syncBranches } from "../../api/branchApi";
import DataTable from "../../components/DataTable";
import toast from "react-hot-toast";
import { usePermission } from "../../context/PermissionContext";
import * as XLSX from "xlsx";

// ─── Branch View Modal (Read-Only Detail view) ───────────────────────────────────
function BranchViewModal({ isOpen, row, onClose }) {
  if (!isOpen || !row) return null;

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString();
  };

  const fields = [
    { label: "Branch Name", value: row.name },
    { label: "Branch Code", value: row.code },
    { label: "Phone Number", value: row.phone },
    { label: "Email Address", value: row.email },
    { label: "Pincode", value: row.pincode },
    { label: "GSTIN", value: row.GSTIN },
    { label: "Opened On", value: formatDate(row.opened_on) },
    { label: "Store Type", value: row.store_type ? row.store_type.toUpperCase() : "—" },
    { label: "State", value: row.state_name || "—" },
    { label: "City", value: row.city },
    { label: "Area Branch Manager (ABM)", value: row.abm || "—" },
    { label: "Zone", value: row.branch_cls_05 || "—" },
    { label: "Status", value: row.status ? row.status.toUpperCase() : "—", isStatus: true },
    { label: "Address", value: row.address, fullWidth: true },
  ];

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-900/55 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-[18px] w-full max-w-[750px] mx-auto shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-7 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-br from-indigo-600 to-indigo-700">
          <div>
            <h2 className="m-0 text-lg font-bold text-white">Branch Details</h2>
            <p className="mt-1 text-[13px] text-indigo-100">Full specifications for {row.name}</p>
          </div>
          <button onClick={onClose} className="bg-white/15 border-none rounded-lg w-[34px] h-[34px] cursor-pointer flex items-center justify-center text-white hover:bg-white/20 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-[18px] h-[18px]">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-7 overflow-y-auto flex-1 bg-slate-50">
          <div className="grid grid-cols-2 gap-5">
            {fields.map((f, idx) => (
              <div key={idx} className={`bg-white p-3.5 px-4.5 border border-slate-200 rounded-[10px] ${f.fullWidth ? "col-span-2" : "col-span-1"}`}>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{f.label}</span>
                {f.isStatus ? (
                  <p className="mt-1">
                    <span className={`inline-flex items-center px-2.5 py-[3px] rounded-md text-xs font-bold ${row.status === "active" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                      {f.value}
                    </span>
                  </p>
                ) : (
                  <p className="mt-1 text-sm font-semibold text-slate-800 whitespace-pre-line">{f.value || "—"}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-7 py-4 border-t border-slate-100 flex justify-end bg-slate-50">
          <button type="button" onClick={onClose}
            className="px-6 py-2.25 rounded-lg border-[1.5px] border-slate-300 text-slate-600 bg-white font-bold text-[13px] cursor-pointer hover:bg-slate-50 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────
export default function BranchMaster() {
  const navigate = useNavigate();
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [showActive, setShowActive] = useState(true);
  const [selectedClass05, setSelectedClass05] = useState("");

  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);

  const { hasPermission } = usePermission();

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getBranches();
      setBranches(res.data.data || []);
    } catch (err) {
      console.error("Failed to load branch data", err);
      setError("Unable to load branch records. Please reload.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleStatus = async (row) => {
    const nextStatus = row.status === "active" ? "inactive" : "active";
    setSaving(true);
    try {
      const updatedData = {
        name: row.name,
        code: row.code,
        phone: row.phone,
        email: row.email,
        pincode: row.pincode,
        GSTIN: row.GSTIN,
        opened_on: row.opened_on ? new Date(row.opened_on).toISOString().split("T")[0] : "",
        store_type: row.store_type,
        state_id: row.state_id,
        city: row.city,
        address: row.address,
        abm: row.abm,
        status: nextStatus,
        branch_cls_05: row.branch_cls_05 || ""
      };
      await updateBranch(row.id, updatedData);
      toast.success(`Branch status updated to ${nextStatus}`);
      await loadData();
    } catch (err) {
      console.error("Failed to toggle status", err);
      toast.error(err?.response?.data?.message || "Failed to update branch status.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this branch? This action cannot be undone.")) return;
    setSaving(true);
    try {
      await deleteBranch(id);
      toast.success("Branch record deleted successfully");
      await loadData();
    } catch (err) {
      console.error("Failed to delete branch", err);
      toast.error(err?.response?.data?.message || "Unable to delete branch record.");
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setError("");
    const loadToastId = toast.loading("Syncing branches from external API...");
    try {
      const response = await syncBranches();
      toast.success(response.data.message || "Sync completed successfully!", { id: loadToastId });
      await loadData();
    } catch (err) {
      console.error("Failed to sync branches", err);
      toast.error(err?.response?.data?.message || "Sync failed. Please try again.", { id: loadToastId });
    } finally {
      setSyncing(false);
    }
  };

  const handleExportExcel = () => {
    try {
      const dataToExport = branches.map((row, idx) => ({
        "Sr.No.": idx + 1,
        "Name": row.name || "",
        "Code": row.code || "",
        "City": row.city || "",
        "State": row.state_name || "",
        "PHONE": row.phone || "",
        "Other phones": "",
        "Store type": row.store_type ? row.store_type.charAt(0).toUpperCase() + row.store_type.slice(1) : "",
        "Zone": row.branch_cls_05 || "",
        "Status": row.status === "active" ? "Active" : "InActive"
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);

      const maxLens = {};
      dataToExport.forEach(row => {
        Object.keys(row).forEach(key => {
          const val = String(row[key]);
          maxLens[key] = Math.max(maxLens[key] || key.length, val.length);
        });
      });
      worksheet["!cols"] = Object.keys(maxLens).map(key => ({
        wch: maxLens[key] + 3
      }));

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Branches");
      XLSX.writeFile(workbook, "Branch_Master_Report.xlsx");
      toast.success("Excel exported successfully!");
    } catch (err) {
      console.error("Failed to export Excel:", err);
      toast.error("Failed to export Excel file.");
    }
  };

  const uniqueClass05Values = useMemo(() => {
    const values = branches
      .map(b => b.branch_cls_05)
      .filter(val => val !== undefined && val !== null && val !== "");
    return Array.from(new Set(values)).sort();
  }, [branches]);

  const filteredBranches = useMemo(() => {
    return branches.filter(b => {
      const matchStatus = b.status === (showActive ? "active" : "inactive");
      const matchClass05 = !selectedClass05 || b.branch_cls_05 === selectedClass05;
      return matchStatus && matchClass05;
    });
  }, [branches, showActive, selectedClass05]);

  const columns = useMemo(() => {
    const cols = [
      { key: "id", label: "ID", minWidth: "60px" },
      {
        key: "name", label: "Name",
        render: (row) => <span className="font-bold text-slate-900">{row.name}</span>
      },
      {
        key: "code", label: "Code",
        render: (row) => <span className="font-mono font-semibold text-slate-500">{row.code}</span>
      },
      {
        key: "city", label: "City",
        render: (row) => <span className="text-slate-650">{row.city}</span>
      },
      {
        key: "state_name", label: "State",
        render: (row) => <span className="text-slate-650">{row.state_name || "—"}</span>
      },
      {
        key: "phone", label: "Phone",
        render: (row) => <span className="text-slate-650">{row.phone}</span>
      },
      {
        key: "store_type", label: "Store Type",
        render: (row) => (
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded capitalize ${row.store_type === "branch" ? "bg-blue-50 text-blue-800 border border-blue-200" : "bg-amber-50 text-amber-800 border border-amber-200"}`}>
            {row.store_type}
          </span>
        )
      },
      {
        key: "branch_cls_05", label: "Zone",
        render: (row) => <span className="text-slate-650">{row.branch_cls_05 || "—"}</span>
      }
    ];

    const canRead = hasPermission("branch_master", "read");
    const canUpdate = hasPermission("branch_master", "update");
    const canDelete = hasPermission("branch_master", "delete");

    if (canRead || canUpdate || canDelete) {
      cols.push({
        key: "actions", label: "Actions", sortable: false, minWidth: "200px",
        render: (row) => {
          const isActive = row.status === "active";
          return (
            <div className="flex items-center gap-2">
              {/* View Action */}
              {canRead && (
                <button
                  onClick={() => {
                    setSelectedRow(row);
                    setIsViewModalOpen(true);
                  }}
                  className="flex w-8 h-8 items-center justify-center rounded-lg border border-slate-355 bg-slate-50 text-slate-600 cursor-pointer hover:bg-slate-100 transition-colors"
                  title="View"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  </svg>
                </button>
              )}
              {/* Code Action */}
              {canUpdate && (
                <button
                  onClick={() => {
                    navigate(`/admin/branches/code/${row.id}`);
                  }}
                  className="flex w-8 h-8 items-center justify-center rounded-lg border border-purple-300 bg-purple-50 text-purple-700 cursor-pointer hover:bg-purple-100 transition-colors"
                  title="Branch Finance Code"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-[15px] h-[15px]">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                  </svg>
                </button>
              )}

              {/* Active/Inactive Toggle */}
              {canUpdate && (
                <button
                  onClick={() => handleToggleStatus(row)}
                  className={`flex w-8 h-8 items-center justify-center rounded-lg border cursor-pointer transition-colors ${isActive ? "border-green-200 bg-green-50 text-green-600 hover:bg-green-100" : "border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100"}`}
                  title={isActive ? "Mark Inactive" : "Mark Active"}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-[15px] h-[15px]">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 5.636a9 9 0 1 0 12.728 0M12 3v9" />
                  </svg>
                </button>
              )}

              {/* Delete Action */}
              {canDelete && (
                <button
                  onClick={() => handleDelete(row.id)}
                  className="flex w-8 h-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 cursor-pointer hover:bg-rose-100 transition-colors"
                  title="Delete"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-[15px] h-[15px]">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 7.5h12m-1.5 0-.563 12.375A2.25 2.25 0 0113.693 21H10.307a2.25 2.25 0 01-2.244-2.125L7.5 7.5m3-3h3A1.5 1.5 0 0115 6v1.5H9V6a1.5 1.5 0 011.5-1.5Z" />
                  </svg>
                </button>
              )}
            </div>
          );
        }
      });
    }

    return cols;
  }, [saving, hasPermission]);

  return (
    <div className="flex flex-col flex-1 bg-slate-50 font-sans">
      <Navbar title="ERP Admin" />

      {/* View Detail Modal */}
      <BranchViewModal
        isOpen={isViewModalOpen}
        row={selectedRow}
        onClose={() => {
          setIsViewModalOpen(false);
          setSelectedRow(null);
        }}
      />

      <main className="flex-1 flex flex-col w-full mx-auto px-[30px] py-8">
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg mb-5 text-sm font-medium">
            {error}
          </div>
        )}
        <DataTable
          tableId="branch_master"
          title="Branch Master"
          data={filteredBranches}
          columns={columns}
          loading={loading}
          searchPlaceholder="Search branches by name, code, city..."
          toggleActions={
            <div className="flex items-center gap-4">
              <select
                value={selectedClass05}
                onChange={(e) => setSelectedClass05(e.target.value)}
                className="h-10 rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm outline-none text-slate-700 focus:border-indigo-650 transition-colors"
              >
                <option value="">All Zones</option>
                {uniqueClass05Values.map(val => (
                  <option key={val} value={val}>{val}</option>
                ))}
              </select>
              <div className="flex items-center gap-2.5 mr-4 cursor-pointer select-none" onClick={() => setShowActive(v => !v)}>
                <span className={`text-[13px] font-bold transition-colors ${!showActive ? "text-rose-600" : "text-slate-400"}`}>Inactive</span>
                <div className={`relative w-[38px] h-5 rounded-full transition-colors ${showActive ? "bg-indigo-650" : "bg-slate-300"}`}>
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.15)] transition-transform ${showActive ? "translate-x-[18px]" : "translate-x-0"}`} />
                </div>
                <span className={`text-[13px] font-bold transition-colors ${showActive ? "text-emerald-500" : "text-slate-400"}`}>Active</span>
              </div>
            </div>
          }
          actionButton={
            <div className="flex items-center gap-3">
              {hasPermission("branch_master", "read") && (
                <button
                  onClick={handleExportExcel}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-[9px] text-white border-none cursor-pointer font-semibold text-[13px] bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-[0_2px_8px_rgba(16,185,129,0.35)] hover:opacity-95 transition-opacity"
                  title="Export to Excel"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Export Excel
                </button>
              )}
              {hasPermission("branch_master", "write") && (
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-[9px] text-white border-none cursor-pointer font-semibold text-[13px] bg-gradient-to-br from-indigo-600 to-indigo-700 shadow-[0_2px_8px_rgba(104,4,161,0.35)] disabled:bg-slate-400 disabled:cursor-not-allowed disabled:shadow-none hover:opacity-95 transition-all"
                  title="Sync Branches from API"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2.5}
                    stroke="currentColor"
                    className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                  {syncing ? "Syncing..." : "Sync from API"}
                </button>
              )}
              {hasPermission("branch_master", "write") && (
                <button
                  onClick={() => {
                    navigate("/admin/branches/create");
                  }}
                  className="flex w-10 h-10 items-center justify-center rounded-[9px] bg-gradient-to-br from-indigo-650 to-indigo-755 text-white border-none cursor-pointer shadow-[0_2px_8px_rgba(104,4,161,0.35)] hover:opacity-95 transition-opacity"
                  title="Create Branch"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-[18px] h-[18px]">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </button>
              )}
            </div>
          }
        />
      </main>
    </div>
  );
}

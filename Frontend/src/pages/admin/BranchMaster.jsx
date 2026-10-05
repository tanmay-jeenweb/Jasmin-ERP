import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import { getBranches, updateBranch, deleteBranch, syncBranches, toggleBranchInternalStatus } from "../../api/branchApi";
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
    { label: "API Status", value: row.status ? row.status.toUpperCase() : "—", isStatus: true, statusVal: row.status },
    { label: "Internal Status", value: (row.internal_status || "active").toUpperCase(), isStatus: true, statusVal: row.internal_status || "active" },
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
                    <span className={`inline-flex items-center px-2.5 py-[3px] rounded-md text-xs font-bold ${
                      (f.statusVal || f.value || "").toLowerCase() === "active" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                    }`}>
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
  const [selectedZones, setSelectedZones] = useState([]);
  const [selectedApiStatuses, setSelectedApiStatuses] = useState([]);
  const [zoneFilterSearch, setZoneFilterSearch] = useState("");
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const filterDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target)) {
        setIsFilterDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const activeFilterCount = (selectedZones.length > 0 ? 1 : 0) + (selectedApiStatuses.length > 0 ? 1 : 0);

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

  const handleToggleInternalStatus = async (row) => {
    const currentInternalStatus = row.internal_status || "active";
    const nextStatus = currentInternalStatus === "active" ? "inactive" : "active";
    setSaving(true);
    try {
      await toggleBranchInternalStatus(row.id, nextStatus);
      toast.success(`Branch internal status updated to ${nextStatus}`);
      await loadData();
    } catch (err) {
      console.error("Failed to toggle internal status", err);
      toast.error(err?.response?.data?.message || "Failed to update branch internal status.");
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
        "API Status": row.status === "active" ? "Active" : "InActive",
        "Internal Status": (row.internal_status || "active") === "active" ? "Active" : "InActive"
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
      const internalStatus = b.internal_status || "active";
      const matchInternalStatus = internalStatus === (showActive ? "active" : "inactive");
      const matchZone = selectedZones.length === 0 || selectedZones.includes(b.branch_cls_05 || "");
      const matchApiStatus = selectedApiStatuses.length === 0 || selectedApiStatuses.includes(b.status || "active");
      return matchInternalStatus && matchZone && matchApiStatus;
    });
  }, [branches, showActive, selectedZones, selectedApiStatuses]);

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
      },
      {
        key: "status", label: "API Status",
        render: (row) => {
          const isApiActive = row.status === "active";
          return (
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
              isApiActive ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"
            }`}>
              {row.status ? row.status.toUpperCase() : "—"}
            </span>
          );
        }
      },
      {
        key: "internal_status", label: "Internal Status",
        render: (row) => {
          const isInternalActive = (row.internal_status || "active") === "active";
          return (
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
              isInternalActive ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"
            }`}>
              {isInternalActive ? "ACTIVE" : "INACTIVE"}
            </span>
          );
        }
      }
    ];

    const canRead = hasPermission("branch_master", "read");
    const canUpdate = hasPermission("branch_master", "update");
    const canDelete = hasPermission("branch_master", "delete");

    if (canRead || canUpdate || canDelete) {
      cols.push({
        key: "actions", label: "Actions", sortable: false, minWidth: "200px",
        render: (row) => {
          const isInternalActive = (row.internal_status || "active") === "active";
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

              {/* Internal Active/Inactive Toggle */}
              {canUpdate && (
                <button
                  onClick={() => handleToggleInternalStatus(row)}
                  className={`flex w-8 h-8 items-center justify-center rounded-lg border cursor-pointer transition-colors ${
                    isInternalActive 
                      ? "border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100" 
                      : "border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100"
                  }`}
                  title={isInternalActive ? "Mark Internally Inactive" : "Mark Internally Active"}
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
              {/* Combined Filter Popover (Zones & API Status) */}
              <div className="relative" ref={filterDropdownRef}>
                <button
                  id="branch-filter-button"
                  type="button"
                  onClick={() => setIsFilterDropdownOpen(prev => !prev)}
                  className={`flex items-center gap-2 h-10 px-3.5 rounded-lg border text-sm font-semibold shadow-sm transition-all duration-150 cursor-pointer focus:outline-none ${
                    activeFilterCount > 0 || isFilterDropdownOpen
                      ? "bg-indigo-50 border-indigo-300 text-indigo-700 hover:bg-indigo-100/70"
                      : "bg-white border-slate-300 hover:border-slate-400 text-slate-700"
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4 text-slate-500">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.539.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.378-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" />
                  </svg>
                  <span>Filter</span>
                  {activeFilterCount > 0 && (
                    <span className="bg-indigo-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                      {activeFilterCount}
                    </span>
                  )}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isFilterDropdownOpen ? "rotate-180" : ""}`}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>

                {/* Popover Card */}
                {isFilterDropdownOpen && (
                  <div
                    id="branch-filter-popover"
                    className="absolute left-0 mt-2 w-[500px] bg-white border border-slate-200 rounded-xl shadow-2xl p-4 z-50 grid grid-cols-2 gap-4"
                  >
                    {/* Column 1: Zones */}
                    <div className="flex flex-col border-r border-slate-100 pr-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">Zones</span>
                        <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-semibold">
                          {selectedZones.length === 0 ? "All" : `${selectedZones.length} selected`}
                        </span>
                      </div>

                      {/* Search box */}
                      <div className="px-2 py-1.5 border border-slate-200 rounded-lg flex items-center gap-1.5 mb-2 bg-slate-50">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5 text-slate-400">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                        </svg>
                        <input
                          type="text"
                          placeholder="Search zones..."
                          value={zoneFilterSearch}
                          onChange={(e) => setZoneFilterSearch(e.target.value)}
                          className="w-full text-xs border-none outline-none bg-transparent"
                        />
                      </div>

                      {/* Bulk Actions */}
                      <div className="flex justify-between items-center text-[10px] font-bold text-indigo-600 mb-2 px-1">
                        <button
                          type="button"
                          onClick={() => setSelectedZones(uniqueClass05Values)}
                          className="bg-transparent border-none cursor-pointer hover:underline text-indigo-650 font-semibold"
                        >
                          Select All
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedZones([])}
                          className="bg-transparent border-none cursor-pointer hover:underline text-indigo-655 font-semibold"
                        >
                          Clear (All)
                        </button>
                      </div>

                      {/* Checklist */}
                      <div className="max-h-48 overflow-y-auto px-1 py-1 space-y-0.5 border border-slate-100 rounded-lg">
                        {uniqueClass05Values
                          .filter(name => name.toLowerCase().includes(zoneFilterSearch.toLowerCase()))
                          .map(zoneName => {
                            const isChecked = selectedZones.includes(zoneName);
                            return (
                              <label key={zoneName} className="flex items-center gap-2 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 rounded cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    if (isChecked) {
                                      setSelectedZones(selectedZones.filter(z => z !== zoneName));
                                    } else {
                                      setSelectedZones([...selectedZones, zoneName]);
                                    }
                                  }}
                                  className="accent-indigo-600 h-3.5 w-3.5 flex-shrink-0"
                                />
                                <span className="truncate">{zoneName}</span>
                              </label>
                            );
                          })}
                        {uniqueClass05Values.filter(name => name.toLowerCase().includes(zoneFilterSearch.toLowerCase())).length === 0 && (
                          <div className="text-center py-3 text-xs text-slate-400 italic">No zones found</div>
                        )}
                      </div>
                    </div>

                    {/* Column 2: API Status */}
                    <div className="flex flex-col pl-1">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">API Status</span>
                        <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-semibold">
                          {selectedApiStatuses.length === 0 ? "All" : `${selectedApiStatuses.length} selected`}
                        </span>
                      </div>

                      {/* Bulk Actions */}
                      <div className="flex justify-between items-center text-[10px] font-bold text-indigo-600 mb-2 px-1">
                        <button
                          type="button"
                          onClick={() => setSelectedApiStatuses(["active", "inactive"])}
                          className="bg-transparent border-none cursor-pointer hover:underline text-indigo-650 font-semibold"
                        >
                          Select All
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedApiStatuses([])}
                          className="bg-transparent border-none cursor-pointer hover:underline text-indigo-655 font-semibold"
                        >
                          Clear (All)
                        </button>
                      </div>

                      {/* API Status Checklist */}
                      <div className="max-h-48 overflow-y-auto px-1 py-1 space-y-1.5 border border-slate-100 rounded-lg">
                        {[
                          { value: "active", label: "Active", badgeCls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
                          { value: "inactive", label: "Inactive", badgeCls: "bg-rose-50 text-rose-700 border-rose-200" }
                        ].map(opt => {
                          const isChecked = selectedApiStatuses.includes(opt.value);
                          return (
                            <label key={opt.value} className="flex items-center justify-between px-2.5 py-2 text-xs text-slate-700 hover:bg-slate-50 rounded cursor-pointer select-none border border-slate-100">
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    if (isChecked) {
                                      setSelectedApiStatuses(selectedApiStatuses.filter(s => s !== opt.value));
                                    } else {
                                      setSelectedApiStatuses([...selectedApiStatuses, opt.value]);
                                    }
                                  }}
                                  className="accent-indigo-600 h-3.5 w-3.5 flex-shrink-0"
                                />
                                <span className="font-medium text-slate-800">{opt.label}</span>
                              </div>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold ${opt.badgeCls}`}>
                                {opt.value.toUpperCase()}
                              </span>
                            </label>
                          );
                        })}
                      </div>

                      {/* Footer Actions */}
                      <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedZones([]);
                            setSelectedApiStatuses([]);
                            setZoneFilterSearch("");
                          }}
                          className="text-xs text-slate-500 hover:text-rose-600 font-semibold cursor-pointer bg-transparent border-none"
                        >
                          Reset All
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsFilterDropdownOpen(false)}
                          className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-semibold cursor-pointer border-none transition-colors"
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2.5 mr-4 cursor-pointer select-none" onClick={() => setShowActive(v => !v)} title="Toggle Internal Active/Inactive Filter">
                <span className="text-[12px] text-slate-500 font-medium hidden sm:inline">Internal:</span>
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

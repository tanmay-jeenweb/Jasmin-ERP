import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import { getBranches, updateBranch, deleteBranch, syncBranches } from "../../api/branchApi";
import DataTable from "../../components/DataTable";
import toast from "react-hot-toast";
import { usePermission } from "../../context/PermissionContext";

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
    { label: "Status", value: row.status ? row.status.toUpperCase() : "—", isStatus: true },
    { label: "Address", value: row.address, fullWidth: true },
  ];

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(15,23,42,0.55)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16
    }}>
      <div style={{
        background: "#fff", borderRadius: 18, width: "100%", maxWidth: 750, margin: "0 auto",
        boxShadow: "0 25px 60px rgba(0,0,0,0.2)", overflow: "hidden", display: "flex", flexDirection: "column",
        maxHeight: "90vh"
      }}>
        {/* Modal Header */}
        <div style={{ padding: "20px 28px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", background: "linear-gradient(135deg,#6804a1,#52037e)" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#fff" }}>Branch Details</h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#d9e2ec" }}>Full specifications for {row.name}</p>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8, width: 34, height: 34, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: 18, height: 18 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: "28px", overflowY: "auto", flex: 1, background: "#f8fafc" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
            {fields.map((f, idx) => (
              <div key={idx} style={{ gridColumn: f.fullWidth ? "span 2" : "span 1", background: "#fff", padding: "14px 18px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>{f.label}</span>
                {f.isStatus ? (
                  <p style={{ margin: "4px 0 0" }}>
                    <span style={{
                      display: "inline-flex", alignItems: "center", px: 2.5, py: 0.5, borderRadius: "6px", fontSize: "12px", fontWeight: 700,
                      background: row.status === "active" ? "#d1fae5" : "#fee2e2",
                      color: row.status === "active" ? "#065f46" : "#991b1b",
                      padding: "3px 10px"
                    }}>
                      {f.value}
                    </span>
                  </p>
                ) : (
                  <p style={{ margin: "4px 0 0", fontSize: 14, fontWeight: 600, color: "#1e293b", whiteSpace: "pre-line" }}>{f.value || "—"}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Modal Footer */}
        <div style={{ padding: "16px 28px", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "flex-end", background: "#fafafa" }}>
          <button type="button" onClick={onClose}
            style={{ padding: "9px 24px", borderRadius: 8, border: "1.5px solid #cbd5e1", color: "#475569", background: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
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
        status: nextStatus
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

  const filteredBranches = useMemo(() => {
    return branches.filter(b => b.status === (showActive ? "active" : "inactive"));
  }, [branches, showActive]);

  const columns = useMemo(() => {
    const cols = [
      { key: "id", label: "ID", minWidth: "60px" },
      {
        key: "name", label: "Name",
        render: (row) => <span style={{ fontWeight: 700, color: "#0f172a" }}>{row.name}</span>
      },
      {
        key: "code", label: "Code",
        render: (row) => <span style={{ fontFamily: "monospace", fontWeight: 600, color: "#475569" }}>{row.code}</span>
      },
      {
        key: "city", label: "City",
        render: (row) => <span style={{ color: "#334155" }}>{row.city}</span>
      },
      {
        key: "state_name", label: "State",
        render: (row) => <span style={{ color: "#334155" }}>{row.state_name || "—"}</span>
      },
      {
        key: "phone", label: "Phone",
        render: (row) => <span style={{ color: "#334155" }}>{row.phone}</span>
      },
      {
        key: "store_type", label: "Store Type",
        render: (row) => (
          <span style={{
            fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "5px", textTransform: "capitalize",
            background: row.store_type === "branch" ? "#eff6ff" : "#fef3c7",
            color: row.store_type === "branch" ? "#1e40af" : "#92400e",
            border: row.store_type === "branch" ? "1px solid #bfdbfe" : "1px solid #fde68a"
          }}>
            {row.store_type}
          </span>
        )
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
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {/* View Action */}
              {canRead && (
                <button
                  onClick={() => {
                    setSelectedRow(row);
                    setIsViewModalOpen(true);
                  }}
                  style={{ display: "flex", width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 8, border: "1px solid #cbd5e1", background: "#f8fafc", color: "#475569", cursor: "pointer" }}
                  title="View"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" style={{ width: 16, height: 16 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  </svg>
                </button>
              )}

              {/* Edit Action */}
              {canUpdate && (
                <button
                  onClick={() => {
                    navigate(`/admin/branches/edit/${row.id}`);
                  }}
                  style={{ display: "flex", width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 8, border: "1px solid #d8b4fe", background: "#f3e8ff", color: "#6804a1", cursor: "pointer" }}
                  title="Edit"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" style={{ width: 15, height: 15 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931Z" />
                  </svg>
                </button>
              )}

              {/* Code Action */}
              {canUpdate && (
                <button
                  onClick={() => {
                    navigate(`/admin/branches/code/${row.id}`);
                  }}
                  style={{ display: "flex", width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 8, border: "1px solid #c084fc", background: "#faf5ff", color: "#7c3aed", cursor: "pointer" }}
                  title="Branch Finance Code"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" style={{ width: 15, height: 15 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                  </svg>
                </button>
              )}

              {/* Active/Inactive Toggle */}
              {canUpdate && (
                <button
                  onClick={() => handleToggleStatus(row)}
                  style={{
                    display: "flex", width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 8,
                    border: isActive ? "1px solid #bbf7d0" : "1px solid #fecdd3",
                    background: isActive ? "#f0fdf4" : "#fff1f2",
                    color: isActive ? "#16a34a" : "#e11d48",
                    cursor: "pointer"
                  }}
                  title={isActive ? "Mark Inactive" : "Mark Active"}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" style={{ width: 15, height: 15 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 5.636a9 9 0 1 0 12.728 0M12 3v9" />
                  </svg>
                </button>
              )}

              {/* Delete Action */}
              {canDelete && (
                <button
                  onClick={() => handleDelete(row.id)}
                  style={{ display: "flex", width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 8, border: "1px solid #fecdd3", background: "#fff1f2", color: "#be123c", cursor: "pointer" }}
                  title="Delete"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" style={{ width: 15, height: 15 }}>
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
    <div style={{ display: "flex", flexDirection: "column", flex: 1, background: "#f8fafc", fontFamily: "'Inter',sans-serif" }}>
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

      <main style={{ flex: 1, display: "flex", flexDirection: "column", width: "100%", margin: "0 auto", padding: "32px 30px" }}>
        {error && (
          <div style={{ background: "#fff1f2", border: "1px solid #fecdd3", color: "#be123c", padding: "12px 16px", borderRadius: 10, marginBottom: 20, fontSize: 14, fontWeight: 500 }}>
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
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginRight: "16px", cursor: "pointer", userSelect: "none" }} onClick={() => setShowActive(v => !v)}>
              <span style={{ fontSize: "13px", fontWeight: 700, color: !showActive ? "#ef4444" : "#94a3b8", transition: "color 0.2s" }}>Inactive</span>
              <div
                style={{
                  position: "relative",
                  width: "38px",
                  height: "20px",
                  borderRadius: "9999px",
                  background: showActive ? "#6804a1" : "#cbd5e1",
                  transition: "background-color 0.2s"
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: "2px",
                    left: "2px",
                    width: "16px",
                    height: "16px",
                    backgroundColor: "#fff",
                    borderRadius: "50%",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                    transform: showActive ? "translateX(18px)" : "translateX(0)",
                    transition: "transform 0.2s"
                  }}
                />
              </div>
              <span style={{ fontSize: "13px", fontWeight: 700, color: showActive ? "#10b981" : "#94a3b8", transition: "color 0.2s" }}>Active</span>
            </div>
          }
          actionButton={
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {hasPermission("branch_master", "write") && (
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 20px",
                    borderRadius: 9,
                    background: syncing ? "#94a3b8" : "linear-gradient(135deg,#6804a1,#52037e)",
                    color: "#fff",
                    border: "none",
                    cursor: syncing ? "not-allowed" : "pointer",
                    boxShadow: syncing ? "none" : "0 2px 8px rgba(104,4,161,0.35)",
                    fontWeight: 600,
                    fontSize: 13
                  }}
                  title="Sync Branches from API"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2.5}
                    stroke="currentColor"
                    className={syncing ? "animate-spin" : ""}
                    style={{ width: 16, height: 16 }}
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
                  style={{ display: "flex", width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 9, background: "linear-gradient(135deg,#6804a1,#52037e)", color: "#fff", border: "none", cursor: "pointer", boxShadow: "0 2px 8px rgba(104,4,161,0.35)" }}
                  title="Create Branch"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" style={{ width: 18, height: 18 }}>
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

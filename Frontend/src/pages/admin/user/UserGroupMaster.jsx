import { useEffect, useState, useMemo } from "react";
import Navbar from "../../../components/Navbar";
import { getUserTypes, updateUserType, deleteUserType } from "../../../api/userTypeMasterApi";
import DataTable from "../../../components/DataTable";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { usePermission } from "../../../context/PermissionContext";

// ─── Constants ───────────────────────────────────────────────────────────────
const MASTERS = [
  { key: "user_type", label: "User Type Master" },
  { key: "label_master", label: "Label Master" },
  { key: "inquiry_source_master", label: "Inquiry Source Master" },
  { key: "company_brand_master", label: "Company Brand Master" },
  { key: "document_master", label: "Document Master" },
  { key: "team_role_master", label: "Team Role Master" },
  { key: "call_outcome_master", label: "Call Outcome Master" },
  { key: "mobile_brand_master", label: "Brand Master" },
  { key: "bank_master", label: "Finance Company Master" },
  { key: "finance_machine_master", label: "Finance Machine Master" },
  { key: "store_details_approval", label: "Store Details Approval" },
  { key: "deposit_stock_approval", label: "Deposit & Stock Approval" },
  { key: "user_master", label: "User Master" },
  { key: "device_approval", label: "Device Approval" },
];
const PERMS = ["canRead", "canWrite", "canUpdate", "canDelete"];
const PERM_LABELS = { canRead: "Read", canWrite: "Write / Approval", canUpdate: "Update", canDelete: "Delete" };
const PERM_COLORS = {
  canRead: { bg: "#f3e8ff", border: "#d8b4fe", text: "#6804a1", check: "#6804a1" },
  canWrite: { bg: "#f0fdf4", border: "#bbf7d0", text: "#15803d", check: "#16a34a" },
  canUpdate: { bg: "#fffbeb", border: "#fde68a", text: "#b45309", check: "#d97706" },
  canDelete: { bg: "#fff1f2", border: "#fecdd3", text: "#be123c", check: "#e11d48" },
};

const defaultPerms = () =>
  MASTERS.map((m) => ({ masterName: m.key, canRead: false, canWrite: false, canUpdate: false, canDelete: false }));

const buildPermsFromApi = (apiPerms) => {
  if (!apiPerms || apiPerms.length === 0) return defaultPerms();
  return MASTERS.map((m) => {
    const found = apiPerms.find((p) => p.masterName === m.key);
    const isApprovalRow = m.key.endsWith("_approval");
    if (found) {
      return {
        masterName: m.key,
        canRead: !!found.canRead,
        canWrite: !!found.canWrite,
        canUpdate: isApprovalRow ? false : !!found.canUpdate,
        canDelete: isApprovalRow ? false : !!found.canDelete
      };
    }
    return { masterName: m.key, canRead: false, canWrite: false, canUpdate: false, canDelete: false };
  });
};

// ─── Checkbox Cell ───────────────────────────────────────────────────────────
function CheckCell({ checked, color, onChange }) {
  return (
    <div
      onClick={onChange}
      style={{
        width: 22, height: 22, borderRadius: 6,
        border: `2px solid ${checked ? color.check : "#cbd5e1"}`,
        background: checked ? color.check : "#fff",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", transition: "all 0.15s",
        margin: "0 auto",
        boxShadow: checked ? `0 0 0 3px ${color.bg}` : "none",
      }}
    >
      {checked && (
        <svg viewBox="0 0 12 10" style={{ width: 11, height: 11 }}>
          <polyline points="1,5 4.5,8.5 11,1" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}

// ─── Permissions Badge (inline in list) ──────────────────────────────────────
function PermBadges({ permissions }) {
  if (!permissions || permissions.length === 0)
    return <span style={{ color: "#94a3b8", fontSize: 12 }}>No permissions set</span>;

  // Only show masters that have at least one permission granted
  const rows = MASTERS.map((m) => {
    const p = permissions.find((x) => x.masterName === m.key);
    if (!p) return null;
    const isApprovalRow = m.key.endsWith("_approval");
    const applicablePerms = isApprovalRow ? ["canRead", "canWrite"] : PERMS;
    const granted = applicablePerms.filter((perm) => p[perm]);
    if (granted.length === 0) return null;
    return { label: m.label, granted, isApprovalRow };
  }).filter(Boolean);

  if (rows.length === 0)
    return <span style={{ color: "#94a3b8", fontSize: 12 }}>No access</span>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {rows.map(({ label, granted, isApprovalRow }) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {/* Master label */}
          <span style={{
            fontSize: 11, fontWeight: 700, color: "#475569",
            background: "#f1f5f9", border: "1px solid #e2e8f0",
            borderRadius: 5, padding: "2px 7px", whiteSpace: "nowrap"
          }}>
            {label}
          </span>
          <span style={{ color: "#cbd5e1", fontSize: 11 }}>→</span>
          {/* Permission badges for this master */}
          {granted.map((perm) => {
            const c = PERM_COLORS[perm];
            const labelText = isApprovalRow && perm === "canWrite" ? "Approval" : PERM_LABELS[perm];
            return (
              <span key={perm} style={{
                fontSize: 10, fontWeight: 700, padding: "2px 7px",
                borderRadius: 5, background: c.bg, color: c.text, border: `1px solid ${c.border}`
              }}>
                {labelText}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ─── Edit Modal ──────────────────────────────────────────────────────────────
function EditModal({ row, onClose, onSave, saving }) {
  const [typeName, setTypeName] = useState(row.type_name || "");
  const [permissions, setPermissions] = useState(buildPermsFromApi(row.permissions));

  const togglePerm = (masterKey, perm) =>
    setPermissions((prev) => prev.map((p) => p.masterName === masterKey ? { ...p, [perm]: !p[perm] } : p));

  const toggleRow = (masterKey) => {
    const isApprovalRow = masterKey.endsWith("_approval");
    const r = permissions.find((p) => p.masterName === masterKey);
    const applicablePerms = isApprovalRow ? ["canRead", "canWrite"] : PERMS;
    const all = applicablePerms.every((perm) => r[perm]);
    setPermissions((prev) => prev.map((p) => p.masterName === masterKey
      ? {
          ...p,
          canRead: !all,
          canWrite: !all,
          canUpdate: isApprovalRow ? false : !all,
          canDelete: isApprovalRow ? false : !all
        } : p));
  };

  const toggleColumn = (perm) => {
    const all = permissions.every((p) => p[perm]);
    setPermissions((prev) => prev.map((p) => {
      const isApprovalRow = p.masterName.endsWith("_approval");
      if (isApprovalRow && (perm === "canUpdate" || perm === "canDelete")) {
        return { ...p, [perm]: false };
      }
      return { ...p, [perm]: !all };
    }));
  };

  const toggleAll = () => {
    const all = permissions.every((p) => {
      const isApprovalRow = p.masterName.endsWith("_approval");
      const applicablePerms = isApprovalRow ? ["canRead", "canWrite"] : PERMS;
      return applicablePerms.every((perm) => p[perm]);
    });
    setPermissions((prev) => prev.map((p) => {
      const isApprovalRow = p.masterName.endsWith("_approval");
      return {
        ...p,
        canRead: !all,
        canWrite: !all,
        canUpdate: isApprovalRow ? false : !all,
        canDelete: isApprovalRow ? false : !all
      };
    }));
  };

  const isRowAll = (masterKey) => {
    const isApprovalRow = masterKey.endsWith("_approval");
    const r = permissions.find((p) => p.masterName === masterKey);
    const applicablePerms = isApprovalRow ? ["canRead", "canWrite"] : PERMS;
    return applicablePerms.every((perm) => r[perm]);
  };

  const isColAll = (perm) => permissions.every((p) => {
    const isApprovalRow = p.masterName.endsWith("_approval");
    if (isApprovalRow && (perm === "canUpdate" || perm === "canDelete")) {
      return true;
    }
    return p[perm];
  });

  const isAllAll = () => permissions.every((p) => {
    const isApprovalRow = p.masterName.endsWith("_approval");
    const applicablePerms = isApprovalRow ? ["canRead", "canWrite"] : PERMS;
    return applicablePerms.every((perm) => p[perm]);
  });

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(15,23,42,0.55)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifycontent: "center", padding: 16
    }}>
      <div style={{
        background: "#fff", borderRadius: 18, width: "100%", maxWidth: 1100, margin: "0 auto",
        maxHeight: "92vh", display: "flex", flexDirection: "column",
        boxShadow: "0 25px 60px rgba(0,0,0,0.2)", overflow: "hidden"
      }}>
        {/* Modal Header */}
        <div style={{ padding: "20px 28px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifycontent: "space-between", background: "linear-gradient(135deg,#6804a1,#52037e)" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#fff" }}>Edit User Type</h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#d9e2ec" }}>Update the name and module permissions</p>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8, width: 34, height: 34, cursor: "pointer", display: "flex", alignItems: "center", justifycontent: "center", color: "#fff" }}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: 18, height: 18 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ overflowY: "auto", flex: 1, padding: "24px 28px" }}>

          {/* Name field */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
              User Type Name <span style={{ color: "#e11d48" }}>*</span>
            </label>
            <input
              type="text"
              value={typeName}
              onChange={(e) => setTypeName(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box", border: "1.5px solid #cbd5e1", borderRadius: 9, padding: "11px 14px", fontSize: 15, outline: "none", color: "#1e293b" }}
              onFocus={e => e.target.style.borderColor = "#6804a1"}
              onBlur={e => e.target.style.borderColor = "#cbd5e1"}
            />
          </div>

          {/* Permissions Grid */}
          <div style={{ background: "#f8fafc", borderRadius: 12, padding: 20, border: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", alignItems: "center", justifycontent: "space-between", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#1e293b" }}>Module Permissions</h3>
              <button
                type="button"
                onClick={toggleAll}
                style={{ fontSize: 11, fontWeight: 700, padding: "5px 12px", borderRadius: 7, cursor: "pointer", border: `1.5px solid #6804a1`, color: isAllAll() ? "#fff" : "#6804a1", background: isAllAll() ? "#6804a1" : "#e6ebf0", transition: "all 0.2s" }}
              >
                {isAllAll() ? "Deselect All" : "Select All"}
              </button>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#fff" }}>
                    <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "2px solid #e2e8f0", minWidth: 150 }}>Module</th>
                    {PERMS.map((perm) => {
                      const c = PERM_COLORS[perm];
                      return (
                        <th key={perm} style={{ textAlign: "center", padding: "10px 8px", borderBottom: "2px solid #e2e8f0", minWidth: 80 }}>
                          <button type="button" onClick={() => toggleColumn(perm)} title={`Toggle all ${PERM_LABELS[perm]}`}
                            style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: c.text, background: c.bg, border: `1px solid ${c.border}`, borderRadius: 5, padding: "2px 7px" }}>
                              {PERM_LABELS[perm]}
                            </span>
                            <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${isColAll(perm) ? c.check : "#cbd5e1"}`, background: isColAll(perm) ? c.check : "#fff", display: "flex", alignItems: "center", justifycontent: "center", transition: "all 0.15s" }}>
                              {isColAll(perm) && <svg viewBox="0 0 12 10" style={{ width: 9, height: 9 }}><polyline points="1,5 4.5,8.5 11,1" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                            </div>
                          </button>
                        </th>
                      );
                    })}
                    <th style={{ textAlign: "center", padding: "10px 8px", borderBottom: "2px solid #e2e8f0", minWidth: 70, fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>All</th>
                  </tr>
                </thead>
                <tbody>
                  {MASTERS.map((master, idx) => {
                    const rowData = permissions.find((p) => p.masterName === master.key);
                    const rowAll = isRowAll(master.key);
                    const isApprovalRow = master.key.endsWith("_approval");
                    return (
                      <tr key={master.key} style={{ background: idx % 2 === 0 ? "#fff" : "#f8fafc" }}
                        onMouseEnter={e => e.currentTarget.style.background = "#f1f5f9"}
                        onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? "#fff" : "#f8fafc"}>
                        <td style={{ padding: "11px 12px", fontSize: 13, fontWeight: 600, color: "#334155", borderBottom: "1px solid #f1f5f9" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#6804a1" }} />
                            {master.label}
                          </div>
                        </td>
                        {PERMS.map((perm) => {
                          if (isApprovalRow && (perm === "canUpdate" || perm === "canDelete")) {
                            return (
                              <td key={perm} style={{ textAlign: "center", padding: "11px 8px", borderBottom: "1px solid #f1f5f9", color: "#94a3b8" }}>
                                —
                              </td>
                            );
                          }
                          return (
                            <td key={perm} style={{ textAlign: "center", padding: "11px 8px", borderBottom: "1px solid #f1f5f9" }}>
                              <CheckCell checked={rowData[perm]} color={PERM_COLORS[perm]} onChange={() => togglePerm(master.key, perm)} />
                            </td>
                          );
                        })}
                        <td style={{ textAlign: "center", padding: "11px 8px", borderBottom: "1px solid #f1f5f9" }}>
                          <button type="button" onClick={() => toggleRow(master.key)}
                            style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 5, cursor: "pointer", border: `1.5px solid ${rowAll ? "#6804a1" : "#cbd5e1"}`, color: rowAll ? "#fff" : "#64748b", background: rowAll ? "#6804a1" : "#f8fafc", transition: "all 0.15s" }}>
                            {rowAll ? "✓" : "All"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div style={{ padding: "16px 28px", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "flex-end", gap: 12, background: "#fafafa" }}>
          <button onClick={onClose} disabled={saving}
            style={{ padding: "9px 20px", borderRadius: 8, border: "1.5px solid #cbd5e1", color: "#475569", background: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            Cancel
          </button>
          <button
            onClick={() => onSave(row.id, typeName, permissions)}
            disabled={saving || !typeName.trim()}
            style={{ padding: "9px 24px", borderRadius: 8, border: "none", background: saving ? "#94a3b8" : "linear-gradient(135deg,#6804a1,#52037e)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: saving ? "not-allowed" : "pointer", boxShadow: saving ? "none" : "0 2px 8px rgba(104,4,161,0.35)" }}>
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function UserGroupMaster() {
  const navigate = useNavigate();
  const [userTypes, setUserTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingRow, setEditingRow] = useState(null);

  const loadUserTypes = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await getUserTypes();
      setUserTypes(response.data.data || []);
    } catch (err) {
      console.error("Failed to load user types", err);
      setError("Unable to load user types. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUserTypes(); }, []);

  const handleSave = async (id, typeName, permissions) => {
    if (!typeName.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    try {
      await updateUserType(id, { typeName: typeName.trim(), permissions });
      toast.success("User type updated successfully");
      setEditingRow(null);
      await loadUserTypes();
    } catch (err) {
      console.error("Failed to update user type", err);
      toast.error(err?.response?.data?.message || "Unable to update user type.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this user type?")) return;
    setSaving(true);
    try {
      await deleteUserType(id);
      toast.success("User type deleted successfully");
      await loadUserTypes();
    } catch (err) {
      console.error("Failed to delete user type", err);
      toast.error(err?.response?.data?.message || "Unable to delete user type.");
    } finally {
      setSaving(false);
    }
  };

  const { hasPermission } = usePermission();

  const columns = useMemo(() => {
    const cols = [
      { key: "id", label: "ID", minWidth: "60px" },
      {
        key: "type_name", label: "User Type",
        render: (row) => <span style={{ fontWeight: 700 }}>{row.type_name}</span>
      },
      {
        key: "permissions", label: "Permissions",
        sortable: false,
        render: (row) => <PermBadges permissions={row.permissions} />
      }
      // {
      //   key: "created_at", label: "Added Date",
      //   render: (row) => new Date(row.created_at).toLocaleDateString()
      // },
      // {
      //   key: "added_by_name", label: "Added By",
      //   render: (row) => row.added_by_name || "Unknown"
      // },
      // {
      //   key: "device_id", label: "Device ID",
      //   render: (row) => <span style={{ fontFamily: "monospace", color: "#64748b", fontSize: "12px" }}>{row.device_id || "—"}</span>
      // }
    ];

    const canUpdate = hasPermission("user_type", "update");
    const canDelete = hasPermission("user_type", "delete");

    if (canUpdate || canDelete) {
      cols.push({
        key: "actions", label: "Actions", sortable: false, minWidth: "120px",
        render: (row) => (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {canUpdate && (
              <button
                onClick={() => setEditingRow(row)}
                style={{ display: "flex", width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 8, border: "1px solid #d8b4fe", background: "#f3e8ff", color: "#6804a1", cursor: "pointer" }}
                title="Edit"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" style={{ width: 15, height: 15 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931Z" />
                </svg>
              </button>
            )}
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
        )
      });
    }

    return cols;
  }, [saving, hasPermission]);

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, background: "#f8fafc", fontFamily: "'Inter',sans-serif" }}>
      <Navbar title="ERP Admin" />

      {editingRow && (
        <EditModal
          row={editingRow}
          onClose={() => setEditingRow(null)}
          onSave={handleSave}
          saving={saving}
        />
      )}

      <main style={{ flex: 1, display: "flex", flexDirection: "column", width: "100%", margin: "0 auto", padding: "32px 30px" }}>
        {error && (
          <div style={{ background: "#fff1f2", border: "1px solid #fecdd3", color: "#be123c", padding: "12px 16px", borderRadius: 10, marginBottom: 20, fontSize: 14, fontWeight: 500 }}>
            {error}
          </div>
        )}
        <DataTable
          tableId="user_group_master"
          title="User Type Master"
          data={userTypes}
          columns={columns}
          loading={loading}
          searchPlaceholder="Search user types..."
          actionButton={
            hasPermission("user_type", "write") ? (
              <button
                onClick={() => navigate("/admin/user-types/create")}
                style={{ display: "flex", width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 9, background: "linear-gradient(135deg,#6804a1,#52037e)", color: "#fff", border: "none", cursor: "pointer", boxShadow: "0 2px 8px rgba(104,4,161,0.35)" }}
                title="Create User Type"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" style={{ width: 18, height: 18 }}>
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


import { useState } from "react";
import Navbar from "../../../components/Navbar";
import { createUserType } from "../../../api/userTypeMasterApi";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

const MASTERS = [
  { key: "user_type",             label: "User Type Master" },
  { key: "label_master",          label: "Label Master" },
  { key: "inquiry_source_master", label: "Inquiry Source Master" },
  { key: "company_brand_master",  label: "Company Brand Master" },
  { key: "document_master",       label: "Document Master" },
  { key: "team_role_master",      label: "Team Role Master" },
  { key: "call_outcome_master",   label: "Call Outcome Master" },
  { key: "mobile_brand_master",   label: "Brand Master" },
  { key: "bank_master",           label: "Finance Company Master" },
  { key: "finance_machine_master", label: "Finance Machine Master" },
  { key: "store_details_approval", label: "Store Details Approval" },
  { key: "deposit_stock_approval", label: "Deposit & Stock Approval" },
  { key: "user_master",             label: "User Master" },
  { key: "device_approval",         label: "Device Approval" },
];

const PERMS = ["canRead", "canWrite", "canUpdate", "canDelete"];
const PERM_LABELS = { canRead: "Read", canWrite: "Write / Approval", canUpdate: "Update", canDelete: "Delete" };
const PERM_COLORS = {
  canRead:   { bg: "#f3e8ff", border: "#d8b4fe", text: "#6804a1", check: "#6804a1" },
  canWrite:  { bg: "#f0fdf4", border: "#bbf7d0", text: "#15803d", check: "#16a34a" },
  canUpdate: { bg: "#fffbeb", border: "#fde68a", text: "#b45309", check: "#d97706" },
  canDelete: { bg: "#fff1f2", border: "#fecdd3", text: "#be123c", check: "#e11d48" },
};

const defaultPerms = () =>
  MASTERS.map((m) => ({
    masterName: m.key,
    canRead: false,
    canWrite: false,
    canUpdate: false,
    canDelete: false,
  }));

export default function CreateUserType() {
  const [newTypeName, setNewTypeName] = useState("");
  const [permissions, setPermissions] = useState(defaultPerms());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // Toggle a single checkbox
  const togglePerm = (masterKey, perm) => {
    setPermissions((prev) =>
      prev.map((p) =>
        p.masterName === masterKey ? { ...p, [perm]: !p[perm] } : p
      )
    );
  };

  // Toggle entire row (all perms for one master)
  const toggleRow = (masterKey) => {
    const isApprovalRow = masterKey.endsWith("_approval");
    const row = permissions.find((p) => p.masterName === masterKey);
    const applicablePerms = isApprovalRow ? ["canRead", "canWrite"] : PERMS;
    const allChecked = applicablePerms.every((perm) => row[perm]);
    setPermissions((prev) =>
      prev.map((p) =>
        p.masterName === masterKey
          ? {
              ...p,
              canRead: !allChecked,
              canWrite: !allChecked,
              canUpdate: isApprovalRow ? false : !allChecked,
              canDelete: isApprovalRow ? false : !allChecked,
            }
          : p
      )
    );
  };

  // Toggle entire column (one perm across all masters)
  const toggleColumn = (perm) => {
    const allChecked = permissions.every((p) => p[perm]);
    setPermissions((prev) => prev.map((p) => {
      const isApprovalRow = p.masterName.endsWith("_approval");
      if (isApprovalRow && (perm === "canUpdate" || perm === "canDelete")) {
        return { ...p, [perm]: false };
      }
      return { ...p, [perm]: !allChecked };
    }));
  };

  // Select / deselect all
  const toggleAll = () => {
    const allChecked = permissions.every((p) => {
      const isApprovalRow = p.masterName.endsWith("_approval");
      const applicablePerms = isApprovalRow ? ["canRead", "canWrite"] : PERMS;
      return applicablePerms.every((perm) => p[perm]);
    });
    setPermissions((prev) =>
      prev.map((p) => {
        const isApprovalRow = p.masterName.endsWith("_approval");
        return {
          ...p,
          canRead: !allChecked,
          canWrite: !allChecked,
          canUpdate: isApprovalRow ? false : !allChecked,
          canDelete: isApprovalRow ? false : !allChecked,
        };
      })
    );
  };

  const isRowAll = (masterKey) => {
    const isApprovalRow = masterKey.endsWith("_approval");
    const row = permissions.find((p) => p.masterName === masterKey);
    const applicablePerms = isApprovalRow ? ["canRead", "canWrite"] : PERMS;
    return applicablePerms.every((perm) => row[perm]);
  };

  const isColAll = (perm) => permissions.every((p) => {
    const isApprovalRow = p.masterName.endsWith("_approval");
    if (isApprovalRow && (perm === "canUpdate" || perm === "canDelete")) {
      return true; // treat as matched so it doesn't block "all"
    }
    return p[perm];
  });
  
  const isAllAll = () => permissions.every((p) => {
    const isApprovalRow = p.masterName.endsWith("_approval");
    const applicablePerms = isApprovalRow ? ["canRead", "canWrite"] : PERMS;
    return applicablePerms.every((perm) => p[perm]);
  });

  const handleAddType = async (event) => {
    event.preventDefault();
    if (!newTypeName.trim()) {
      setError("Enter a valid user type name.");
      return;
    }
    setSaving(true);
    setError("");
    // setMessage("");
    try {
      await createUserType({ typeName: newTypeName.trim(), permissions });
      toast.success(`User type '${newTypeName.trim()}' added successfully.`);
      setNewTypeName("");
      setPermissions(defaultPerms());
      setTimeout(() => navigate("/admin/user-types"), 1200);
    } catch (err) {
      console.error("Failed to add user type", err);
      toast.error(err?.response?.data?.message || "Unable to add user type. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, background: "linear-gradient(135deg,#f8fafc 0%,#eef2ff 100%)", fontFamily: "'Inter',sans-serif" }}>
      <Navbar title="ERP Admin" />

      <main className="flex-1 flex flex-col w-full max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1e293b", margin: 0 }}>Create User Type</h1>
            <p style={{ color: "#64748b", marginTop: 4, fontSize: 14 }}>Define a new user group and set its module permissions.</p>
          </div>
          <button
            onClick={() => navigate("/admin/user-types")}
            style={{ display: "flex", alignItems: "center", gap: 6, color: "#64748b", background: "none", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 500 }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: 16, height: 16 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back to User Types
          </button>
        </div>

        {/* Alerts */}
        {/* {message && (
          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#15803d", padding: "12px 16px", borderRadius: 10, marginBottom: 20, fontSize: 14, fontWeight: 500 }}>
            ✓ {message}
          </div>
        )} */}
        {/* {error && (
          <div style={{ background: "#fff1f2", border: "1px solid #fecdd3", color: "#be123c", padding: "12px 16px", borderRadius: 10, marginBottom: 20, fontSize: 14, fontWeight: 500 }}>
            ✕ {error}
          </div>
        )} */}

        <form onSubmit={handleAddType}>
          {/* Type Name Card */}
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "24px", marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              User Type Name <span style={{ color: "#e11d48" }}>*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Supervisor, Technician, Manager"
              value={newTypeName}
              onChange={(e) => setNewTypeName(e.target.value)}
              required
              style={{
                width: "100%", boxSizing: "border-box", border: "1.5px solid #cbd5e1", borderRadius: 9,
                padding: "11px 14px", fontSize: 15, outline: "none", color: "#1e293b",
                transition: "border 0.2s",
              }}
              onFocus={e => e.target.style.borderColor = "#6804a1"}
              onBlur={e => e.target.style.borderColor = "#cbd5e1"}
            />
          </div>

          {/* Permissions Card */}
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "24px", marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: "#1e293b", margin: 0 }}>Module Permissions</h2>
                <p style={{ fontSize: 13, color: "#94a3b8", margin: "4px 0 0" }}>Set read, write, update and delete access per master module.</p>
              </div>
              <button
                type="button"
                onClick={toggleAll}
                style={{
                  fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 8, cursor: "pointer",
                  border: "1.5px solid #6804a1", color: isAllAll() ? "#fff" : "#6804a1",
                  background: isAllAll() ? "#6804a1" : "#e6ebf0", transition: "all 0.2s"
                }}
              >
                {isAllAll() ? "Deselect All" : "Select All"}
              </button>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 500 }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    <th style={{ textAlign: "left", padding: "10px 14px", fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "2px solid #e2e8f0", minWidth: 160 }}>
                      Master Module
                    </th>
                    {PERMS.map((perm) => {
                      const c = PERM_COLORS[perm];
                      return (
                        <th key={perm} style={{ textAlign: "center", padding: "10px 8px", borderBottom: "2px solid #e2e8f0", minWidth: 90 }}>
                          <button
                            type="button"
                            onClick={() => toggleColumn(perm)}
                            title={`Toggle all ${PERM_LABELS[perm]}`}
                            style={{
                              display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 4,
                              background: "none", border: "none", cursor: "pointer", padding: 4
                            }}
                          >
                            <span style={{
                              fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
                              color: c.text, background: c.bg, border: `1px solid ${c.border}`,
                              borderRadius: 6, padding: "3px 8px"
                            }}>
                              {PERM_LABELS[perm]}
                            </span>
                            <div style={{
                              width: 18, height: 18, borderRadius: 5, border: `2px solid ${isColAll(perm) ? c.check : "#cbd5e1"}`,
                              background: isColAll(perm) ? c.check : "#fff",
                              display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s"
                            }}>
                              {isColAll(perm) && (
                                <svg viewBox="0 0 12 10" style={{ width: 10, height: 10 }}>
                                  <polyline points="1,5 4.5,8.5 11,1" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </div>
                          </button>
                        </th>
                      );
                    })}
                    <th style={{ textAlign: "center", padding: "10px 8px", borderBottom: "2px solid #e2e8f0", minWidth: 80, fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      All
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {MASTERS.map((master, idx) => {
                    const row = permissions.find((p) => p.masterName === master.key);
                    const rowAll = isRowAll(master.key);
                    return (
                      <tr
                        key={master.key}
                        style={{ background: idx % 2 === 0 ? "#fff" : "#fafafa", transition: "background 0.15s" }}
                        onMouseEnter={e => e.currentTarget.style.background = "#f1f5f9"}
                        onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? "#fff" : "#fafafa"}
                      >
                        <td style={{ padding: "12px 14px", fontSize: 14, fontWeight: 600, color: "#334155", borderBottom: "1px solid #f1f5f9" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#6804a1", flexShrink: 0 }} />
                            {master.label}
                          </div>
                        </td>
                        {PERMS.map((perm) => {
                          const c = PERM_COLORS[perm];
                          const checked = row[perm];
                          const isApprovalRow = master.key.endsWith("_approval");

                          if (isApprovalRow && (perm === "canUpdate" || perm === "canDelete")) {
                            return (
                              <td key={perm} style={{ textAlign: "center", padding: "12px 8px", borderBottom: "1px solid #f1f5f9", color: "#94a3b8" }}>
                                —
                              </td>
                            );
                          }

                          return (
                            <td key={perm} style={{ textAlign: "center", padding: "12px 8px", borderBottom: "1px solid #f1f5f9" }}>
                              <div
                                onClick={() => togglePerm(master.key, perm)}
                                style={{
                                  width: 22, height: 22, borderRadius: 6,
                                  border: `2px solid ${checked ? c.check : "#cbd5e1"}`,
                                  background: checked ? c.check : "#fff",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  cursor: "pointer", transition: "all 0.15s",
                                  margin: "0 auto",
                                  boxShadow: checked ? `0 0 0 3px ${c.bg}` : "none"
                                }}
                              >
                                {checked && (
                                  <svg viewBox="0 0 12 10" style={{ width: 11, height: 11 }}>
                                    <polyline points="1,5 4.5,8.5 11,1" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                )}
                              </div>
                            </td>
                          );
                        })}
                        {/* Row toggle */}
                        <td style={{ textAlign: "center", padding: "12px 8px", borderBottom: "1px solid #f1f5f9" }}>
                          <button
                            type="button"
                            onClick={() => toggleRow(master.key)}
                            style={{
                              fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 6, cursor: "pointer",
                              border: `1.5px solid ${rowAll ? "#6804a1" : "#cbd5e1"}`,
                              color: rowAll ? "#fff" : "#64748b",
                              background: rowAll ? "#6804a1" : "#f8fafc",
                              transition: "all 0.15s"
                            }}
                          >
                            {rowAll ? "✓ All" : "All"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Legend */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16, paddingTop: 14, borderTop: "1px solid #f1f5f9" }}>
              {PERMS.map((perm) => {
                const c = PERM_COLORS[perm];
                return (
                  <div key={perm} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: c.check }} />
                    <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>{PERM_LABELS[perm]}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
            <button
              type="button"
              onClick={() => navigate("/admin/user-types")}
              style={{
                padding: "10px 22px", borderRadius: 9, border: "1.5px solid #cbd5e1",
                color: "#475569", background: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer",
                transition: "background 0.15s"
              }}
              onMouseEnter={e => e.target.style.background = "#f8fafc"}
              onMouseLeave={e => e.target.style.background = "#fff"}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: "10px 28px", borderRadius: 9, border: "none",
                background: saving ? "#94a3b8" : "linear-gradient(135deg,#6804a1,#52037e)",
                color: "#fff", fontWeight: 700, fontSize: 14, cursor: saving ? "not-allowed" : "pointer",
                boxShadow: saving ? "none" : "0 2px 8px rgba(104,4,161,0.35)",
                transition: "all 0.2s"
              }}
            >
              {saving ? "Saving…" : "Create User Type"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}


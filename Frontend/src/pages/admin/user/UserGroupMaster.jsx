import { useEffect, useState, useMemo } from "react";
import Navbar from "../../../components/Navbar";
import { getUserTypes, updateUserType, deleteUserType } from "../../../api/userTypeMasterApi";
import DataTable from "../../../components/DataTable";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { usePermission } from "../../../context/PermissionContext";

// ─── Constants ───────────────────────────────────────────────────────────────
const MASTER_GROUPS = [
  {
    category: "👥 User & Access Management",
    masters: [
      { key: "user_type", label: "User Type Master" },
      { key: "user_master", label: "User Master" },
      { key: "user_branch_mapping", label: "User Branch Mapping", note: "Write = Branch Access Mapping" },
      { key: "device_approval", label: "Device Approval" },
    ]
  },
  {
    category: "🏢 Organization & Locations",
    masters: [
      { key: "branch_master", label: "Branch Master" },
      { key: "state_master", label: "State Master" },
    ]
  },
  {
    category: "📦 Products & Catalog",
    masters: [
      { key: "mobile_brand_master", label: "Brand Master" },
      { key: "product_type_master", label: "Product Type Master" },
      { key: "item_model_master", label: "Model Master" },
      { key: "model_group_master", label: "Model Group Master" },
    ]
  },
  {
    category: "💳 Finance & Pricing",
    masters: [
      { key: "bank_master", label: "Finance Company Master" },
      { key: "finance_machine_master", label: "Finance Machine Master" },
      { key: "variation_master", label: "Pricing Formula Master", note: "Write = Price List Import/Export" },
      { key: "landing_type_master", label: "Landing Type Master" },
    ]
  },
  {
    category: "📊 Reports & Analytics",
    masters: [
      { key: "target_vs_achievement", label: "Target vs Achievement", note: "Write = Import/Export Template & Sync" },
      { key: "stock_vs_cash_deposit", label: "Stock vs Cash Deposit", note: "Write = Import/Export Template" },
    ]
  },
  {
    category: "⚙️ System Operations & Support",
    masters: [
      { key: "support_master", label: "Support Master" },
      { key: "alert_master", label: "Alert Master" },
    ]
  }
];

const MASTERS = MASTER_GROUPS.flatMap((g) => g.masters);
const PERMS = ["canRead", "canWrite", "canUpdate", "canDelete"];
const PERM_LABELS = { canRead: "Read", canWrite: "Write / Import / Approval", canUpdate: "Update", canDelete: "Delete" };

const PERM_CLASSES = {
  canRead: "bg-purple-50 text-indigo-650 border-purple-200",
  canWrite: "bg-green-50 text-green-700 border-green-200",
  canUpdate: "bg-amber-50 text-amber-800 border-amber-200",
  canDelete: "bg-rose-50 text-rose-700 border-rose-200"
};

const PERM_CHECKBOX_CLASSES = {
  canRead: "border-indigo-600 bg-indigo-600",
  canWrite: "border-green-600 bg-green-600",
  canUpdate: "border-amber-600 bg-amber-600",
  canDelete: "border-rose-600 bg-rose-600"
};

const PERM_CHECKBOX_RING_CLASSES = {
  canRead: "ring-purple-100 border-indigo-600 bg-indigo-600",
  canWrite: "ring-green-100 border-green-600 bg-green-600",
  canUpdate: "ring-amber-100 border-amber-600 bg-amber-600",
  canDelete: "ring-rose-100 border-rose-600 bg-rose-600"
};

const buildPermsFromApi = (apiPerms) => {
  if (!apiPerms || apiPerms.length === 0) return MASTERS.map((m) => ({ masterName: m.key, canRead: false, canWrite: false, canUpdate: false, canDelete: false }));
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
function CheckCell({ checked, perm, onChange }) {
  return (
    <div
      onClick={onChange}
      className={`w-5.5 h-5.5 rounded-md border flex items-center justify-center cursor-pointer transition-all mx-auto ${checked ? `ring-4 ${PERM_CHECKBOX_RING_CLASSES[perm]}` : "border-slate-300 bg-white"}`}
    >
      {checked && (
        <svg viewBox="0 0 12 10" className="w-[11px] h-[11px]">
          <polyline points="1,5 4.5,8.5 11,1" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}

// ─── Permissions Badge (inline in list) ──────────────────────────────────────
function PermBadges({ permissions }) {
  if (!permissions || permissions.length === 0)
    return <span className="text-slate-400 text-xs">No permissions set</span>;

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
    return <span className="text-slate-400 text-xs">No access</span>;

  return (
    <div className="flex flex-col gap-1.25">
      {rows.map(({ label, granted, isApprovalRow }) => (
        <div key={label} className="flex items-center gap-1.5 flex-wrap">
          {/* Master label */}
          <span className="text-[11px] font-bold text-slate-600 bg-slate-100 border border-slate-200 rounded-[5px] px-1.75 py-0.5 whitespace-nowrap">
            {label}
          </span>
          <span className="text-slate-300 text-[11px]">→</span>
          {/* Permission badges for this master */}
          {granted.map((perm) => {
            const labelText = isApprovalRow && perm === "canWrite" ? "Approval" : PERM_LABELS[perm];
            return (
              <span key={perm} className={`text-[10px] font-bold px-1.75 py-0.5 rounded-[5px] border ${PERM_CLASSES[perm]}`}>
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
  const [userRole, setUserRole] = useState(row.user_role || "VIEWER");
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

  const toggleGroup = (groupMasters) => {
    const keys = groupMasters.map((m) => m.key);
    const allChecked = keys.every((key) => {
      const isApprovalRow = key.endsWith("_approval");
      const applicablePerms = isApprovalRow ? ["canRead", "canWrite"] : PERMS;
      const row = permissions.find((p) => p.masterName === key);
      return row && applicablePerms.every((perm) => row[perm]);
    });

    setPermissions((prev) =>
      prev.map((p) => {
        if (!keys.includes(p.masterName)) return p;
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
    <div className="fixed inset-0 z-[1000] bg-slate-900/55 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-[18px] w-full max-w-[1100px] mx-auto max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-7 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-br from-indigo-600 to-indigo-700">
          <div>
            <h2 className="m-0 text-lg font-bold text-white">Edit User Type</h2>
            <p className="mt-1 text-[13px] text-indigo-100">Update the name and module permissions</p>
          </div>
          <button onClick={onClose} className="bg-white/15 border-none rounded-lg w-[34px] h-[34px] cursor-pointer flex items-center justify-center text-white hover:bg-white/20 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-[18px] h-[18px]">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto flex-1 px-7 py-6">

          {/* Name & Role fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                User Type Name <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                value={typeName}
                onChange={(e) => setTypeName(e.target.value)}
                className="w-full border-[1.5px] border-slate-350 rounded-[9px] px-3.5 py-[11px] text-[15px] outline-none text-slate-805 bg-white focus:border-indigo-650 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                User Role <span className="text-rose-600">*</span>
              </label>
              <div className="relative">
                <select
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value)}
                  required
                  className="w-full border-[1.5px] border-slate-350 rounded-[9px] px-3.5 py-[11px] text-[15px] outline-none text-slate-805 bg-white focus:border-indigo-650 transition-colors appearance-none cursor-pointer"
                >
                  <option value="VIEWER">VIEWER</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="ABM">ABM</option>
                  <option value="MANAGER">MANAGER</option>
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Permissions Grid */}
          <div className="bg-slate-50/50 rounded-xl p-5 border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="m-0 text-sm font-bold text-slate-800">Module Permissions</h3>
              <button
                type="button"
                onClick={toggleAll}
                className={`text-[11px] font-bold px-3 py-1.25 rounded-md cursor-pointer border-[1.5px] border-indigo-600 transition-colors ${isAllAll() ? "bg-indigo-600 text-white" : "bg-purple-50 text-indigo-600 hover:bg-purple-100"}`}
              >
                {isAllAll() ? "Deselect All" : "Select All"}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-white">
                    <th className="text-left px-3 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 min-w-[150px]">Module</th>
                    {PERMS.map((perm) => (
                      <th key={perm} className="text-center px-2 py-2.5 border-b-2 border-slate-200 min-w-[80px]">
                        <button type="button" onClick={() => toggleColumn(perm)} title={`Toggle all ${PERM_LABELS[perm]}`}
                          className="inline-flex flex-col items-center gap-1 bg-transparent border-none cursor-pointer p-1">
                          <span className={`text-[10px] font-bold uppercase tracking-wider rounded-[5px] px-1.75 py-0.5 border ${PERM_CLASSES[perm]}`}>
                            {PERM_LABELS[perm]}
                          </span>
                          <div className={`w-4 h-4 rounded-[4px] border flex items-center justify-center transition-all ${isColAll(perm) ? PERM_CHECKBOX_CLASSES[perm] : "border-slate-300 bg-white"}`}>
                            {isColAll(perm) && <svg viewBox="0 0 12 10" className="w-2.25 h-2.25"><polyline points="1,5 4.5,8.5 11,1" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                          </div>
                        </button>
                      </th>
                    ))}
                    <th className="text-center px-2 py-2.5 border-b-2 border-slate-200 min-w-[70px] text-[10px] font-bold text-slate-400 uppercase tracking-wider">All</th>
                  </tr>
                </thead>
                <tbody>
                  {MASTER_GROUPS.map((group) => {
                    const groupAll = group.masters.every((m) => isRowAll(m.key));
                    return (
                      <tbody key={group.category} className="contents">
                        {/* Section Header */}
                        <tr className="bg-gradient-to-r from-slate-100 via-indigo-50/60 to-purple-50/60 border-y border-indigo-100/80">
                          <td colSpan={6} className="px-3 py-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-extrabold text-indigo-950 uppercase tracking-wide">
                                  {group.category}
                                </span>
                                <span className="text-[10px] font-semibold text-slate-500 bg-white/80 px-1.75 py-0.25 rounded-full border border-slate-200">
                                  {group.masters.length} {group.masters.length === 1 ? 'module' : 'modules'}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => toggleGroup(group.masters)}
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-[5px] cursor-pointer border transition-all ${
                                  groupAll
                                    ? "border-indigo-600 bg-indigo-600 text-white"
                                    : "border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-100"
                                }`}
                              >
                                {groupAll ? "✓ Group All" : "Select Group"}
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Section Items */}
                        {group.masters.map((master, idx) => {
                          const rowData = permissions.find((p) => p.masterName === master.key);
                          const rowAll = isRowAll(master.key);
                          const isApprovalRow = master.key.endsWith("_approval");
                          return (
                            <tr key={master.key} className={`transition-colors border-b border-slate-100 last:border-b-0 hover:bg-slate-50/80 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"}`}>
                              <td className="px-3 py-2.5 text-[13px] font-semibold text-slate-700 pl-6">
                                <div className="flex flex-col gap-0.5">
                                  <div className="flex items-center gap-1.75">
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 flex-shrink-0" />
                                    <span>{master.label}</span>
                                  </div>
                                  {master.note && (
                                    <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50/80 px-1.5 py-0.25 rounded border border-indigo-200/60 w-max ml-3">
                                      {master.note}
                                    </span>
                                  )}
                                </div>
                              </td>
                              {PERMS.map((perm) => {
                                if (isApprovalRow && (perm === "canUpdate" || perm === "canDelete")) {
                                  return (
                                    <td key={perm} className="text-center px-2 py-2.5 text-slate-400">
                                      —
                                    </td>
                                  );
                                }
                                return (
                                  <td key={perm} className="text-center px-2 py-2.5">
                                    <CheckCell checked={rowData[perm]} perm={perm} onChange={() => togglePerm(master.key, perm)} />
                                  </td>
                                );
                              })}
                              <td className="text-center px-2 py-2.5">
                                <button type="button" onClick={() => toggleRow(master.key)}
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-[5px] cursor-pointer border-[1.5px] transition-all ${rowAll ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 bg-slate-50 text-slate-500 hover:bg-slate-100"}`}>
                                  {rowAll ? "✓" : "All"}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-7 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
          <button onClick={onClose} disabled={saving}
            className="px-5 py-2.25 rounded-lg border-[1.5px] border-slate-300 text-slate-600 bg-white font-semibold text-[13px] cursor-pointer hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => onSave(row.id, typeName, userRole, permissions)}
            disabled={saving || !typeName.trim()}
            className="px-6 py-2.25 rounded-lg border-none text-white font-bold text-[13px] bg-gradient-to-br from-indigo-600 to-indigo-700 shadow-[0_2px_8px_rgba(104,4,161,0.35)] cursor-pointer disabled:bg-slate-400 disabled:cursor-not-allowed disabled:shadow-none hover:opacity-95 transition-all">
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

  const handleSave = async (id, typeName, userRole, permissions) => {
    if (!typeName.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    try {
      await updateUserType(id, { typeName: typeName.trim(), userRole, permissions });
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
        render: (row) => <span className="font-bold text-slate-800">{row.type_name}</span>
      },
      {
        key: "user_role", label: "User Role",
        render: (row) => (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${row.user_role === 'ADMIN' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
              row.user_role === 'ABM' ? 'bg-teal-50 text-teal-700 border-teal-200' :
                row.user_role === 'MANAGER' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                  'bg-slate-50 text-slate-700 border-slate-200'
            }`}>
            {row.user_role || 'VIEWER'}
          </span>
        )
      },
      {
        key: "permissions", label: "Permissions",
        sortable: false,
        render: (row) => <PermBadges permissions={row.permissions} />
      }
    ];

    const canUpdate = hasPermission("user_type", "update");
    const canDelete = hasPermission("user_type", "delete");

    if (canUpdate || canDelete) {
      cols.push({
        key: "actions", label: "Actions", sortable: false, minWidth: "120px",
        render: (row) => (
          <div className="flex items-center gap-2">
            {canUpdate && (
              <button
                onClick={() => setEditingRow(row)}
                className="flex w-8 h-8 items-center justify-center rounded-lg border border-purple-200 bg-purple-50 text-indigo-650 cursor-pointer hover:bg-purple-100 transition-colors"
                title="Edit"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-[15px] h-[15px]">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931Z" />
                </svg>
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => handleDelete(row.id)}
                className="flex w-8 h-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 cursor-pointer hover:bg-rose-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Delete"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-[15px] h-[15px]">
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
    <div className="flex flex-col flex-1 bg-slate-50 font-sans">
      <Navbar title="ERP Admin" />

      {editingRow && (
        <EditModal
          row={editingRow}
          onClose={() => setEditingRow(null)}
          onSave={handleSave}
          saving={saving}
        />
      )}

      <main className="flex-1 flex flex-col w-full mx-auto px-[30px] py-8">
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg mb-5 text-sm font-medium">
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
                className="flex w-10 h-10 items-center justify-center rounded-[9px] bg-gradient-to-br from-indigo-650 to-indigo-755 text-white border-none cursor-pointer shadow-[0_2px_8px_rgba(104,4,161,0.35)] hover:opacity-95 transition-opacity"
                title="Create User Type"
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

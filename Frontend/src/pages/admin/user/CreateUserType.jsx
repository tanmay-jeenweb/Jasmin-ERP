import { useState } from "react";
import Navbar from "../../../components/Navbar";
import { createUserType } from "../../../api/userTypeMasterApi";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

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
      { key: "variation_master", label: "Pricing Formula Master" },
      { key: "price_list", label: "Price List", note: "Write = Price List Import/Export" },
      { key: "price_list_report", label: "Price List Report" },
      { key: "price_list_view", label: "Price List View" },
      { key: "landing_type_master", label: "Landing Type Master" },
      { key: "finance_brand_mapping", label: "Finance Brand Mapping" },
    ]
  },
  {
    category: "📊 Reports & Analytics",
    masters: [
      { key: "target_vs_achievement", label: "Target vs Achievement", note: "Write = Import/Export Template & Sync" },
      { key: "abm_wise_tva", label: "ABM Wise TvA Report" },
      { key: "stock_vs_cash_deposit", label: "Stock vs Cash Deposit", note: "Write = Import/Export Template" },
      { key: "finance_brand_report", label: "Finance Brand Report" },
      { key: "activity_report", label: "Activity Log Report" },
    ]
  },
  {
    category: "📈 Dashboard Reports",
    masters: [
      { key: "brand_wise_sales", label: "Brand Wise Sales", note: "Write = Trigger Sync" },
      { key: "abm_wise_cash_deposit", label: "ABM Wise Cash Deposit Report", note: "Read Only" }
    ]
  },
  {
    category: "⚙️ System Operations & Support",
    masters: [
      { key: "support_master", label: "Support Master" },
      { key: "alert_master", label: "Alert Master" },
      { key: "offer_master", label: "Offers Master" },
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

const PERM_LEGEND_DOTS = {
  canRead: "bg-indigo-600",
  canWrite: "bg-green-600",
  canUpdate: "bg-amber-600",
  canDelete: "bg-rose-600"
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
  const [userRole, setUserRole] = useState("VIEWER");
  const [permissions, setPermissions] = useState(defaultPerms());
  const [saving, setSaving] = useState(false);
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

  // Toggle entire section / group (all perms for masters in group)
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
    try {
      await createUserType({ typeName: newTypeName.trim(), userRole, permissions });
      toast.success(`User type '${newTypeName.trim()}' added successfully.`);
      setNewTypeName("");
      setUserRole("VIEWER");
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
    <div className="flex flex-col flex-1 bg-gradient-to-br from-slate-50 to-indigo-50 font-sans">
      <Navbar title="ERP Admin" />

      <main className="flex-1 flex flex-col w-full max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-7">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 m-0">Create User Type</h1>
            <p className="text-slate-500 mt-1 text-sm">Define a new user group and set its module permissions.</p>
          </div>
          <button
            onClick={() => navigate("/admin/user-types")}
            className="flex items-center gap-1.5 text-slate-500 bg-none border-none cursor-pointer text-sm font-medium hover:text-slate-700 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back to User Types
          </button>
        </div>

        <form onSubmit={handleAddType}>
          {/* Form Fields Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 mb-5 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[13px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  User Type Name <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Supervisor, Technician, Manager"
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  required
                  className="w-full border-[1.5px] border-slate-300 rounded-[9px] px-3.5 py-[11px] text-[15px] outline-none text-slate-800 bg-white focus:border-indigo-650 transition-colors"
                />
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  User Role <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <select
                    value={userRole}
                    onChange={(e) => setUserRole(e.target.value)}
                    required
                    className="w-full border-[1.5px] border-slate-300 rounded-[9px] px-3.5 py-[11px] text-[15px] outline-none text-slate-800 bg-white focus:border-indigo-650 transition-colors appearance-none cursor-pointer"
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
          </div>

          {/* Permissions Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 mb-5 shadow-sm">
            <div className="flex items-center justify-between mb-4.5">
              <div>
                <h2 className="text-[15px] font-bold text-slate-800 m-0">Module Permissions</h2>
                <p className="text-[13px] text-slate-400 mt-1 m-0">Set read, write, update and delete access per master module.</p>
              </div>
              <button
                type="button"
                onClick={toggleAll}
                className={`text-xs font-semibold px-3.5 py-1.5 rounded-lg cursor-pointer border-[1.5px] border-indigo-600 transition-colors ${isAllAll() ? "bg-indigo-600 text-white" : "bg-purple-50 text-indigo-600 hover:bg-purple-100"}`}
              >
                {isAllAll() ? "Deselect All" : "Select All"}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[500px]">
                <thead>
                  <tr className="bg-slate-55">
                    <th className="text-left px-3.5 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 min-w-[160px]">
                      Master Module
                    </th>
                    {PERMS.map((perm) => (
                      <th key={perm} className="text-center px-2 py-2.5 border-b-2 border-slate-200 min-w-[90px]">
                        <button
                          type="button"
                          onClick={() => toggleColumn(perm)}
                          title={`Toggle all ${PERM_LABELS[perm]}`}
                          className="inline-flex flex-col items-center gap-1 bg-transparent border-none cursor-pointer p-1"
                        >
                          <span className={`text-[11px] font-bold uppercase tracking-wider rounded-md px-2 py-0.5 border ${PERM_CLASSES[perm]}`}>
                            {PERM_LABELS[perm]}
                          </span>
                          <div className={`w-4 h-4 rounded-[5px] border flex items-center justify-center transition-all ${isColAll(perm) ? PERM_CHECKBOX_CLASSES[perm] : "border-slate-300 bg-white"}`}>
                            {isColAll(perm) && (
                              <svg viewBox="0 0 12 10" className="w-2.5 h-2.5">
                                <polyline points="1,5 4.5,8.5 11,1" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </div>
                        </button>
                      </th>
                    ))}
                    <th className="text-center px-2 py-2.5 border-b-2 border-slate-200 min-w-[80px] text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      All
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {MASTER_GROUPS.map((group) => {
                    const groupAll = group.masters.every((m) => isRowAll(m.key));
                    return (
                      <tbody key={group.category} className="contents">
                        {/* Section Header */}
                        <tr className="bg-gradient-to-r from-slate-100 via-indigo-50/60 to-purple-50/60 border-y border-indigo-100/80">
                          <td colSpan={6} className="px-3.5 py-2.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-extrabold text-indigo-950 uppercase tracking-wide">
                                  {group.category}
                                </span>
                                <span className="text-[11px] font-semibold text-slate-500 bg-white/80 px-2 py-0.5 rounded-full border border-slate-200">
                                  {group.masters.length} {group.masters.length === 1 ? 'module' : 'modules'}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => toggleGroup(group.masters)}
                                className={`text-[10px] font-bold px-2.5 py-1 rounded-md cursor-pointer border transition-all ${
                                  groupAll
                                    ? "border-indigo-600 bg-indigo-600 text-white shadow-xs"
                                    : "border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-100 shadow-xs"
                                }`}
                              >
                                {groupAll ? "✓ Group All" : "Select Group"}
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Section Items */}
                        {group.masters.map((master, idx) => {
                          const row = permissions.find((p) => p.masterName === master.key);
                          const rowAll = isRowAll(master.key);
                          return (
                            <tr
                              key={master.key}
                              className={`transition-colors border-b border-slate-100 last:border-b-0 hover:bg-slate-50/80 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"}`}
                            >
                              <td className="px-3.5 py-3 text-sm font-semibold text-slate-700 pl-7">
                                <div className="flex flex-col gap-0.5">
                                  <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 flex-shrink-0" />
                                    <span>{master.label}</span>
                                  </div>
                                  {master.note && (
                                    <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50/80 px-1.75 py-0.25 rounded border border-indigo-200/60 w-max ml-3.5">
                                      {master.note}
                                    </span>
                                  )}
                                </div>
                              </td>
                              {PERMS.map((perm) => {
                                const checked = row[perm];
                                const isApprovalRow = master.key.endsWith("_approval");

                                if (isApprovalRow && (perm === "canUpdate" || perm === "canDelete")) {
                                  return (
                                    <td key={perm} className="text-center px-2 py-3 text-slate-400">
                                      —
                                    </td>
                                  );
                                }

                                return (
                                  <td key={perm} className="text-center px-2 py-3">
                                    <div
                                      onClick={() => togglePerm(master.key, perm)}
                                      className={`w-5.5 h-5.5 rounded-md border flex items-center justify-center cursor-pointer transition-all mx-auto ${checked ? `ring-4 ${PERM_CHECKBOX_RING_CLASSES[perm]}` : "border-slate-300 bg-white"}`}
                                    >
                                      {checked && (
                                        <svg viewBox="0 0 12 10" className="w-[11px] h-[11px]">
                                          <polyline points="1,5 4.5,8.5 11,1" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                      )}
                                    </div>
                                  </td>
                                );
                              })}
                              {/* Row toggle */}
                              <td className="text-center px-2 py-3">
                                <button
                                  type="button"
                                  onClick={() => toggleRow(master.key)}
                                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-md cursor-pointer border-[1.5px] transition-all ${rowAll ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 bg-slate-50 text-slate-500 hover:bg-slate-100"}`}
                                >
                                  {rowAll ? "✓ All" : "All"}
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

            {/* Legend */}
            <div className="flex flex-wrap gap-2.5 mt-4 pt-3.5 border-t border-slate-100">
              {PERMS.map((perm) => (
                <div key={perm} className="flex items-center gap-1.5">
                  <div className={`w-2.5 h-2.5 rounded-[3px] ${PERM_LEGEND_DOTS[perm]}`} />
                  <span className="text-xs text-slate-500 font-medium">{PERM_LABELS[perm]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 mt-5">
            <button
              type="button"
              onClick={() => navigate("/admin/user-types")}
              className="px-5.5 py-2.5 rounded-[9px] border-[1.5px] border-slate-300 text-slate-600 bg-white font-semibold text-sm cursor-pointer hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-7 py-2.5 rounded-[9px] border-none text-white font-bold text-sm bg-gradient-to-br from-indigo-600 to-indigo-700 shadow-[0_2px_8px_rgba(104,4,161,0.35)] cursor-pointer disabled:bg-slate-400 disabled:cursor-not-allowed disabled:shadow-none hover:opacity-95 transition-all"
            >
              {saving ? "Saving…" : "Create User Type"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

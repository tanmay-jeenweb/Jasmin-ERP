import { useEffect, useState, useMemo } from "react";
import Navbar from "../../components/Navbar";
import DataTable from "../../components/DataTable";
import { fetchActivityLogs } from "../../api/authApi";
import toast from "react-hot-toast";

// ─── Modal to view detailed change data ──────────────────────────────────────────
function DetailModal({ isOpen, row, onClose }) {
  if (!isOpen || !row) return null;

  const beforeObj = row.before_data || {};
  const afterObj = row.after_data || {};

  // Get all unique keys and sort them alphabetically, excluding device_id
  const allKeys = Array.from(new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)]))
    .filter(key => key !== 'device_id')
    .sort();

  const isFieldChanged = (key) => {
    const vBefore = beforeObj[key];
    const vAfter = afterObj[key];
    if (typeof vBefore === "object" || typeof vAfter === "object") {
      return JSON.stringify(vBefore) !== JSON.stringify(vAfter);
    }
    return vBefore !== vAfter;
  };

  const formatValue = (val, key) => {
    if (val === null || val === undefined) return <span className="text-slate-400">—</span>;
    if (typeof val === "boolean") return val ? "True" : "False";
    
    if (key === "permissions" && Array.isArray(val)) {
      const MASTERS_MAP = {
        user_type: "User Type Master",
        mobile_brand_master: "Brand Master",
        bank_master: "Finance Company Master",
        finance_machine_master: "Finance Machine Master",
        user_master: "User Master",
        device_approval: "Device Approval",
        state_master: "State Master",
        product_type_master: "Product Type Master",
        item_model_master: "Model Master",
        model_group_master: "Model Group Master",
        support_master: "Support Master",
        alert_master: "Alert Master",
        branch_master: "Branch Master",
        user_branch_mapping: "User Branch Mapping",
        variation_master: "Pricing Formula Master",
        price_list: "Price List",
        price_list_report: "Price List Report",
        price_list_view: "Price List View",
        landing_type_master: "Landing Type Master",
        target_vs_achievement: "Target vs Achievement",
        stock_vs_cash_deposit: "Stock vs Cash Deposit",
        offer_master: "Offers Master",
        finance_brand_mapping: "Finance Brand Mapping",
        finance_brand_report: "Finance Brand Report",
        activity_report: "Activity Log Report"
      };

      const PERM_LABELS = { canRead: "Read", canWrite: "Write / Approval", canUpdate: "Update", canDelete: "Delete" };
      const PERM_CLASSES = {
        canRead: "bg-purple-50 text-indigo-650 border-purple-205",
        canWrite: "bg-green-50 text-green-700 border-green-205",
        canUpdate: "bg-amber-50 text-amber-800 border-amber-205",
        canDelete: "bg-rose-50 text-rose-700 border-rose-205"
      };

      const normalized = val.map(p => ({
        masterName: p.masterName || p.master_name,
        canRead: !!(p.canRead || p.can_read),
        canWrite: !!(p.canWrite || p.can_write),
        canUpdate: !!(p.canUpdate || p.can_update),
        canDelete: !!(p.canDelete || p.can_delete)
      }));

      const rows = normalized.map((p) => {
        const masterName = p.masterName;
        if (!masterName) return null;
        const label = MASTERS_MAP[masterName] || masterName;
        const isApprovalRow = masterName.endsWith("_approval");
        const applicablePerms = isApprovalRow
          ? ["canRead", "canWrite"]
          : ["canRead", "canWrite", "canUpdate", "canDelete"];
        const granted = applicablePerms.filter((perm) => p[perm]);
        if (granted.length === 0) return null;
        return { label, granted, isApprovalRow };
      }).filter(Boolean);

      if (rows.length === 0) {
        return <span className="text-slate-400 text-xs">No access</span>;
      }

      return (
        <div className="flex flex-col gap-1.5 py-1">
          {rows.map(({ label, granted, isApprovalRow }, idx) => (
            <div key={idx} className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold text-slate-600 bg-slate-100 border border-slate-200 rounded-[5px] px-1.75 py-0.5 whitespace-nowrap">
                {label}
              </span>
              <span className="text-slate-300 text-[11px]">→</span>
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

    if (typeof val === "object") return JSON.stringify(val);
    return String(val);
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-900/55 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-[18px] w-full max-w-[700px] mx-auto shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-7 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-br from-indigo-600 to-indigo-700">
          <div className="flex-1">
            <h2 className="m-0 text-lg font-bold text-white">Activity Log Detail</h2>
            <p className="mt-1 text-[13px] text-indigo-100">
              {row.master_name} — {row.change_type.toUpperCase()} by {row.username}
            </p>
          </div>
          <button onClick={onClose} className="bg-white/15 border-none rounded-lg w-[34px] h-[34px] cursor-pointer flex items-center justify-center text-white hover:bg-white/20 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-[18px] h-[18px]">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="px-7 py-5 overflow-y-auto flex-1 bg-slate-50">
          {/* Metadata Grid */}
          <div className="grid grid-cols-3 gap-4 mb-5 bg-white p-4 rounded-xl border border-slate-200">
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">User</span>
              <p className="mt-0.5 text-sm font-semibold text-slate-800">{row.username || "System"}</p>
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Action Type</span>
              <p className="mt-0.5">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                  row.change_type === 'created' || row.change_type === 'approved' ? 'bg-green-100 text-green-800' :
                  row.change_type === 'updated' ? 'bg-amber-100 text-amber-800' :
                  row.change_type === 'deleted' || row.change_type === 'rejected' ? 'bg-rose-100 text-rose-800' :
                  'bg-slate-100 text-slate-800'
                }`}>
                  {row.change_type.toUpperCase()}
                </span>
              </p>
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Timestamp</span>
              <p className="mt-0.5 text-sm text-slate-800">{new Date(row.created_at).toLocaleString()}</p>
            </div>
          </div>

          {/* Table View */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200">
                  <th className="px-3.5 py-2.5 font-semibold text-slate-600">Field</th>
                  <th className="px-3.5 py-2.5 font-semibold text-slate-600">Before</th>
                  <th className="px-3.5 py-2.5 font-semibold text-slate-600">After</th>
                </tr>
              </thead>
              <tbody>
                {allKeys.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-3.5 text-center text-slate-500">No details available</td>
                  </tr>
                ) : (
                  allKeys.map((key) => {
                    const changed = isFieldChanged(key);
                    return (
                      <tr key={key} className={`border-b border-slate-100 last:border-b-0 ${changed ? "bg-amber-50/40" : "bg-transparent"}`}>
                        <td className="px-3.5 py-2.5 font-medium text-slate-800 w-[30%]">{key}</td>
                        <td className="px-3.5 py-2.5 text-slate-600 w-[35%] break-all">{formatValue(beforeObj[key], key)}</td>
                        <td className={`px-3.5 py-2.5 w-[35%] break-all ${changed ? "text-amber-850 font-semibold" : "text-slate-600 font-normal"}`}>
                          {formatValue(afterObj[key], key)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
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

// ─── Main Activity Report Component ──────────────────────────────────────────────
export default function ActivityReport() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRow, setSelectedRow] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetchActivityLogs();
      if (res.data?.success) {
        setLogs(res.data.logs || []);
      } else {
        toast.error(res.data?.message || "Failed to fetch activity logs");
      }
    } catch (err) {
      console.error("Error fetching activity logs:", err);
      toast.error("Failed to load activity logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const columns = useMemo(() => [
    {
      key: "username",
      label: "Username",
      render: (row) => <span className="font-semibold text-slate-800">{row.username || "System"}</span>
    },
    {
      key: "master_name",
      label: "Module / Master",
      render: (row) => <span className="text-slate-700">{row.master_name}</span>
    },
    {
      key: "change_type",
      label: "Action",
      render: (row) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold tracking-wide ${
          row.change_type === 'created' || row.change_type === 'approved' ? 'bg-green-50 text-green-700 border border-green-200' :
          row.change_type === 'updated' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
          row.change_type === 'deleted' || row.change_type === 'rejected' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
          'bg-slate-50 text-slate-700 border border-slate-200'
        }`}>
          {row.change_type.toUpperCase()}
        </span>
      )
    },
    {
      key: "details",
      label: "Details",
      sortable: false,
      render: (row) => (row.before_data || row.after_data) ? (
        <button
          onClick={() => {
            setSelectedRow(row);
            setModalOpen(true);
          }}
          className="text-xs text-indigo-600 hover:text-indigo-900 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 font-semibold px-2.5 py-1.5 rounded transition-colors cursor-pointer"
        >
          View Details
        </button>
      ) : <span className="text-slate-400">—</span>
    },
    {
      key: "created_at",
      label: "Date & Time",
      render: (row) => <span className="text-xs text-slate-500">{new Date(row.created_at).toLocaleString()}</span>
    }
  ], []);

  return (
    <div className="flex-1 flex flex-col bg-slate-50 font-sans text-slate-900 min-h-screen">
      <Navbar title="User Activity Report" />

      <main className="flex-1 flex flex-col w-full mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="flex-1 flex flex-col mb-8">
          <DataTable
            tableId="user_activity_report"
            title="User Activity Report"
            data={logs}
            columns={columns}
            loading={loading}
            searchPlaceholder="Search by username, module or action..."
          />
        </div>
      </main>

      {/* Detail Modal */}
      <DetailModal
        isOpen={modalOpen}
        row={selectedRow}
        onClose={() => {
          setModalOpen(false);
          setSelectedRow(null);
        }}
      />
    </div>
  );
}

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
    if (val === null || val === undefined) return <span style={{ color: "#94a3b8" }}>—</span>;
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
      };

      const PERM_LABELS = { canRead: "Read", canWrite: "Write / Approval", canUpdate: "Update", canDelete: "Delete" };
      const PERM_COLORS = {
        canRead: { bg: "#f3e8ff", border: "#d8b4fe", text: "#6804a1" },
        canWrite: { bg: "#f0fdf4", border: "#bbf7d0", text: "#15803d" },
        canUpdate: { bg: "#fffbeb", border: "#fde68a", text: "#b45309" },
        canDelete: { bg: "#fff1f2", border: "#fecdd3", text: "#be123c" }
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
        return <span style={{ color: "#94a3b8", fontSize: 12 }}>No access</span>;
      }

      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "4px 0" }}>
          {rows.map(({ label, granted, isApprovalRow }, idx) => (
            <div key={idx} style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={{
                fontSize: 11, fontWeight: 700, color: "#475569",
                background: "#f1f5f9", border: "1px solid #e2e8f0",
                borderRadius: 5, padding: "2px 7px", whiteSpace: "nowrap"
              }}>
                {label}
              </span>
              <span style={{ color: "#cbd5e1", fontSize: 11 }}>→</span>
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

    if (typeof val === "object") return JSON.stringify(val);
    return String(val);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(15,23,42,0.55)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16
    }}>
      <div style={{
        background: "#fff", borderRadius: 18, width: "100%", maxWidth: 700, margin: "0 auto",
        boxShadow: "0 25px 60px rgba(0,0,0,0.2)", overflow: "hidden", display: "flex", flexDirection: "column",
        maxHeight: "90vh"
      }}>
        {/* Modal Header */}
        <div style={{ padding: "20px 28px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", background: "linear-gradient(135deg,#6804a1,#52037e)" }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#fff" }}>Activity Log Detail</h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#d9e2ec" }}>
              {row.master_name} — {row.change_type.toUpperCase()} by {row.username}
            </p>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8, width: 34, height: 34, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: 18, height: 18 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: "20px 28px", overflowY: "auto", flex: 1, background: "#f8fafc" }}>
          {/* Metadata Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20, background: "#fff", padding: 16, borderRadius: 12, border: "1px solid #e2e8f0" }}>
            <div>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>User</span>
              <p style={{ margin: "2px 0 0", fontSize: 14, fontWeight: 600, color: "#1e293b" }}>{row.username || "System"}</p>
            </div>
            <div>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Action Type</span>
              <p style={{ margin: "2px 0 0" }}>
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
              <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Timestamp</span>
              <p style={{ margin: "2px 0 0", fontSize: 14, color: "#1e293b" }}>{new Date(row.created_at).toLocaleString()}</p>
            </div>
          </div>

          {/* Table View */}
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #e2e8f0" }}>
                  <th style={{ padding: "10px 14px", fontWeight: 600, color: "#475569" }}>Field</th>
                  <th style={{ padding: "10px 14px", fontWeight: 600, color: "#475569" }}>Before</th>
                  <th style={{ padding: "10px 14px", fontWeight: 600, color: "#475569" }}>After</th>
                </tr>
              </thead>
              <tbody>
                {allKeys.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ padding: 14, textAlign: "center", color: "#64748b" }}>No details available</td>
                  </tr>
                ) : (
                  allKeys.map((key) => {
                    const changed = isFieldChanged(key);
                    return (
                      <tr key={key} style={{
                        borderBottom: "1px solid #f1f5f9",
                        background: changed ? "rgba(254, 243, 199, 0.4)" : "transparent"
                      }}>
                        <td style={{ padding: "10px 14px", fontWeight: 550, color: "#1e293b", width: "30%" }}>{key}</td>
                        <td style={{ padding: "10px 14px", color: "#475569", width: "35%", wordBreak: "break-all" }}>{formatValue(beforeObj[key], key)}</td>
                        <td style={{
                          padding: "10px 14px",
                          color: changed ? "#92400e" : "#475569",
                          fontWeight: changed ? 600 : 400,
                          width: "35%",
                          wordBreak: "break-all"
                        }}>
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

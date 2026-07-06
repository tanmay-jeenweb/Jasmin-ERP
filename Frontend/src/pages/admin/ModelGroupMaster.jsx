import { useEffect, useState, useMemo } from "react";
import Navbar from "../../components/Navbar";
import { getModelGroups, syncModelGroups, deleteModelGroup } from "../../api/modelGroupApi";
import DataTable from "../../components/DataTable";
import toast from "react-hot-toast";
import { usePermission } from "../../context/PermissionContext";

export default function ModelGroupMaster() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");

  const { hasPermission } = usePermission();
  const canSync = hasPermission("model_group_master", "write");
  const canDelete = hasPermission("model_group_master", "delete");

  const loadGroups = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await getModelGroups();
      setGroups(response.data.data || []);
    } catch (err) {
      console.error("Failed to load model groups", err);
      setError("Unable to load model groups. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGroups();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setError("");
    const loadToastId = toast.loading("Syncing model groups from external API...");
    try {
      const response = await syncModelGroups();
      toast.success(response.data.message || "Sync completed successfully!", { id: loadToastId });
      await loadGroups();
    } catch (err) {
      console.error("Failed to sync model groups", err);
      toast.error(err?.response?.data?.message || "Sync failed. Please try again.", { id: loadToastId });
    } finally {
      setSyncing(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this model group?")) return;
    setLoading(true);
    try {
      await deleteModelGroup(id);
      toast.success("Model group deleted successfully");
      await loadGroups();
    } catch (err) {
      console.error("Failed to delete model group", err);
      toast.error(err?.response?.data?.message || "Unable to delete model group.");
      setLoading(false);
    }
  };

  const columns = useMemo(() => {
    const cols = [
      {
        key: "id",
        label: "ID",
        minWidth: "80px"
      },
      {
        key: "brand_name",
        label: "Brand Name",
        render: (row) => <span style={{ fontWeight: 700, color: "#0f172a" }}>{row.brand_name || "—"}</span>
      },
      {
        key: "model_group_name",
        label: "Model Group Name",
        render: (row) => <span style={{ fontWeight: 700, color: "#6804a1" }}>{row.model_group_name || "—"}</span>
      }
    ];

    if (canDelete) {
      cols.push({
        key: "actions",
        label: "Actions",
        sortable: false,
        minWidth: "80px",
        render: (row) => (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={() => handleDelete(row.id)}
              style={{ display: "flex", width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 8, border: "1px solid #fecdd3", background: "#fff1f2", color: "#be123c", cursor: "pointer" }}
              title="Delete"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" style={{ width: 15, height: 15 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 7.5h12m-1.5 0-.563 12.375A2.25 2.25 0 0113.693 21H10.307a2.25 2.25 0 01-2.244-2.125L7.5 7.5m3-3h3A1.5 1.5 0 0115 6v1.5H9V6a1.5 1.5 0 011.5-1.5Z" />
              </svg>
            </button>
          </div>
        )
      });
    }

    return cols;
  }, [canDelete]);

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, background: "#f8fafc", fontFamily: "'Inter',sans-serif" }}>
      <Navbar title="ERP Admin" />

      <main style={{ flex: 1, display: "flex", flexDirection: "column", width: "100%", margin: "0 auto", padding: "32px 30px" }}>
        {error && (
          <div style={{ background: "#fff1f2", border: "1px solid #fecdd3", color: "#be123c", padding: "12px 16px", borderRadius: 10, marginBottom: 20, fontSize: 14, fontWeight: 500 }}>
            {error}
          </div>
        )}
        <DataTable
          tableId="model_group_master"
          title="Model Group Master"
          data={groups}
          columns={columns}
          loading={loading}
          searchPlaceholder="Search model groups..."
          actionButton={
            canSync ? (
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
                title="Sync from API"
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
            ) : null
          }
        />
      </main>
    </div>
  );
}

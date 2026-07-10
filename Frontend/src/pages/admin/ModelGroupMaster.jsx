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
        render: (row) => <span className="font-bold text-slate-900">{row.brand_name || "—"}</span>
      },
      {
        key: "model_group_name",
        label: "Model Group Name",
        render: (row) => <span className="font-bold text-indigo-650">{row.model_group_name || "—"}</span>
      }
    ];

    if (canDelete) {
      cols.push({
        key: "actions",
        label: "Actions",
        sortable: false,
        minWidth: "80px",
        render: (row) => (
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleDelete(row.id)}
              className="flex w-8 h-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 cursor-pointer hover:bg-rose-100 transition-colors"
              title="Delete"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-[15px] h-[15px]">
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
    <div className="flex flex-col flex-1 bg-slate-50 font-sans">
      <Navbar title="ERP Admin" />

      <main className="flex-1 flex flex-col w-full mx-auto px-[30px] py-8">
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg mb-5 text-sm font-medium">
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
                className="flex items-center gap-2 px-5 py-2.5 rounded-[9px] text-white border-none cursor-pointer font-semibold text-[13px] bg-gradient-to-br from-indigo-600 to-indigo-700 shadow-[0_2px_8px_rgba(104,4,161,0.35)] disabled:bg-slate-400 disabled:cursor-not-allowed disabled:shadow-none hover:opacity-95 transition-all"
                title="Sync from API"
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
            ) : null
          }
        />
      </main>
    </div>
  );
}

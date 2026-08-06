import { useEffect, useState, useMemo } from "react";
import Navbar from "../../components/Navbar";
import { getItemModels, syncItemModels, deleteItemModel } from "../../api/itemModelApi";
import DataTable from "../../components/DataTable";
import toast from "react-hot-toast";
import { usePermission } from "../../context/PermissionContext";

// Helper to format YYYYMMDD to YYYY-MM-DD
const formatCreatedOn = (val) => {
  if (!val) return "—";
  const s = String(val);
  if (s.length === 8) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }
  return s;
};

export default function ItemModelMaster() {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");

  const { hasPermission } = usePermission();
  const canSync = hasPermission("item_model_master", "write");
  const canDelete = hasPermission("item_model_master", "delete");

  const loadModels = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await getItemModels();
      setModels(response.data.data || []);
    } catch (err) {
      console.error("Failed to load item models", err);
      setError("Unable to load item models. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadModels();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setError("");
    const loadToastId = toast.loading("Syncing item models from external API...");
    try {
      const response = await syncItemModels();
      toast.success(response.data.message || "Sync completed successfully!", { id: loadToastId });
      await loadModels();
    } catch (err) {
      console.error("Failed to sync item models", err);
      toast.error(err?.response?.data?.message || "Sync failed. Please try again.", { id: loadToastId });
    } finally {
      setSyncing(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this item model?")) return;
    setLoading(true);
    try {
      await deleteItemModel(id);
      toast.success("Item model deleted successfully");
      await loadModels();
    } catch (err) {
      console.error("Failed to delete item model", err);
      toast.error(err?.response?.data?.message || "Unable to delete item model.");
      setLoading(false);
    }
  };

  const columns = useMemo(() => {
    const cols = [
      {
        key: "item_code",
        label: "Item Code",
        render: (row) => <span className="font-mono font-semibold text-slate-500">{row.item_code}</span>
      },
      {
        key: "model_name",
        label: "Model Name",
        render: (row) => <span className="font-bold text-slate-900">{row.model_name || "—"}</span>
      },
      {
        key: "brand_name",
        label: "Brand Name",
        render: (row) => <span className="font-semibold text-slate-650">{row.brand_name || "—"}</span>
      },
      {
        key: "model_group_name",
        label: "Model Group Name",
        render: (row) => <span>{row.model_group_name || "—"}</span>
      },
      {
        key: "created_on",
        label: "Created On",
        render: (row) => <span>{formatCreatedOn(row.created_on)}</span>
      },
      {
        key: "product_name",
        label: "Product Name",
        render: (row) => <span>{row.product_name || "—"}</span>
      },
      {
        key: "icat_name",
        label: "ICAT Name",
        render: (row) => <span>{row.icat_name || "—"}</span>
      },
      {
        key: "prod_catg_name",
        label: "Prod Catg Name",
        render: (row) => <span>{row.prod_catg_name || "—"}</span>
      },
      {
        key: "uqc",
        label: "UQC",
        render: (row) => <span>{row.uqc || "—"}</span>
      },
      {
        key: "serialno_status",
        label: "Serialno Status",
        render: (row) => (
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${row.serialno_status === "Active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
            {row.serialno_status || "—"}
          </span>
        )
      },
      {
        key: "item_status",
        label: "Item Status",
        render: (row) => {
          const isAct = String(row.item_status).toLowerCase() === "active";
          return (
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${isAct ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
              {row.item_status || "—"}
            </span>
          );
        }
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
          tableId="item_model_master"
          title="Model Master"
          data={models}
          columns={columns}
          loading={loading}
          searchPlaceholder="Search models..."
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

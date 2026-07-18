import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import { getVariations, deleteVariation } from "../../api/variationApi";
import DataTable from "../../components/DataTable";
import toast from "react-hot-toast";
import { usePermission } from "../../context/PermissionContext";

export default function VariationMasterList() {
  const [variations, setVariations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { hasPermission } = usePermission();

  const loadVariations = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await getVariations();
      if (response.data?.success) {
        setVariations(response.data.data || []);
      } else {
        setError(response.data?.message || "Failed to load variation rules.");
      }
    } catch (err) {
      console.error("Failed to load variations", err);
      setError("Unable to load variations. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVariations();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this variation rule?")) return;
    try {
      const response = await deleteVariation(id);
      if (response.data?.success) {
        toast.success("Variation rule deleted successfully");
        await loadVariations();
      } else {
        toast.error(response.data?.message || "Unable to delete variation rule.");
      }
    } catch (err) {
      console.error("Failed to delete variation rule", err);
      toast.error(err?.response?.data?.message || "Unable to delete variation rule.");
    }
  };

  const columns = useMemo(() => {
    const cols = [
      {
        key: "id",
        label: "ID",
        minWidth: "60px",
        render: (row) => <span className="font-semibold text-slate-500">#{row.id}</span>
      },
      {
        key: "state_name",
        label: "State",
        render: (row) => <span className="font-bold text-slate-800">{row.state_name || "N/A"}</span>
      },
      {
        key: "brands",
        label: "Brands",
        minWidth: "220px",
        render: (row) => {
          const brandList = Array.isArray(row.brands)
            ? row.brands
            : typeof row.brands === "string"
            ? JSON.parse(row.brands)
            : [];
          return (
            <div className="flex flex-wrap gap-1 max-w-[300px]">
              {brandList.map((brand, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-150"
                >
                  {brand}
                </span>
              ))}
            </div>
          );
        }
      },
      {
        key: "columns",
        label: "Configured Columns",
        minWidth: "350px",
        render: (row) => {
          const colsList = Array.isArray(row.columns)
            ? row.columns
            : typeof row.columns === "string"
            ? JSON.parse(row.columns)
            : [];
          return (
            <div className="flex flex-wrap gap-1.5 max-w-[450px]">
              {colsList.map((col, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-150"
                  title={col.type === "formulation" ? `Formula: ${col.formula}` : "User Input field"}
                >
                  <span className="font-bold mr-1">{col.column_id}</span>({col.column_name})
                  {col.type === "formulation" ? (
                    <span className="ml-1 text-[10px] text-indigo-500 font-mono">fx</span>
                  ) : null}
                </span>
              ))}
            </div>
          );
        }
      }
    ];

    const canUpdate = hasPermission("variation_master", "update");
    const canDelete = hasPermission("variation_master", "delete");

    if (canUpdate || canDelete) {
      cols.push({
        key: "actions",
        label: "Actions",
        sortable: false,
        minWidth: "120px",
        render: (row) => (
          <div className="flex items-center gap-2">
            {canUpdate && (
              <button
                onClick={() => navigate(`/admin/variations/edit/${row.id}`)}
                className="flex w-8 h-8 items-center justify-center rounded-lg border border-purple-200 bg-purple-50 text-indigo-650 cursor-pointer hover:bg-purple-100 transition-colors"
                title="Edit"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.8}
                  stroke="currentColor"
                  className="w-[15px] h-[15px]"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931Z"
                  />
                </svg>
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => handleDelete(row.id)}
                className="flex w-8 h-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 cursor-pointer hover:bg-rose-100 transition-colors"
                title="Delete"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.8}
                  stroke="currentColor"
                  className="w-[15px] h-[15px]"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 7.5h12m-1.5 0-.563 12.375A2.25 2.25 0 0113.693 21H10.307a2.25 2.25 0 01-2.244-2.125L7.5 7.5m3-3h3A1.5 1.5 0 0115 6v1.5H9V6a1.5 1.5 0 011.5-1.5Z"
                  />
                </svg>
              </button>
            )}
          </div>
        )
      });
    }

    return cols;
  }, [hasPermission, navigate]);

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
          tableId="variation_master"
          title="Variation Master"
          data={variations}
          columns={columns}
          loading={loading}
          searchPlaceholder="Search state or brands..."
          actionButton={
            hasPermission("variation_master", "write") ? (
              <button
                onClick={() => navigate("/admin/variations/add")}
                className="flex w-10 h-10 items-center justify-center rounded-[9px] bg-gradient-to-br from-indigo-650 to-indigo-750 text-white border-none cursor-pointer shadow-[0_2px_8px_rgba(104,4,161,0.35)] hover:opacity-95 transition-opacity"
                title="Create Variation Rule"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2.5}
                  stroke="currentColor"
                  className="w-[18px] h-[18px]"
                >
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

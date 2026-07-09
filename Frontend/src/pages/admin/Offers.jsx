import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import { getOffers, deleteOffer } from "../../api/offerApi";
import DataTable from "../../components/DataTable";
import toast from "react-hot-toast";

export default function Offers() {
  const navigate = useNavigate();
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const loadOffers = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await getOffers();
      setOffers(response.data.data || []);
    } catch (err) {
      console.error("Failed to load offers", err);
      setError("Unable to load offers list. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOffers();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this offer? This will delete all its transaction rules as well.")) return;
    setDeleting(true);
    try {
      await deleteOffer(id);
      toast.success("Offer deleted successfully");
      await loadOffers();
    } catch (err) {
      console.error("Failed to delete offer", err);
      toast.error(err?.response?.data?.message || "Unable to delete offer.");
    } finally {
      setDeleting(false);
    }
  };

  const columns = useMemo(() => {
    const cols = [
      { key: "id", label: "ID", minWidth: "60px" },
      {
        key: "brand_name", label: "Brand",
        render: (row) => <span className="font-bold text-slate-900">{row.brand_name}</span>
      },
      {
        key: "model_group_name", label: "Model Group(s)",
        render: (row) => (
          <span className="font-bold text-indigo-650 whitespace-normal break-all">
            {row.model_group_name || "—"}
          </span>
        )
      },
      {
        key: "state_name", label: "State",
        render: (row) => <span className="text-slate-650">{row.state_name || "—"}</span>
      },
      {
        key: "offer_type", label: "Offer Type",
        render: (row) => (
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${row.offer_type === "Cashback Offer" ? "bg-sky-100 text-sky-700" : row.offer_type === "Bundle Offer" ? "bg-amber-100 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
            {row.offer_type}
          </span>
        )
      },
      {
        key: "from_date", label: "From Date",
        render: (row) => row.from_date ? new Date(row.from_date).toLocaleDateString() : "—"
      },
      {
        key: "to_date", label: "To Date",
        render: (row) => row.to_date ? new Date(row.to_date).toLocaleDateString() : "—"
      }
    ];

    const canUpdate = true;
    const canDelete = true;

    if (canUpdate || canDelete) {
      cols.push({
        key: "actions", label: "Actions", sortable: false, minWidth: "120px",
        render: (row) => (
          <div className="flex items-center gap-2">
            {canUpdate && (
              <button
                onClick={() => navigate(`/admin/offers/edit/${row.id}`)}
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
                disabled={deleting}
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
  }, [deleting, navigate]);

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
          tableId="offers_master"
          title="Offers Master"
          data={offers}
          columns={columns}
          loading={loading}
          searchPlaceholder="Search offers..."
          actionButton={
            <button
              onClick={() => navigate("/admin/offers/create")}
              className="flex w-10 h-10 items-center justify-center rounded-[9px] bg-gradient-to-br from-indigo-650 to-indigo-755 text-white border-none cursor-pointer shadow-[0_2px_8px_rgba(104,4,161,0.35)] hover:opacity-95 transition-opacity"
              title="Create Offer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-[18px] h-[18px]">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
          }
        />
      </main>
    </div>
  );
}

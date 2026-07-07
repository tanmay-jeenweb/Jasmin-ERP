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
        render: (row) => <span style={{ fontWeight: 700, color: "#0f172a" }}>{row.brand_name}</span>
      },
      {
        key: "model_group_name", label: "Model Group(s)",
        render: (row) => (
          <span style={{ fontWeight: 700, color: "#6804a1", whiteSpace: "normal", wordBreak: "break-all" }}>
            {row.model_group_name || "—"}
          </span>
        )
      },
      {
        key: "state_name", label: "State",
        render: (row) => <span style={{ color: "#334155" }}>{row.state_name || "—"}</span>
      },
      {
        key: "offer_type", label: "Offer Type",
        render: (row) => (
          <span style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "4px 10px",
            borderRadius: "9999px",
            fontSize: "12px",
            fontWeight: "700",
            background: row.offer_type === "Cashback Offer" ? "#e0f2fe" : row.offer_type === "Bundle Offer" ? "#fef3c7" : "#ecfdf5",
            color: row.offer_type === "Cashback Offer" ? "#0369a1" : row.offer_type === "Bundle Offer" ? "#b45309" : "#047857"
          }}>
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
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {canUpdate && (
              <button
                onClick={() => navigate(`/admin/offers/edit/${row.id}`)}
                style={{ display: "flex", width: 32, height: 32, alignItems: "center", borderRadius: 8, border: "1px solid #d8b4fe", background: "#f3e8ff", color: "#6804a1", cursor: "pointer", justifyContent: "center" }}
                title="Edit"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" style={{ width: 15, height: 15 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931Z" />
                </svg>
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => handleDelete(row.id)}
                disabled={deleting}
                style={{ display: "flex", width: 32, height: 32, alignItems: "center", borderRadius: 8, border: "1px solid #fecdd3", background: "#fff1f2", color: "#be123c", cursor: deleting ? "not-allowed" : "pointer", justifyContent: "center" }}
                title="Delete"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" style={{ width: 15, height: 15 }}>
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
    <div style={{ display: "flex", flexDirection: "column", flex: 1, background: "#f8fafc", fontFamily: "'Inter',sans-serif" }}>
      <Navbar title="ERP Admin" />

      <main style={{ flex: 1, display: "flex", flexDirection: "column", width: "100%", margin: "0 auto", padding: "32px 30px" }}>
        {error && (
          <div style={{ background: "#fff1f2", border: "1px solid #fecdd3", color: "#be123c", padding: "12px 16px", borderRadius: 10, marginBottom: 20, fontSize: 14, fontWeight: 500 }}>
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
              style={{ display: "flex", width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 9, background: "linear-gradient(135deg,#6804a1,#52037e)", color: "#fff", border: "none", cursor: "pointer", boxShadow: "0 2px 8px rgba(104,4,161,0.35)" }}
              title="Create Offer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" style={{ width: 18, height: 18 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
          }
        />
      </main>
    </div>
  );
}

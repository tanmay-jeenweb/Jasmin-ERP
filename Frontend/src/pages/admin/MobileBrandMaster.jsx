import { useEffect, useState, useMemo } from "react";
import Navbar from "../../components/Navbar";
import { getMobileBrands, createMobileBrand, updateMobileBrand, deleteMobileBrand } from "../../api/mobileBrandApi";
import DataTable from "../../components/DataTable";
import toast from "react-hot-toast";
import { usePermission } from "../../context/PermissionContext";

// ─── Brand Modal (Handles both Create and Edit) ───────────────────────────────────
function BrandModal({ isOpen, row, onClose, onSave, saving }) {
  const [mobileBrand, setMobileBrand] = useState("");
  const [forCode, setForCode] = useState("No");

  useEffect(() => {
    if (row) {
      setMobileBrand(row.mobile_brand || "");
      setForCode(row.for_code || "No");
    } else {
      setMobileBrand("");
      setForCode("No");
    }
  }, [row, isOpen]);

  if (!isOpen) return null;

  const isEdit = !!row;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!mobileBrand.trim()) return;
    onSave(isEdit ? row.id : null, mobileBrand.trim(), forCode);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(15,23,42,0.55)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16
    }}>
      <div style={{
        background: "#fff", borderRadius: 18, width: "100%", maxWidth: 500, margin: "0 auto",
        boxShadow: "0 25px 60px rgba(0,0,0,0.2)", overflow: "hidden"
      }}>
        {/* Modal Header */}
        <div style={{ padding: "20px 28px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", background: "linear-gradient(135deg,#6804a1,#52037e)" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#fff" }}>{isEdit ? "Edit Brand" : "Create Brand"}</h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#d9e2ec" }}>{isEdit ? "Update brand details" : "Add a new brand to the system"}</p>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8, width: 34, height: 34, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: 18, height: 18 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit}>
          <div style={{ padding: "24px 28px" }}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                Brand Name <span style={{ color: "#e11d48" }}>*</span>
              </label>
              <input
                type="text"
                value={mobileBrand}
                onChange={(e) => setMobileBrand(e.target.value)}
                required
                placeholder="e.g. Apple, Samsung, OnePlus"
                style={{ width: "100%", boxSizing: "border-box", border: "1.5px solid #cbd5e1", borderRadius: 9, padding: "11px 14px", fontSize: 15, outline: "none", color: "#1e293b" }}
                onFocus={e => e.target.style.borderColor = "#6804a1"}
                onBlur={e => e.target.style.borderColor = "#cbd5e1"}
              />
            </div>

            <div style={{ marginBottom: 8 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                For Code <span style={{ color: "#e11d48" }}>*</span>
              </label>
              <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, color: "#1e293b", cursor: "pointer", fontWeight: 500 }}>
                  <input
                    type="radio"
                    name="forCode"
                    checked={forCode === "Yes"}
                    onChange={() => setForCode("Yes")}
                    style={{ width: 18, height: 18, accentColor: "#6804a1" }}
                  />
                  Yes
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, color: "#1e293b", cursor: "pointer", fontWeight: 500 }}>
                  <input
                    type="radio"
                    name="forCode"
                    checked={forCode === "No"}
                    onChange={() => setForCode("No")}
                    style={{ width: 18, height: 18, accentColor: "#6804a1" }}
                  />
                  No
                </label>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div style={{ padding: "16px 28px", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "flex-end", gap: 12, background: "#fafafa" }}>
            <button type="button" onClick={onClose} disabled={saving}
              style={{ padding: "9px 20px", borderRadius: 8, border: "1.5px solid #cbd5e1", color: "#475569", background: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !mobileBrand.trim()}
              style={{ padding: "9px 24px", borderRadius: 8, border: "none", background: saving ? "#94a3b8" : "linear-gradient(135deg,#6804a1,#52037e)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: saving ? "not-allowed" : "pointer", boxShadow: saving ? "none" : "0 2px 8px rgba(104,4,161,0.35)" }}>
              {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Brand"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MobileBrandMaster() {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);

  const { hasPermission } = usePermission();

  const loadBrands = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await getMobileBrands();
      setBrands(response.data.data || []);
    } catch (err) {
      console.error("Failed to load brands", err);
      setError("Unable to load brands. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBrands();
  }, []);

  const handleSave = async (id, mobileBrand, forCode) => {
    setSaving(true);
    try {
      if (id) {
        // Edit Mode
        await updateMobileBrand(id, { mobileBrand, forCode });
        toast.success("Brand updated successfully");
      } else {
        // Create Mode
        await createMobileBrand({ mobileBrand, forCode });
        toast.success("Brand created successfully");
      }
      setIsModalOpen(false);
      setSelectedRow(null);
      await loadBrands();
    } catch (err) {
      console.error("Failed to save brand", err);
      toast.error(err?.response?.data?.message || "Unable to save brand. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this brand?")) return;
    setSaving(true);
    try {
      await deleteMobileBrand(id);
      toast.success("Brand deleted successfully");
      await loadBrands();
    } catch (err) {
      console.error("Failed to delete brand", err);
      toast.error(err?.response?.data?.message || "Unable to delete brand.");
    } finally {
      setSaving(false);
    }
  };

  const columns = useMemo(() => {
    const cols = [
      { key: "id", label: "ID", minWidth: "80px" },
      {
        key: "mobile_brand", label: "Brand Name",
        render: (row) => <span style={{ fontWeight: 700, color: "#0f172a" }}>{row.mobile_brand}</span>
      },
      {
        key: "for_code", label: "For Code",
        render: (row) => (
          <span style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "4px 10px",
            borderRadius: "9999px",
            fontSize: "12px",
            fontWeight: "700",
            background: row.for_code === "Yes" ? "#ecfdf5" : "#f1f5f9",
            color: row.for_code === "Yes" ? "#047857" : "#475569"
          }}>
            {row.for_code || "No"}
          </span>
        )
      }
    ];

    const canUpdate = hasPermission("mobile_brand_master", "update");
    const canDelete = hasPermission("mobile_brand_master", "delete");

    if (canUpdate || canDelete) {
      cols.push({
        key: "actions", label: "Actions", sortable: false, minWidth: "120px",
        render: (row) => (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {canUpdate && (
              <button
                onClick={() => {
                  setSelectedRow(row);
                  setIsModalOpen(true);
                }}
                style={{ display: "flex", width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 8, border: "1px solid #d8b4fe", background: "#f3e8ff", color: "#6804a1", cursor: "pointer" }}
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
                style={{ display: "flex", width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 8, border: "1px solid #fecdd3", background: "#fff1f2", color: "#be123c", cursor: "pointer" }}
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
  }, [saving, hasPermission]);

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, background: "#f8fafc", fontFamily: "'Inter',sans-serif" }}>
      <Navbar title="ERP Admin" />

      <BrandModal
        isOpen={isModalOpen}
        row={selectedRow}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedRow(null);
        }}
        onSave={handleSave}
        saving={saving}
      />

      <main style={{ flex: 1, display: "flex", flexDirection: "column", width: "100%", margin: "0 auto", padding: "32px 30px" }}>
        {error && (
          <div style={{ background: "#fff1f2", border: "1px solid #fecdd3", color: "#be123c", padding: "12px 16px", borderRadius: 10, marginBottom: 20, fontSize: 14, fontWeight: 500 }}>
            {error}
          </div>
        )}
        <DataTable
          tableId="mobile_brand_master"
          title="Brand Master"
          data={brands}
          columns={columns}
          loading={loading}
          searchPlaceholder="Search brands..."
          actionButton={
            hasPermission("mobile_brand_master", "write") ? (
              <button
                onClick={() => {
                  setSelectedRow(null);
                  setIsModalOpen(true);
                }}
                style={{ display: "flex", width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 9, background: "linear-gradient(135deg,#6804a1,#52037e)", color: "#fff", border: "none", cursor: "pointer", boxShadow: "0 2px 8px rgba(104,4,161,0.35)" }}
                title="Create Brand"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" style={{ width: 18, height: 18 }}>
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

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
  const [sharePercentage, setSharePercentage] = useState("");
  const [showInSpecialTva, setShowInSpecialTva] = useState(false);

  useEffect(() => {
    if (row) {
      setMobileBrand(row.mobile_brand || "");
      setForCode(row.for_code || "No");
      const isSpecial = Boolean(row.show_in_special_tva);
      setShowInSpecialTva(isSpecial);
      setSharePercentage(
        isSpecial && row.share_percentage !== undefined && row.share_percentage !== null
          ? row.share_percentage
          : ""
      );
    } else {
      setMobileBrand("");
      setForCode("No");
      setSharePercentage("");
      setShowInSpecialTva(false);
    }
  }, [row, isOpen]);

  if (!isOpen) return null;

  const isEdit = !!row;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!mobileBrand.trim()) return;
    let shareVal = 0;
    if (showInSpecialTva) {
      shareVal = sharePercentage !== "" ? parseFloat(sharePercentage) : 0;
      if (isNaN(shareVal) || shareVal <= 0 || shareVal > 100) {
        toast.error("Please enter a valid share percentage between 0.01 and 100");
        return;
      }
    }
    onSave(isEdit ? row.id : null, mobileBrand.trim(), forCode, shareVal, showInSpecialTva);
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-900/55 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-[18px] w-full max-w-[600px] mx-auto shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-3.5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-br from-indigo-600 to-indigo-700 shrink-0">
          <div>
            <h2 className="m-0 text-base sm:text-lg font-bold text-white">{isEdit ? "Edit Brand" : "Create Brand"}</h2>
            <p className="mt-0.5 text-xs text-indigo-100">{isEdit ? "Update brand details" : "Add a new brand to the system"}</p>
          </div>
          <button onClick={onClose} className="bg-white/15 border-none rounded-lg w-[32px] h-[32px] cursor-pointer flex items-center justify-center text-white hover:bg-white/20 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-[18px] h-[18px]">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="px-6 py-4 space-y-3.5 overflow-y-auto">
            {/* Brand Name */}
            <div>
              <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1.5">
                Brand Name <span className="text-rose-650">*</span>
              </label>
              <input
                type="text"
                value={mobileBrand}
                onChange={(e) => setMobileBrand(e.target.value)}
                required
                placeholder="e.g. Apple, Samsung, OnePlus"
                className="w-full border-[1.5px] border-slate-300 rounded-[9px] px-3.5 py-2 text-sm outline-none text-slate-800 focus:border-indigo-650 transition-colors"
              />
            </div>

            {/* For Code Selection (Compact Inline) */}
            <div className="flex items-center gap-4 bg-slate-50/80 px-3.5 py-2.5 rounded-lg border border-slate-200/60">
              <span className="text-xs font-bold text-slate-650 uppercase tracking-wider">
                For Code <span className="text-rose-650">*</span>:
              </span>
              <div className="flex gap-5 items-center">
                <label className="flex items-center gap-1.5 text-sm text-slate-800 cursor-pointer font-medium select-none">
                  <input
                    type="radio"
                    name="forCode"
                    checked={forCode === "Yes"}
                    onChange={() => setForCode("Yes")}
                    className="w-4 h-4 accent-indigo-650 cursor-pointer"
                  />
                  Yes
                </label>
                <label className="flex items-center gap-1.5 text-sm text-slate-800 cursor-pointer font-medium select-none">
                  <input
                    type="radio"
                    name="forCode"
                    checked={forCode === "No"}
                    onChange={() => setForCode("No")}
                    className="w-4 h-4 accent-indigo-650 cursor-pointer"
                  />
                  No
                </label>
              </div>
            </div>

            {/* Special TVA Settings Section */}
            <div className="pt-2 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-2">
                Special TVA Settings
              </label>
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 transition-all space-y-3">
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showInSpecialTva}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setShowInSpecialTva(checked);
                      if (!checked) {
                        setSharePercentage("");
                      }
                    }}
                    className="mt-0.5 w-[18px] h-[18px] rounded border-slate-300 text-indigo-650 accent-indigo-650 cursor-pointer"
                  />
                  <div>
                    <span className="text-sm font-semibold text-slate-800">
                      Show in special TVA report
                    </span>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Include this brand individually in the Special TVA report. Brands not selected will be grouped in &quot;Others&quot;.
                    </p>
                  </div>
                </label>

                {/* Conditional Share Percentage (%) only shown when checked */}
                {showInSpecialTva && (
                  <div className="pt-3 border-t border-slate-200/70">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Share Percentage (%) <span className="text-rose-650">*</span>
                    </label>
                    <div className="relative max-w-[240px]">
                      <input
                        type="number"
                        min="0.01"
                        max="100"
                        step="0.01"
                        value={sharePercentage}
                        onChange={(e) => setSharePercentage(e.target.value)}
                        required={showInSpecialTva}
                        placeholder="e.g. 40.00"
                        className="w-full border-[1.5px] border-slate-300 rounded-[9px] px-3.5 py-2 text-sm outline-none text-slate-800 focus:border-indigo-650 transition-colors pr-8 bg-white"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-xs select-none">
                        %
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Used in Special TVA to calculate this brand&apos;s individual target quantity.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="px-6 py-3 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 shrink-0">
            <button type="button" onClick={onClose} disabled={saving}
              className="px-4 py-1.5 rounded-lg border-[1.5px] border-slate-300 text-slate-600 bg-white font-semibold text-[13px] cursor-pointer hover:bg-slate-55 transition-colors disabled:opacity-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !mobileBrand.trim()}
              className="px-5 py-1.5 rounded-lg border-none text-white font-bold text-[13px] transition-all bg-gradient-to-br from-indigo-600 to-indigo-750 shadow-[0_2px_8px_rgba(104,4,161,0.35)] cursor-pointer disabled:bg-slate-400 disabled:cursor-not-allowed disabled:shadow-none hover:opacity-95">
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

  const handleSave = async (id, mobileBrand, forCode, sharePercentage, showInSpecialTva) => {
    setSaving(true);
    try {
      const payload = {
        mobileBrand,
        forCode,
        sharePercentage,
        showInSpecialTva,
        showIndividually: showInSpecialTva ? 1 : 0
      };
      if (id) {
        // Edit Mode
        await updateMobileBrand(id, payload);
        toast.success("Brand updated successfully");
      } else {
        // Create Mode
        await createMobileBrand(payload);
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
        render: (row) => <span className="font-bold text-slate-900">{row.mobile_brand}</span>
      },
      {
        key: "share_percentage", label: "Share %", minWidth: "110px",
        render: (row) => {
          if (!row.show_in_special_tva) {
            return <span className="text-slate-400 text-xs font-medium">—</span>;
          }
          const val = parseFloat(row.share_percentage) || 0;
          return (
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
              val > 0 
                ? "bg-indigo-50 text-indigo-700 border border-indigo-200" 
                : "bg-slate-100 text-slate-500"
            }`}>
              {val.toFixed(2)}%
            </span>
          );
        }
      },
      {
        key: "for_code", label: "For Code",
        render: (row) => (
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${row.for_code === "Yes" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
            {row.for_code || "No"}
          </span>
        )
      },
      {
        key: "show_in_special_tva",
        label: "Special TVA",
        minWidth: "130px",
        render: (row) => {
          const isSpecial = Boolean(row.show_in_special_tva);
          return (
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                isSpecial
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-amber-50 text-amber-700 border border-amber-200"
              }`}
            >
              {isSpecial ? "Individual" : "In Others"}
            </span>
          );
        }
      }
    ];

    const canUpdate = hasPermission("mobile_brand_master", "update");
    const canDelete = hasPermission("mobile_brand_master", "delete");

    if (canUpdate || canDelete) {
      cols.push({
        key: "actions", label: "Actions", sortable: false, minWidth: "120px",
        render: (row) => (
          <div className="flex items-center gap-2">
            {canUpdate && (
              <button
                onClick={() => {
                  setSelectedRow(row);
                  setIsModalOpen(true);
                }}
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
                className="flex w-8 h-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 cursor-pointer hover:bg-rose-100 transition-colors"
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
  }, [saving, hasPermission]);

  return (
    <div className="flex flex-col flex-1 bg-slate-50 font-sans">
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

      <main className="flex-1 flex flex-col w-full mx-auto px-[30px] py-8">
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-750 px-4 py-3 rounded-lg mb-5 text-sm font-medium">
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
                className="flex w-10 h-10 items-center justify-center rounded-[9px] bg-gradient-to-br from-indigo-650 to-indigo-750 text-white border-none cursor-pointer shadow-[0_2px_8px_rgba(104,4,161,0.35)] hover:opacity-95 transition-opacity"
                title="Create Brand"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-[18px] h-[18px]">
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

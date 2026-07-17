import { useState, useEffect, useMemo } from "react";
import Navbar from "../../components/Navbar";
import { getBranchBrandFinanceMappings, saveBranchBrandFinanceMappings } from "../../api/branchBrandFinanceMappingApi";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";

export default function FinanceBrandMappingDetail() {
  const navigate = useNavigate();
  const { branchId } = useParams();

  const [branch, setBranch] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [brands, setBrands] = useState([]);
  const [selectedMappings, setSelectedMappings] = useState(new Set());

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getBranchBrandFinanceMappings(branchId);
      if (res.data?.success) {
        const { branch, companies, brands, mappings } = res.data.data;
        setBranch(branch || null);
        setCompanies(companies || []);
        setBrands(brands || []);

        const initialSet = new Set();
        if (mappings && Array.isArray(mappings)) {
          mappings.forEach(m => {
            initialSet.add(`${m.brand_id}-${m.company_id}`);
          });
        }
        setSelectedMappings(initialSet);
      } else {
        toast.error("Failed to load details");
        navigate("/admin/finance-brand-mapping");
      }
    } catch (err) {
      console.error("Failed to load mappings:", err);
      toast.error("Failed to load brand-finance mapping details.");
      navigate("/admin/finance-brand-mapping");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [branchId]);

  const toggleMapping = (brandId, companyId) => {
    const key = `${brandId}-${companyId}`;
    setSelectedMappings(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const handleSelectAllForCompany = (companyId) => {
    setSelectedMappings(prev => {
      const newSet = new Set(prev);
      brands.forEach(b => {
        newSet.add(`${b.id}-${companyId}`);
      });
      return newSet;
    });
  };

  const handleClearAllForCompany = (companyId) => {
    setSelectedMappings(prev => {
      const newSet = new Set(prev);
      brands.forEach(b => {
        newSet.delete(`${b.id}-${companyId}`);
      });
      return newSet;
    });
  };

  const handleSelectAllForBrand = (brandId) => {
    setSelectedMappings(prev => {
      const newSet = new Set(prev);
      companies.forEach(c => {
        newSet.add(`${brandId}-${c.id}`);
      });
      return newSet;
    });
  };

  const handleClearAllForBrand = (brandId) => {
    setSelectedMappings(prev => {
      const newSet = new Set(prev);
      companies.forEach(c => {
        newSet.delete(`${brandId}-${c.id}`);
      });
      return newSet;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const mappingsPayload = Array.from(selectedMappings).map(key => {
        const [brand_id, company_id] = key.split('-').map(Number);
        return { brand_id, company_id };
      });

      const res = await saveBranchBrandFinanceMappings(branchId, mappingsPayload);
      if (res.data?.success) {
        toast.success("Finance Brand Mappings saved successfully!");
        setTimeout(() => {
          navigate("/admin/finance-brand-mapping");
        }, 1000);
      } else {
        toast.error(res.data?.message || "Failed to save mappings.");
      }
    } catch (err) {
      console.error("Failed to save mappings:", err);
      toast.error(err?.response?.data?.message || "Failed to save mappings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 bg-gradient-to-br from-slate-50 to-indigo-50 font-sans">
      <Navbar title="ERP Admin" />

      <main className="flex-1 flex flex-col w-full max-w-[1200px] mx-auto px-[30px] py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-7">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 m-0">
              Finance Brand Mapping Details
            </h1>
            <p className="text-slate-500 mt-1 text-sm">
              Configure brand mappings for each finance company at this branch.
            </p>
          </div>
          <button
            onClick={() => navigate("/admin/finance-brand-mapping")}
            className="flex items-center gap-1.5 text-slate-500 bg-none border-none cursor-pointer text-sm font-medium hover:text-slate-700 transition-colors focus:outline-none"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back to Mappings
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-[100px]">
            <span className="text-base text-slate-600 font-semibold animate-pulse">Loading configurations...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-7">
            {/* Branch Details Card */}
            {branch && (
              <div className="bg-white border border-slate-200 rounded-xl p-7 shadow-sm">
                <h2 className="text-[13px] font-bold text-slate-600 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2.5">
                  Branch Information
                </h2>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-5">
                  <div>
                    <span className="block text-xs text-slate-400 font-semibold mb-1">Branch Name</span>
                    <span className="text-[15px] font-bold text-indigo-950">{branch.name}</span>
                  </div>
                  <div>
                    <span className="block text-xs text-slate-400 font-semibold mb-1">Branch Code</span>
                    <span className="text-[15px] font-bold text-indigo-950 font-mono">{branch.code}</span>
                  </div>
                  <div>
                    <span className="block text-xs text-slate-400 font-semibold mb-1">Store Type</span>
                    <span className="inline-block px-2.5 py-0.5 rounded text-xs font-bold uppercase bg-slate-100 text-slate-700 mt-0.5">
                      {branch.store_type}
                    </span>
                  </div>
                  <div>
                    <span className="block text-xs text-slate-400 font-semibold mb-1">State</span>
                    <span className="text-[15px] font-bold text-indigo-950">{branch.state_name || "—"}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Mappings Configurations Card */}
            <div className="bg-white border border-slate-200 rounded-xl p-7 shadow-sm">
              <h2 className="text-[13px] font-bold text-slate-600 uppercase tracking-wider mb-5 border-b border-slate-100 pb-2.5">
                Finance Companies & Brands Mappings
              </h2>

              {brands.length === 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800 text-sm font-medium">
                  No active brands found in Brand Master with <strong>For Code: Yes</strong>. Please define them first in Mobile Brand Master.
                </div>
              ) : companies.length === 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800 text-sm font-medium">
                  No finance companies found. Please add them in Bank/Finance Company Master first.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full border-collapse bg-white">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-6 py-4 text-left text-xs font-bold text-[#6804a1] uppercase tracking-wider w-1/4" rowSpan={2}>
                          FINANCE COMPANY
                        </th>
                        <th className="px-6 py-2 text-center text-xs font-bold text-[#6804a1] uppercase tracking-wider" colSpan={brands.length}>
                          BRAND
                        </th>
                      </tr>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        {brands.map(brand => (
                          <th key={brand.id} className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider min-w-[120px] border-l border-slate-100">
                            <div className="flex flex-col items-center gap-1">
                              <span className="font-bold text-slate-700">{brand.mobile_brand}</span>
                              <div className="flex items-center gap-1.5 text-[10px] font-bold">
                                <button
                                  type="button"
                                  onClick={() => handleSelectAllForBrand(brand.id)}
                                  className="text-[#6804a1] hover:underline cursor-pointer border-none bg-transparent p-0 font-bold"
                                >
                                  All
                                </button>
                                <span className="text-slate-300">|</span>
                                <button
                                  type="button"
                                  onClick={() => handleClearAllForBrand(brand.id)}
                                  className="text-slate-450 hover:underline cursor-pointer border-none bg-transparent p-0 font-bold"
                                >
                                  None
                                </button>
                              </div>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {companies.map(company => (
                        <tr key={company.id} className="hover:bg-slate-50/55 transition-colors duration-100">
                          <td className="px-6 py-4 align-middle">
                            <div className="flex items-center justify-between gap-4">
                              <span className="font-bold text-slate-700 text-[15px]">{company.bank_card_name}</span>
                              <div className="flex items-center gap-1.5 text-[10px] font-bold">
                                <button
                                  type="button"
                                  onClick={() => handleSelectAllForCompany(company.id)}
                                  className="text-[#6804a1] hover:underline cursor-pointer border-none bg-transparent p-0 font-bold focus:outline-none"
                                >
                                  All
                                </button>
                                <span className="text-slate-300">/</span>
                                <button
                                  type="button"
                                  onClick={() => handleClearAllForCompany(company.id)}
                                  className="text-slate-450 hover:underline cursor-pointer border-none bg-transparent p-0 font-bold focus:outline-none"
                                >
                                  None
                                </button>
                              </div>
                            </div>
                          </td>
                          {brands.map(brand => {
                            const isChecked = selectedMappings.has(`${brand.id}-${company.id}`);
                            return (
                              <td key={brand.id} className="px-4 py-4 text-center align-middle border-l border-slate-100">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleMapping(brand.id, company.id)}
                                  className="w-[18px] h-[18px] accent-[#6804a1] border border-slate-300 rounded cursor-pointer mx-auto transition-transform active:scale-95"
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Actions Footer */}
            <div className="flex justify-end gap-3 py-5 border-t border-slate-200">
              <button
                type="button"
                onClick={() => navigate("/admin/finance-brand-mapping")}
                className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-600 bg-white font-semibold text-sm cursor-pointer hover:bg-slate-50 transition-colors focus:outline-none"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || brands.length === 0 || companies.length === 0}
                className="px-6 py-2.5 rounded-lg border-none text-white font-bold text-sm bg-gradient-to-br from-indigo-600 to-indigo-700 shadow-[0_2px_8px_rgba(99,102,241,0.35)] cursor-pointer disabled:bg-slate-400 disabled:cursor-not-allowed disabled:shadow-none hover:opacity-95 transition-all focus:outline-none"
              >
                {saving ? "Saving..." : "Save Mappings"}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}

import { useState, useEffect } from "react";
import Navbar from "../../components/Navbar";
import { getBranchFinanceCodes, saveBranchFinanceCodes } from "../../api/branchApi";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";

export default function BranchFinanceCode() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [branch, setBranch] = useState(null);
  const [brands, setBrands] = useState([]);
  const [machines, setMachines] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [details, setDetails] = useState({
    qr_code_id_password: "",
    remarks: ""
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getBranchFinanceCodes(id);
      if (res.data?.success) {
        const payloadData = res.data.data;
        setBranch(payloadData.branch || null);
        setBrands(payloadData.brands || []);
        setMachines(payloadData.machines || []);
        setCompanies(payloadData.companies || []);
        setDetails(payloadData.details || { qr_code_id_password: "", remarks: "" });
      } else {
        toast.error("Failed to load details");
        navigate("/admin/branches");
      }
    } catch (err) {
      console.error("Failed to load branch finance codes:", err);
      toast.error("Failed to load branch finance codes.");
      navigate("/admin/branches");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        brands: brands.filter(b => b.brand_code && b.brand_code.trim()),
        machines: machines.filter(m => (m.tid && m.tid.trim()) || (m.pos_id && m.pos_id.trim()) || (m.serial_no && m.serial_no.trim())),
        companies: companies.filter(c => c.company_code && c.company_code.trim()),
        details
      };

      const res = await saveBranchFinanceCodes(id, payload);
      if (res.data?.success) {
        toast.success("Branch finance codes saved successfully!");
        setTimeout(() => {
          navigate("/admin/branches");
        }, 1000);
      } else {
        toast.error(res.data?.message || "Failed to save branch finance codes.");
      }
    } catch (err) {
      console.error("Failed to save branch finance codes:", err);
      toast.error(err?.response?.data?.message || "Failed to save branch finance codes.");
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
              Branch Finance Code
            </h1>
            <p className="text-slate-500 mt-1 text-sm">
              Manage brand codes, machine mappings, and finance company configurations.
            </p>
          </div>
          <button
            onClick={() => navigate("/admin/branches")}
            className="flex items-center gap-1.5 text-slate-500 bg-none border-none cursor-pointer text-sm font-medium hover:text-slate-700 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back to Branch List
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-[100px]">
            <span className="text-base text-slate-600 font-semibold">Loading finance code configurations...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-7">
            
            {/* Branch Details Card */}
            {branch && (
              <div className="bg-white border border-slate-200 rounded-xl p-7 shadow-sm">
                <h2 className="text-[13px] font-bold text-slate-600 uppercase tracking-wider mb-3.5 border-b border-slate-100 pb-2">
                  Branch Details & Credentials
                </h2>
                
                {/* Branch Info Row (Read-only) */}
                <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-5 mb-6">
                  <div>
                    <span className="block text-xs text-slate-400 font-medium">Name</span>
                    <span className="text-[15px] font-bold text-slate-800">{branch.name}</span>
                  </div>
                  <div>
                    <span className="block text-xs text-slate-400 font-medium">Code</span>
                    <span className="text-[15px] font-bold text-slate-800">{branch.code}</span>
                  </div>
                  <div>
                    <span className="block text-xs text-slate-400 font-medium">Phone</span>
                    <span className="text-[15px] font-bold text-slate-800">{branch.phone}</span>
                  </div>
                  <div>
                    <span className="block text-xs text-slate-400 font-medium">Email</span>
                    <span className="text-[15px] font-bold text-slate-800">{branch.email}</span>
                  </div>
                </div>

                {/* QR Code and Remarks (Editable) */}
                <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-5 border-t-[1.5px] border-slate-100 pt-6">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      QR Code ID & Password
                    </label>
                    <input
                      type="text"
                      value={details.qr_code_id_password}
                      onChange={(e) => setDetails(prev => ({ ...prev, qr_code_id_password: e.target.value }))}
                      placeholder="Enter QR Code credentials (e.g. ID: test_id / Pwd: test_pwd)"
                      className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm outline-none text-slate-800 focus:border-indigo-650 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Remarks
                    </label>
                    <textarea
                      value={details.remarks}
                      onChange={(e) => setDetails(prev => ({ ...prev, remarks: e.target.value }))}
                      placeholder="Add any additional remarks or notes here..."
                      rows={2}
                      className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm outline-none text-slate-800 resize-none font-sans focus:border-indigo-650 transition-colors"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Section 1. Brand Codes */}
            <div className="bg-white border border-slate-200 rounded-xl p-7 shadow-sm">
              <h3 className="text-sm font-bold text-slate-800 mb-5 flex items-center gap-2">
                <span className="w-1 h-4 bg-indigo-600 rounded-[2px]"></span>
                1. Brand Codes
              </h3>
              {brands.length === 0 ? (
                <p className="text-[13px] italic text-slate-400">No brands defined in Brand Master.</p>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-5">
                  {brands.map((b, idx) => (
                    <div key={b.brand_id} className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white">
                      <div className="w-[120px] bg-slate-50 py-3 px-4 border-r border-slate-200 font-bold text-xs text-slate-600 uppercase tracking-wider text-center flex-shrink-0">
                        {b.brand_name}
                      </div>
                      <div className="flex-1 p-2">
                        <input
                          type="text"
                          value={b.brand_code}
                          onChange={(e) => {
                            const val = e.target.value;
                            setBrands(prev => prev.map((item, i) => i === idx ? { ...item, brand_code: val } : item));
                          }}
                          placeholder={`Enter ${b.brand_name} code`}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none text-slate-800 focus:border-indigo-650 transition-colors"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 2. Finance Machine Details */}
            <div className="bg-white border border-slate-200 rounded-xl p-7 shadow-sm">
              <h3 className="text-sm font-bold text-slate-800 mb-5 flex items-center gap-2">
                <span className="w-1 h-4 bg-indigo-600 rounded-[2px]"></span>
                2. Finance Machine Details
              </h3>
              {machines.length === 0 ? (
                <p className="text-[13px] italic text-slate-400">No machines defined in Finance Machine Master.</p>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse min-w-[600px] bg-white">
                      <thead>
                        <tr className="bg-slate-50 border-b-[1.5px] border-slate-300">
                          <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-550 uppercase tracking-wider">Finance Machine</th>
                          <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-550 uppercase tracking-wider">TID</th>
                          <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-550 uppercase tracking-wider">POS ID</th>
                          <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-550 uppercase tracking-wider">Serial NO</th>
                        </tr>
                      </thead>
                      <tbody>
                        {machines.map((m, idx) => (
                          <tr key={m.machine_id} className="border-b border-slate-100 last:border-b-0">
                            <td className="px-4 py-3 font-bold text-sm text-slate-650 bg-slate-50/50 w-[250px]">
                              {m.machine_name}
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={m.tid}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setMachines(prev => prev.map((item, i) => i === idx ? { ...item, tid: val } : item));
                                }}
                                placeholder="Enter TID"
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none text-slate-800 focus:border-indigo-650 transition-colors"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={m.pos_id}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setMachines(prev => prev.map((item, i) => i === idx ? { ...item, pos_id: val } : item));
                                }}
                                placeholder="Enter POS ID"
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none text-slate-800 focus:border-indigo-650 transition-colors"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={m.serial_no}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setMachines(prev => prev.map((item, i) => i === idx ? { ...item, serial_no: val } : item));
                                }}
                                placeholder="Enter Serial NO"
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none text-slate-800 focus:border-indigo-650 transition-colors"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Section 3. Finance Company Codes */}
            <div className="bg-white border border-slate-200 rounded-xl p-7 shadow-sm">
              <h3 className="text-sm font-bold text-slate-800 mb-5 flex items-center gap-2">
                <span className="w-1 h-4 bg-indigo-600 rounded-[2px]"></span>
                3. Finance Company Codes
              </h3>
              {companies.length === 0 ? (
                <p className="text-[13px] italic text-slate-400">No finance companies defined in Finance Company Master.</p>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-5">
                  {companies.map((c, idx) => (
                    <div key={c.company_id} className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white">
                      <div className="w-[140px] bg-slate-50 py-3 px-4 border-r border-slate-200 font-bold text-xs text-slate-650 uppercase tracking-wider text-center flex-shrink-0">
                        {c.company_name}
                      </div>
                      <div className="flex-1 p-2">
                        <input
                          type="text"
                          value={c.company_code}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCompanies(prev => prev.map((item, i) => i === idx ? { ...item, company_code: val } : item));
                          }}
                          placeholder={`Enter ${c.company_name} code`}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none text-slate-800 focus:border-indigo-650 transition-colors"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions Footer */}
            <div className="flex justify-end gap-3 py-5 border-t border-slate-200">
              <button
                type="button"
                onClick={() => navigate("/admin/branches")}
                className="px-5.5 py-2.5 rounded-[9px] border-[1.5px] border-slate-300 text-slate-600 bg-white font-semibold text-sm cursor-pointer hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-7 py-2.5 rounded-[9px] border-none text-white font-bold text-sm bg-gradient-to-br from-indigo-600 to-indigo-700 shadow-[0_2px_8px_rgba(104,4,161,0.35)] cursor-pointer disabled:bg-slate-400 disabled:cursor-not-allowed disabled:shadow-none hover:opacity-95 transition-all"
              >
                {saving ? "Saving..." : "Save Branch Finance Codes"}
              </button>
            </div>

          </form>
        )}
      </main>
    </div>
  );
}

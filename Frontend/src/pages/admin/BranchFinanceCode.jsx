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
    <div style={{ display: "flex", flexDirection: "column", flex: 1, background: "linear-gradient(135deg,#f8fafc 0%,#eef2ff 100%)", fontFamily: "'Inter',sans-serif" }}>
      <Navbar title="ERP Admin" />

      <main style={{ flex: 1, display: "flex", flexDirection: "column", width: "100%", maxWidth: 1200, margin: "0 auto", padding: "32px 30px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1e293b", margin: 0 }}>
              Branch Finance Code
            </h1>
            <p style={{ color: "#64748b", marginTop: 4, fontSize: 14 }}>
              Manage brand codes, machine mappings, and finance company configurations.
            </p>
          </div>
          <button
            onClick={() => navigate("/admin/branches")}
            style={{ display: "flex", alignItems: "center", gap: 6, color: "#64748b", background: "none", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 500 }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: 16, height: 16 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back to Branch List
          </button>
        </div>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "100px 0" }}>
            <span style={{ fontSize: 16, color: "#475569", fontWeight: 600 }}>Loading finance code configurations...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
            
            {/* Branch Details Card */}
            {branch && (
              <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "28px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <h2 style={{ fontSize: 13, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 14, borderBottom: "1px solid #f1f5f9", paddingBottom: 8 }}>
                  Branch Details & Credentials
                </h2>
                
                {/* Branch Info Row (Read-only) */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20, marginBottom: 24 }}>
                  <div>
                    <span style={{ display: "block", fontSize: 12, color: "#94a3b8", fontWeight: 500 }}>Name</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>{branch.name}</span>
                  </div>
                  <div>
                    <span style={{ display: "block", fontSize: 12, color: "#94a3b8", fontWeight: 500 }}>Code</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>{branch.code}</span>
                  </div>
                  <div>
                    <span style={{ display: "block", fontSize: 12, color: "#94a3b8", fontWeight: 500 }}>Phone</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>{branch.phone}</span>
                  </div>
                  <div>
                    <span style={{ display: "block", fontSize: 12, color: "#94a3b8", fontWeight: 500 }}>Email</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>{branch.email}</span>
                  </div>
                </div>

                {/* QR Code and Remarks (Editable) */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, borderTop: "1.5px solid #f1f5f9", paddingTop: 24 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                      QR Code ID & Password
                    </label>
                    <input
                      type="text"
                      value={details.qr_code_id_password}
                      onChange={(e) => setDetails(prev => ({ ...prev, qr_code_id_password: e.target.value }))}
                      placeholder="Enter QR Code credentials (e.g. ID: test_id / Pwd: test_pwd)"
                      style={{ width: "100%", border: "1px solid #cbd5e1", borderRadius: 8, padding: "10px 14px", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                      onFocus={e => e.target.style.borderColor = "#6804a1"}
                      onBlur={e => e.target.style.borderColor = "#cbd5e1"}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                      Remarks
                    </label>
                    <textarea
                      value={details.remarks}
                      onChange={(e) => setDetails(prev => ({ ...prev, remarks: e.target.value }))}
                      placeholder="Add any additional remarks or notes here..."
                      rows={2}
                      style={{ width: "100%", border: "1px solid #cbd5e1", borderRadius: 8, padding: "10px 14px", fontSize: 14, outline: "none", boxSizing: "border-box", resize: "none", fontFamily: "inherit" }}
                      onFocus={e => e.target.style.borderColor = "#6804a1"}
                      onBlur={e => e.target.style.borderColor = "#cbd5e1"}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Section 1. Brand Codes */}
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "28px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 4, height: 16, background: "#6804a1", borderRadius: 2 }}></span>
                1. Brand Codes
              </h3>
              {brands.length === 0 ? (
                <p style={{ fontSize: 13, fontStyle: "italic", color: "#94a3b8" }}>No brands defined in Brand Master.</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
                  {brands.map((b, idx) => (
                    <div key={b.brand_id} style={{ display: "flex", alignItems: "center", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
                      <div style={{ width: "120px", background: "#f8fafc", padding: "12px 16px", borderRight: "1px solid #e2e8f0", fontWeight: 700, fontSize: 12, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center" }}>
                        {b.brand_name}
                      </div>
                      <div style={{ flex: 1, padding: 8 }}>
                        <input
                          type="text"
                          value={b.brand_code}
                          onChange={(e) => {
                            const val = e.target.value;
                            setBrands(prev => prev.map((item, i) => i === idx ? { ...item, brand_code: val } : item));
                          }}
                          placeholder={`Enter ${b.brand_name} code`}
                          style={{ width: "100%", border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 12px", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                          onFocus={e => e.target.style.borderColor = "#6804a1"}
                          onBlur={e => e.target.style.borderColor = "#cbd5e1"}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 2. Finance Machine Details */}
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "28px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 4, height: 16, background: "#6804a1", borderRadius: 2 }}></span>
                2. Finance Machine Details
              </h3>
              {machines.length === 0 ? (
                <p style={{ fontSize: 13, fontStyle: "italic", color: "#94a3b8" }}>No machines defined in Finance Machine Master.</p>
              ) : (
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
                      <thead>
                        <tr style={{ background: "#f8fafc", borderBottom: "1.5px solid #cbd5e1" }}>
                          <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>Finance Machine</th>
                          <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>TID</th>
                          <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>POS ID</th>
                          <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>Serial NO</th>
                        </tr>
                      </thead>
                      <tbody>
                        {machines.map((m, idx) => (
                          <tr key={m.machine_id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "12px 16px", fontWeight: 700, fontSize: 13, color: "#334155", background: "#fafafa", width: "250px" }}>
                              {m.machine_name}
                            </td>
                            <td style={{ padding: "8px 12px" }}>
                              <input
                                type="text"
                                value={m.tid}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setMachines(prev => prev.map((item, i) => i === idx ? { ...item, tid: val } : item));
                                }}
                                placeholder="Enter TID"
                                style={{ width: "100%", border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 12px", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                                onFocus={e => e.target.style.borderColor = "#6804a1"}
                                onBlur={e => e.target.style.borderColor = "#cbd5e1"}
                              />
                            </td>
                            <td style={{ padding: "8px 12px" }}>
                              <input
                                type="text"
                                value={m.pos_id}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setMachines(prev => prev.map((item, i) => i === idx ? { ...item, pos_id: val } : item));
                                }}
                                placeholder="Enter POS ID"
                                style={{ width: "100%", border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 12px", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                                onFocus={e => e.target.style.borderColor = "#6804a1"}
                                onBlur={e => e.target.style.borderColor = "#cbd5e1"}
                              />
                            </td>
                            <td style={{ padding: "8px 12px" }}>
                              <input
                                type="text"
                                value={m.serial_no}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setMachines(prev => prev.map((item, i) => i === idx ? { ...item, serial_no: val } : item));
                                }}
                                placeholder="Enter Serial NO"
                                style={{ width: "100%", border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 12px", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                                onFocus={e => e.target.style.borderColor = "#6804a1"}
                                onBlur={e => e.target.style.borderColor = "#cbd5e1"}
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
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "28px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 4, height: 16, background: "#6804a1", borderRadius: 2 }}></span>
                3. Finance Company Codes
              </h3>
              {companies.length === 0 ? (
                <p style={{ fontSize: 13, fontStyle: "italic", color: "#94a3b8" }}>No finance companies defined in Finance Company Master.</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
                  {companies.map((c, idx) => (
                    <div key={c.company_id} style={{ display: "flex", alignItems: "center", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
                      <div style={{ width: "140px", background: "#f8fafc", padding: "12px 16px", borderRight: "1px solid #e2e8f0", fontWeight: 700, fontSize: 12, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center" }}>
                        {c.company_name}
                      </div>
                      <div style={{ flex: 1, padding: 8 }}>
                        <input
                          type="text"
                          value={c.company_code}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCompanies(prev => prev.map((item, i) => i === idx ? { ...item, company_code: val } : item));
                          }}
                          placeholder={`Enter ${c.company_name} code`}
                          style={{ width: "100%", border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 12px", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                          onFocus={e => e.target.style.borderColor = "#6804a1"}
                          onBlur={e => e.target.style.borderColor = "#cbd5e1"}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions Footer */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, padding: "20px 0", borderTop: "1px solid #e2e8f0" }}>
              <button
                type="button"
                onClick={() => navigate("/admin/branches")}
                style={{
                  padding: "10px 22px", borderRadius: 9, border: "1.5px solid #cbd5e1",
                  color: "#475569", background: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer",
                  transition: "background 0.15s"
                }}
                onMouseEnter={e => e.target.style.background = "#f8fafc"}
                onMouseLeave={e => e.target.style.background = "#fff"}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                style={{
                  padding: "10px 28px", borderRadius: 9, border: "none",
                  background: saving ? "#94a3b8" : "linear-gradient(135deg,#6804a1,#52037e)",
                  color: "#fff", fontWeight: 700, fontSize: 14, cursor: saving ? "not-allowed" : "pointer",
                  boxShadow: saving ? "none" : "0 2px 8px rgba(104,4,161,0.35)",
                  transition: "all 0.2s"
                }}
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

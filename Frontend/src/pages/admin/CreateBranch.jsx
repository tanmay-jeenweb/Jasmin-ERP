import { useState, useEffect } from "react";
import Navbar from "../../components/Navbar";
import { getBranches, createBranch, updateBranch } from "../../api/branchApi";
import { getStates } from "../../api/stateApi";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";

export default function CreateBranch() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;

  const [states, setStates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    phone: "",
    email: "",
    pincode: "",
    GSTIN: "",
    opened_on: "",
    store_type: "branch",
    state_id: "",
    city: "",
    address: "",
    abm: "",
    status: "active"
  });

  const loadStates = async () => {
    try {
      const res = await getStates();
      setStates(res.data.data || []);
    } catch (err) {
      console.error("Failed to load states:", err);
      toast.error("Failed to load state options.");
    }
  };

  const loadBranchDetails = async () => {
    if (!isEdit) return;
    setLoading(true);
    try {
      const res = await getBranches();
      const allBranches = res.data.data || [];
      const branch = allBranches.find(b => String(b.id) === String(id));
      if (branch) {
        let formattedDate = "";
        if (branch.opened_on) {
          const dateObj = new Date(branch.opened_on);
          if (!isNaN(dateObj.getTime())) {
            formattedDate = dateObj.toISOString().split("T")[0];
          }
        }
        setFormData({
          name: branch.name || "",
          code: branch.code || "",
          phone: branch.phone || "",
          email: branch.email || "",
          pincode: branch.pincode || "",
          GSTIN: branch.GSTIN || "",
          opened_on: formattedDate,
          store_type: branch.store_type || "branch",
          state_id: branch.state_id || "",
          city: branch.city || "",
          address: branch.address || "",
          abm: branch.abm || "",
          status: branch.status || "active"
        });
      } else {
        toast.error("Branch not found");
        navigate("/admin/branches");
      }
    } catch (err) {
      console.error("Failed to load branch details:", err);
      toast.error("Failed to load branch details.");
      navigate("/admin/branches");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStates();
    loadBranchDetails();
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.state_id) {
      toast.error("Please select a state");
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await updateBranch(id, formData);
        toast.success("Branch details updated successfully");
      } else {
        await createBranch(formData);
        toast.success("Branch created successfully");
      }
      setTimeout(() => {
        navigate("/admin/branches");
      }, 1000);
    } catch (err) {
      console.error("Failed to save branch:", err);
      toast.error(err?.response?.data?.message || "Failed to save branch details.");
    } finally {
      setSaving(false);
    }
  };

  const formFields = [
    { label: "Branch Name", name: "name", type: "text", required: true, placeholder: "e.g. Mumbai Corporate Office" },
    { label: "Branch Code", name: "code", type: "text", required: true, placeholder: "e.g. MUM01" },
    { label: "Phone Number", name: "phone", type: "tel", required: true, placeholder: "e.g. 9876543210" },
    { label: "Email Address", name: "email", type: "email", required: true, placeholder: "e.g. mumbai@erp.com" },
    { label: "Pincode", name: "pincode", type: "text", required: true, placeholder: "e.g. 400001" },
    { label: "GSTIN", name: "GSTIN", type: "text", required: true, placeholder: "e.g. 27AAAAA1111A1Z1" },
    { label: "Opened On", name: "opened_on", type: "date", required: true },
    { label: "Store Type", name: "store_type", type: "select", required: true, options: [{ value: "branch", label: "Branch" }, { value: "franchise", label: "Franchise" }] },
    { label: "State", name: "state_id", type: "select", required: true, options: states.map(s => ({ value: s.id, label: s.name })), prompt: "Select a State" },
    { label: "City", name: "city", type: "text", required: true, placeholder: "e.g. Mumbai" },
    { label: "Area Branch Manager (ABM)", name: "abm", type: "text", required: true, placeholder: "e.g. Rajesh Kumar" },
    { label: "Status", name: "status", type: "select", required: true, options: [{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }] },
    { label: "Address", name: "address", type: "textarea", required: true, placeholder: "Full office/store address...", fullWidth: true }
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, background: "linear-gradient(135deg,#f8fafc 0%,#eef2ff 100%)", fontFamily: "'Inter',sans-serif" }}>
      <Navbar title="ERP Admin" />

      <main className="flex-1 flex flex-col w-full max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1e293b", margin: 0 }}>
              {isEdit ? "Edit Branch Details" : "Create New Branch"}
            </h1>
            <p style={{ color: "#64748b", marginTop: 4, fontSize: 14 }}>
              {isEdit ? "Modify existing branch master attributes." : "Add a new branch location to the ERP system."}
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
            <span style={{ fontSize: 16, color: "#475569", fontWeight: 600 }}>Loading branch details...</span>
          </div>
        ) : (
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "32px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "24px" }}>
                {formFields.map((f) => {
                  const gridColumn = f.fullWidth ? "span 2" : "span 1";
                  return (
                    <div key={f.name} style={{ gridColumn: f.fullWidth ? "1 / -1" : "auto" }}>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                        {f.label} {f.required && <span style={{ color: "#e11d48" }}>*</span>}
                      </label>
                      {f.type === "textarea" ? (
                        <textarea
                          name={f.name}
                          value={formData[f.name]}
                          onChange={handleChange}
                          required={f.required}
                          placeholder={f.placeholder}
                          rows={4}
                          style={{ width: "100%", boxSizing: "border-box", border: "1.5px solid #cbd5e1", borderRadius: 9, padding: "11px 14px", fontSize: 14, outline: "none", color: "#1e293b", fontFamily: "inherit", resize: "none" }}
                          onFocus={e => e.target.style.borderColor = "#6804a1"}
                          onBlur={e => e.target.style.borderColor = "#cbd5e1"}
                        />
                      ) : f.type === "select" ? (
                        <select
                          name={f.name}
                          value={formData[f.name]}
                          onChange={handleChange}
                          required={f.required}
                          style={{ width: "100%", boxSizing: "border-box", border: "1.5px solid #cbd5e1", borderRadius: 9, padding: "11px 14px", fontSize: 14, outline: "none", color: "#1e293b", background: "#fff" }}
                          onFocus={e => e.target.style.borderColor = "#6804a1"}
                          onBlur={e => e.target.style.borderColor = "#cbd5e1"}
                        >
                          {f.prompt && <option value="">{f.prompt}</option>}
                          {f.options.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={f.type}
                          name={f.name}
                          value={formData[f.name]}
                          onChange={handleChange}
                          required={f.required}
                          placeholder={f.placeholder}
                          style={{ width: "100%", boxSizing: "border-box", border: "1.5px solid #cbd5e1", borderRadius: 9, padding: "11px 14px", fontSize: 14, outline: "none", color: "#1e293b" }}
                          onFocus={e => e.target.style.borderColor = "#6804a1"}
                          onBlur={e => e.target.style.borderColor = "#cbd5e1"}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Actions */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 12, paddingTop: 20, borderTop: "1px solid #f1f5f9" }}>
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
                  {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Branch"}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}

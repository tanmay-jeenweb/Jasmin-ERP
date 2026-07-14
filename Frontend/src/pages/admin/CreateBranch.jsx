import { useState, useEffect } from "react";
import Navbar from "../../components/Navbar";
import { getBranches, createBranch, updateBranch, getEligibleAbms } from "../../api/branchApi";
import { getStates } from "../../api/stateApi";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";

export default function CreateBranch() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;

  const [states, setStates] = useState([]);
  const [abms, setAbms] = useState([]);
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

  const loadAbms = async () => {
    try {
      const res = await getEligibleAbms();
      setAbms(res.data.data || []);
    } catch (err) {
      console.error("Failed to load ABM options:", err);
      toast.error("Failed to load ABM options.");
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
    loadAbms();
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
    { label: "Area Branch Manager (ABM)", name: "abm", type: "select", required: true, options: abms.map(u => ({ value: u.name, label: `${u.name} (${u.username})` })), prompt: "Select an ABM" },
    { label: "Status", name: "status", type: "select", required: true, options: [{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }] },
    { label: "Address", name: "address", type: "textarea", required: true, placeholder: "Full office/store address...", fullWidth: true }
  ];

  return (
    <div className="flex flex-col flex-1 bg-gradient-to-br from-slate-50 to-indigo-50 font-sans">
      <Navbar title="ERP Admin" />

      <main className="flex-1 flex flex-col w-full max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-7">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 m-0">
              {isEdit ? "Edit Branch Details" : "Create New Branch"}
            </h1>
            <p className="text-slate-500 mt-1 text-sm">
              {isEdit ? "Modify existing branch master attributes." : "Add a new branch location to the ERP system."}
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
            <span className="text-base text-slate-600 font-semibold">Loading branch details...</span>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-6">
                {formFields.map((f) => {
                  return (
                    <div key={f.name} className={f.fullWidth ? "col-span-full" : ""}>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                        {f.label} {f.required && <span className="text-rose-600">*</span>}
                      </label>
                      {f.type === "textarea" ? (
                        <textarea
                          name={f.name}
                          value={formData[f.name]}
                          onChange={handleChange}
                          required={f.required}
                          placeholder={f.placeholder}
                          rows={4}
                          className="w-full border-[1.5px] border-slate-300 rounded-[9px] px-3.5 py-[11px] text-sm outline-none text-slate-800 font-sans resize-none focus:border-indigo-650 transition-colors"
                        />
                      ) : f.type === "select" ? (
                        <select
                          name={f.name}
                          value={formData[f.name]}
                          onChange={handleChange}
                          required={f.required}
                          className="w-full border-[1.5px] border-slate-300 rounded-[9px] px-3.5 py-[11px] text-sm outline-none text-slate-800 bg-white focus:border-indigo-650 transition-colors"
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
                          className="w-full border-[1.5px] border-slate-300 rounded-[9px] px-3.5 py-[11px] text-sm outline-none text-slate-800 focus:border-indigo-650 transition-colors"
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 mt-3 pt-5 border-t border-slate-100">
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

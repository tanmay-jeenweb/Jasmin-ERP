import { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Navbar from "../../components/Navbar";
import { getOfferById, createOffer, updateOffer } from "../../api/offerApi";
import { getModelGroups } from "../../api/modelGroupApi";
import { getStates } from "../../api/stateApi";
import toast from "react-hot-toast";

export default function OfferForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;

  // Main Fields
  const [brand_name, setBrandName] = useState("");
  const [selectedModelGroups, setSelectedModelGroups] = useState([]);
  const [state_id, setStateId] = useState("");
  const [offer_type, setOfferType] = useState("Cashback Offer");
  const [from_date, setFromDate] = useState("");
  const [to_date, setToDate] = useState("");

  // Dynamic transaction rows
  const [transactions, setTransactions] = useState([
    {
      transaction_type: "Cash Transaction",
      value_type: "In Rs.",
      offer_type_value: "",
      upto_value: "",
      offer_text: "",
      relative_offer: ""
    }
  ]);

  // Dropdown options lists
  const [modelGroupsList, setModelGroupsList] = useState([]);
  const [statesList, setStatesList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Model group search filter
  const [modelGroupSearch, setModelGroupSearch] = useState("");

  // Fetch dropdown data on mount
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [mgRes, stateRes] = await Promise.all([
          getModelGroups(),
          getStates()
        ]);
        setModelGroupsList(mgRes.data.data || []);
        setStatesList((stateRes.data.data || []).filter(s => s.live === "Yes"));

        // If in edit mode, fetch detailed offer info
        if (isEdit) {
          const detailRes = await getOfferById(id);
          const data = detailRes.data.data;
          if (data) {
            setBrandName(data.brand_name || "");
            setSelectedModelGroups(data.model_groups || []);
            setStateId(data.state_id || "");
            setOfferType(data.offer_type || "Cashback Offer");
            setFromDate(data.from_date ? data.from_date.substring(0, 10) : "");
            setToDate(data.to_date ? data.to_date.substring(0, 10) : "");
            
            if (data.transactions && data.transactions.length > 0) {
              setTransactions(data.transactions.map(t => ({
                transaction_type: t.transaction_type,
                value_type: t.value_type,
                offer_type_value: t.offer_type_value || "",
                upto_value: t.upto_value !== null ? t.upto_value : "",
                offer_text: t.offer_text || "",
                relative_offer: t.relative_offer || ""
              })));
            }
          }
        }
      } catch (err) {
        console.error("Failed to load offer form data", err);
        toast.error("Failed to load required lists or offer details");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, isEdit]);

  // Extract unique brands
  const uniqueBrands = useMemo(() => {
    const brands = modelGroupsList.map(item => item.brand_name).filter(Boolean);
    return [...new Set(brands)].sort();
  }, [modelGroupsList]);

  // Extract model groups for selected brand
  const modelGroupsForSelectedBrand = useMemo(() => {
    if (!brand_name) return [];
    const groups = modelGroupsList
      .filter(item => item.brand_name === brand_name)
      .map(item => item.model_group_name)
      .filter(Boolean);
    return [...new Set(groups)].sort();
  }, [brand_name, modelGroupsList]);

  // Filtered model groups based on search term
  const filteredModelGroups = useMemo(() => {
    return modelGroupsForSelectedBrand.filter(mg =>
      mg.toLowerCase().includes(modelGroupSearch.toLowerCase())
    );
  }, [modelGroupsForSelectedBrand, modelGroupSearch]);

  // Toggle model group selection
  const handleModelGroupToggle = (mgName) => {
    if (selectedModelGroups.includes(mgName)) {
      setSelectedModelGroups(selectedModelGroups.filter(item => item !== mgName));
    } else {
      setSelectedModelGroups([...selectedModelGroups, mgName]);
    }
  };

  // Add a new row to transactions
  const addTransactionRow = () => {
    setTransactions([
      ...transactions,
      {
        transaction_type: "Cash Transaction",
        value_type: "In Rs.",
        offer_type_value: "",
        upto_value: "",
        offer_text: "",
        relative_offer: ""
      }
    ]);
  };

  // Remove a row from transactions
  const removeTransactionRow = (index) => {
    if (transactions.length === 1) {
      toast.error("At least one transaction type is required.");
      return;
    }
    const updated = transactions.filter((_, idx) => idx !== index);
    setTransactions(updated);
  };

  // Handle transaction row input changes
  const handleTxChange = (index, field, value) => {
    const updated = [...transactions];
    updated[index][field] = value;
    setTransactions(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!brand_name || !state_id || !from_date || !to_date) {
      toast.error("Please fill in all required fields.");
      return;
    }

    if (selectedModelGroups.length === 0) {
      toast.error("Please select at least one model group.");
      return;
    }

    // Validate transactions rows
    for (let i = 0; i < transactions.length; i++) {
      const row = transactions[i];
      if (!row.transaction_type) {
        toast.error(`Transaction type is missing in row ${i + 1}`);
        return;
      }
    }

    setSaving(true);
    const payload = {
      brand_name,
      model_groups: selectedModelGroups,
      state_id: parseInt(state_id, 10),
      offer_type,
      from_date,
      to_date,
      transactions
    };

    try {
      if (isEdit) {
        await updateOffer(id, payload);
        toast.success("Offer updated successfully");
      } else {
        await createOffer(payload);
        toast.success("Offer created successfully");
      }
      navigate("/admin/offers");
    } catch (err) {
      console.error("Failed to save offer", err);
      toast.error(err?.response?.data?.message || "Unable to save offer. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#f8fafc", fontFamily: "'Inter',sans-serif" }}>
      <Navbar title="ERP Admin" />

      <main style={{ flex: 1, width: "100%", maxWidth: 1200, margin: "0 auto", padding: "30px 24px" }}>
        
        {/* Back navigation & Title */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <button
            onClick={() => navigate("/admin/offers")}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 38,
              height: 38,
              borderRadius: 10,
              border: "1.5px solid #e2e8f0",
              background: "#fff",
              color: "#475569",
              cursor: "pointer",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
            }}
            title="Go back"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" style={{ width: 16, height: 16 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0f172a" }}>
              {isEdit ? "Edit Offer" : "Create New Offer"}
            </h1>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: "#64748b" }}>
              {isEdit ? "Modify existing offer details and parameters" : "Configure brand and model groups offer parameters"}
            </p>
          </div>
        </div>

        {loading ? (
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: 60, textAlign: "center", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
            <div className="animate-spin" style={{ display: "inline-block", width: 30, height: 30, border: "3px solid #e2e8f0", borderTopColor: "#6804a1", borderRadius: "50%", marginBottom: 12 }}></div>
            <p style={{ margin: 0, color: "#64748b", fontWeight: 600 }}>Loading parameters details...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            
            {/* Unified Form Card Container */}
            <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: "28px 30px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)", display: "flex", flexDirection: "column", gap: 32 }}>
              
              {/* Section 1: Offer Scope & Parameters */}
              <div>
                <h2 style={{ margin: "0 0 20px", fontSize: 16, fontWeight: 700, color: "#1e293b", borderBottom: "1.5px solid #f1f5f9", paddingBottom: 12 }}>
                  Offer Scope & Parameters
                </h2>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24 }}>
                  
                  {/* Left Inputs column */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                    {/* Brand */}
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                        Brand <span style={{ color: "#e11d48" }}>*</span>
                      </label>
                      <select
                        value={brand_name}
                        onChange={(e) => {
                          setBrandName(e.target.value);
                          setSelectedModelGroups([]); // reset selections on brand change
                        }}
                        required
                        style={{ width: "100%", boxSizing: "border-box", border: "1.5px solid #cbd5e1", borderRadius: 9, padding: "11px 14px", fontSize: 14, outline: "none", color: "#1e293b", background: "#fff" }}
                      >
                        <option value="">Select Brand</option>
                        {uniqueBrands.map((b) => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>

                    {/* State */}
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                        State  <span style={{ color: "#e11d48" }}>*</span>
                      </label>
                      <select
                        value={state_id}
                        onChange={(e) => setStateId(e.target.value)}
                        required
                        style={{ width: "100%", boxSizing: "border-box", border: "1.5px solid #cbd5e1", borderRadius: 9, padding: "11px 14px", fontSize: 14, outline: "none", color: "#1e293b", background: "#fff" }}
                      >
                        <option value="">Select State</option>
                        {statesList.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Offer Type */}
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                        Offer Type <span style={{ color: "#e11d48" }}>*</span>
                      </label>
                      <select
                        value={offer_type}
                        onChange={(e) => setOfferType(e.target.value)}
                        required
                        style={{ width: "100%", boxSizing: "border-box", border: "1.5px solid #cbd5e1", borderRadius: 9, padding: "11px 14px", fontSize: 14, outline: "none", color: "#1e293b", background: "#fff" }}
                      >
                        <option value="Cashback Offer">Cashback Offer</option>
                        <option value="Bundle Offer">Bundle Offer</option>
                        <option value="Upgrade Offer">Upgrade Offer</option>
                      </select>
                    </div>

                    {/* From & To dates side by side */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                          From Date <span style={{ color: "#e11d48" }}>*</span>
                        </label>
                        <input
                          type="date"
                          value={from_date}
                          onChange={(e) => setFromDate(e.target.value)}
                          required
                          style={{ width: "100%", boxSizing: "border-box", border: "1.5px solid #cbd5e1", borderRadius: 9, padding: "10px 12px", fontSize: 14, outline: "none", color: "#1e293b", background: "#fff" }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                          To Date <span style={{ color: "#e11d48" }}>*</span>
                        </label>
                        <input
                          type="date"
                          value={to_date}
                          onChange={(e) => setToDate(e.target.value)}
                          required
                          style={{ width: "100%", boxSizing: "border-box", border: "1.5px solid #cbd5e1", borderRadius: 9, padding: "10px 12px", fontSize: 14, outline: "none", color: "#1e293b", background: "#fff" }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Right Selector Column: Multi-Select Model Groups */}
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                      Model Groups <span style={{ color: "#e11d48" }}>*</span>
                    </label>

                    {/* Selected items tags display */}
                    {selectedModelGroups.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                        {selectedModelGroups.map((mg) => (
                          <span
                            key={mg}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              padding: "4px 10px",
                              borderRadius: 9999,
                              fontSize: 12,
                              fontWeight: 600,
                              background: "#f3e8ff",
                              color: "#6804a1",
                              border: "1px solid #e9d5ff"
                            }}
                          >
                            {mg}
                            <button
                              type="button"
                              onClick={() => handleModelGroupToggle(mg)}
                              style={{
                                background: "none",
                                border: "none",
                                color: "#a855f7",
                                cursor: "pointer",
                                padding: "0 2px",
                                fontSize: 14,
                                fontWeight: "bold",
                                lineHeight: 1
                              }}
                            >
                              &times;
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Filter Search Input */}
                    {brand_name && (
                      <div style={{ marginBottom: 10 }}>
                        <input
                          type="text"
                          placeholder="Search model groups..."
                          value={modelGroupSearch}
                          onChange={(e) => setModelGroupSearch(e.target.value)}
                          style={{
                            width: "100%",
                            boxSizing: "border-box",
                            border: "1.5px solid #cbd5e1",
                            borderRadius: 8,
                            padding: "8px 12px",
                            fontSize: 13,
                            outline: "none",
                            color: "#1e293b",
                            background: "#fff"
                          }}
                        />
                      </div>
                    )}

                    {/* Checkboxes scrollbox */}
                    <div
                      style={{
                        border: "1.5px solid #e2e8f0",
                        borderRadius: 10,
                        padding: 12,
                        maxHeight: 180,
                        overflowY: "auto",
                        background: brand_name ? "#fff" : "#f8fafc"
                      }}
                    >
                      {brand_name ? (
                        filteredModelGroups.length > 0 ? (
                          filteredModelGroups.map((mg) => {
                            const isChecked = selectedModelGroups.includes(mg);
                            return (
                              <label
                                key={mg}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 10,
                                  padding: "6px 4px",
                                  fontSize: 14,
                                  color: "#334155",
                                  cursor: "pointer",
                                  borderBottom: "1px solid #f8fafc"
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleModelGroupToggle(mg)}
                                  style={{
                                    width: 16,
                                    height: 16,
                                    accentColor: "#6804a1",
                                    cursor: "pointer"
                                  }}
                                />
                                <span style={{ fontWeight: isChecked ? 600 : 400, color: isChecked ? "#6804a1" : "#334155" }}>
                                  {mg}
                                </span>
                              </label>
                            );
                          })
                        ) : (
                          <div style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", padding: "12px 0" }}>
                            No matching model groups found.
                          </div>
                        )
                      ) : (
                        <div style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", padding: "20px 0" }}>
                          Please select a Brand to load model groups.
                        </div>
                      )}
                    </div>
                    {brand_name && (
                      <div style={{ fontSize: 11, color: "#64748b", marginTop: 6, display: "flex", justifyContent: "space-between" }}>
                        <span>Selected: {selectedModelGroups.length} group(s)</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (selectedModelGroups.length === modelGroupsForSelectedBrand.length) {
                              setSelectedModelGroups([]);
                            } else {
                              setSelectedModelGroups([...modelGroupsForSelectedBrand]);
                            }
                          }}
                          style={{ border: "none", background: "none", color: "#6804a1", cursor: "pointer", fontWeight: 600, fontSize: 11 }}
                        >
                          {selectedModelGroups.length === modelGroupsForSelectedBrand.length ? "Deselect All" : "Select All"}
                        </button>
                      </div>
                    )}
                  </div>

                </div>
              </div>

              {/* Section 2: Transaction Rules - inside the same container */}
              <div style={{ borderTop: "1.5px solid #f1f5f9", paddingTop: 24 }}>
                
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" }}>
                    Transaction Rules
                  </h2>
                  <button
                    type="button"
                    onClick={addTransactionRow}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "7px 15px",
                      borderRadius: 8,
                      background: "rgba(104,4,161,0.08)",
                      color: "#6804a1",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 700
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" style={{ width: 14, height: 14 }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    Add Transaction Type
                  </button>
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", borderBottom: "1.5px solid #e2e8f0" }}>
                        <th style={{ padding: "12px 10px", textAlign: "left", color: "#64748b", fontWeight: 700, minWidth: 180 }}>Transaction Type *</th>
                        <th style={{ padding: "12px 10px", textAlign: "left", color: "#64748b", fontWeight: 700, minWidth: 120 }}>Value Type *</th>
                        <th style={{ padding: "12px 10px", textAlign: "left", color: "#64748b", fontWeight: 700, minWidth: 130 }}>Offer Type</th>
                        <th style={{ padding: "12px 10px", textAlign: "left", color: "#64748b", fontWeight: 700, minWidth: 110 }}>Upto Value</th>
                        <th style={{ padding: "12px 10px", textAlign: "left", color: "#64748b", fontWeight: 700, minWidth: 180 }}>Offer Text</th>
                        <th style={{ padding: "12px 10px", textAlign: "left", color: "#64748b", fontWeight: 700, minWidth: 160 }}>Relative Offer</th>
                        <th style={{ padding: "12px 10px", textAlign: "center", color: "#64748b", fontWeight: 700, width: 70 }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((tx, idx) => (
                        <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          
                          {/* Transaction Type */}
                          <td style={{ padding: "10px 8px" }}>
                            <select
                              value={tx.transaction_type}
                              onChange={(e) => handleTxChange(idx, "transaction_type", e.target.value)}
                              required
                              style={{ width: "100%", boxSizing: "border-box", border: "1px solid #cbd5e1", borderRadius: 7, padding: "8px 10px", background: "#fff", outline: "none", color: "#334155" }}
                            >
                              <option value="Cash Transaction">Cash Transaction</option>
                              <option value="Card/Swipe Transaction">Card/Swipe Transaction</option>
                              <option value="Finance Transaction">Finance Transaction</option>
                              <option value="Bundle Transaction">Bundle Transaction</option>
                            </select>
                          </td>

                          {/* Value Type */}
                          <td style={{ padding: "10px 8px" }}>
                            <select
                              value={tx.value_type}
                              onChange={(e) => handleTxChange(idx, "value_type", e.target.value)}
                              required
                              style={{ width: "100%", boxSizing: "border-box", border: "1px solid #cbd5e1", borderRadius: 7, padding: "8px 10px", background: "#fff", outline: "none", color: "#334155" }}
                            >
                              <option value="In Rs.">In Rs.</option>
                              <option value="In %">In %</option>
                            </select>
                          </td>

                          {/* Offer Type Value text */}
                          <td style={{ padding: "10px 8px" }}>
                            <input
                              type="text"
                              value={tx.offer_type_value}
                              onChange={(e) => handleTxChange(idx, "offer_type_value", e.target.value)}
                              placeholder="e.g. 2000"
                              style={{ width: "100%", boxSizing: "border-box", border: "1px solid #cbd5e1", borderRadius: 7, padding: "8px 10px", outline: "none", color: "#334155" }}
                            />
                          </td>

                          {/* Upto Value */}
                          <td style={{ padding: "10px 8px" }}>
                            <input
                              type="number"
                              value={tx.upto_value}
                              onChange={(e) => handleTxChange(idx, "upto_value", e.target.value)}
                              placeholder="Max cap"
                              min="0"
                              step="any"
                              style={{ width: "100%", boxSizing: "border-box", border: "1px solid #cbd5e1", borderRadius: 7, padding: "8px 10px", outline: "none", color: "#334155" }}
                            />
                          </td>

                          {/* Offer Text */}
                          <td style={{ padding: "10px 8px" }}>
                            <input
                              type="text"
                              value={tx.offer_text}
                              onChange={(e) => handleTxChange(idx, "offer_text", e.target.value)}
                              placeholder="Enter description"
                              style={{ width: "100%", boxSizing: "border-box", border: "1px solid #cbd5e1", borderRadius: 7, padding: "8px 10px", outline: "none", color: "#334155" }}
                            />
                          </td>

                          {/* Relative Offer */}
                          <td style={{ padding: "10px 8px" }}>
                            <select
                              value={tx.relative_offer}
                              onChange={(e) => handleTxChange(idx, "relative_offer", e.target.value)}
                              style={{ width: "100%", boxSizing: "border-box", border: "1px solid #cbd5e1", borderRadius: 7, padding: "8px 10px", background: "#fff", outline: "none", color: "#334155" }}
                            >
                              <option value="">-select-</option>
                            </select>
                          </td>

                          {/* Action delete */}
                          <td style={{ padding: "10px 8px", textAlign: "center" }}>
                            <button
                              type="button"
                              onClick={() => removeTransactionRow(idx)}
                              style={{
                                display: "inline-flex",
                                width: 32,
                                height: 32,
                                alignItems: "center",
                                justifyContent: "center",
                                borderRadius: 8,
                                border: "1px solid #fecdd3",
                                background: "#fff1f2",
                                color: "#be123c",
                                cursor: "pointer"
                              }}
                              title="Delete row"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: 15, height: 15 }}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

              </div>

            </div>

            {/* Bottom Actions Row */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 10 }}>
              <button
                type="button"
                onClick={() => navigate("/admin/offers")}
                disabled={saving}
                style={{
                  padding: "11px 24px",
                  borderRadius: 9,
                  border: "1.5px solid #cbd5e1",
                  color: "#475569",
                  background: "#fff",
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: "pointer"
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                style={{
                  padding: "11px 32px",
                  borderRadius: 9,
                  border: "none",
                  background: saving ? "#94a3b8" : "linear-gradient(135deg,#6804a1,#52037e)",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: saving ? "not-allowed" : "pointer",
                  boxShadow: saving ? "none" : "0 3px 10px rgba(104,4,161,0.3)"
                }}
              >
                {saving ? "Saving Offer…" : isEdit ? "Save Changes" : "Save Offer"}
              </button>
            </div>

          </form>
        )}

      </main>
    </div>
  );
}

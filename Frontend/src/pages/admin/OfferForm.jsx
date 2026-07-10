import { useEffect, useState, useMemo, useRef } from "react";
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

  // Brand dropdown & search state
  const [isBrandDropdownOpen, setIsBrandDropdownOpen] = useState(false);
  const [brandSearch, setBrandSearch] = useState("");
  const brandDropdownRef = useRef(null);
  const brandSearchInputRef = useRef(null);

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

  // Filtered brands based on search input
  const filteredBrands = useMemo(() => {
    return uniqueBrands.filter(b =>
      b.toLowerCase().includes(brandSearch.toLowerCase())
    );
  }, [uniqueBrands, brandSearch]);

  // Click outside brand dropdown listener
  useEffect(() => {
    function handleClickOutside(event) {
      if (brandDropdownRef.current && !brandDropdownRef.current.contains(event.target)) {
        setIsBrandDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Auto-focus search input when brand dropdown opens
  useEffect(() => {
    if (isBrandDropdownOpen && brandSearchInputRef.current) {
      brandSearchInputRef.current.focus();
    }
  }, [isBrandDropdownOpen]);

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
    <div className="flex flex-col min-h-screen bg-slate-50 font-sans">
      <Navbar title="ERP Admin" />

      <main className="flex-1 w-full max-w-[1200px] mx-auto py-7 px-6">
        
        {/* Back navigation & Title */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate("/admin/offers")}
            className="flex items-center justify-center w-[38px] h-[38px] rounded-lg border-[1.5px] border-slate-200 bg-white text-slate-600 cursor-pointer shadow-sm hover:bg-slate-50 transition-colors"
            title="Go back"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
          <div>
            <h1 className="m-0 text-xl font-extrabold text-slate-900">
              {isEdit ? "Edit Offer" : "Create New Offer"}
            </h1>
            <p className="mt-0.5 text-[13px] text-slate-500">
              {isEdit ? "Modify existing offer details and parameters" : "Configure brand and model groups offer parameters"}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-[60px] text-center shadow-sm">
            <div className="animate-spin inline-block w-[30px] h-[30px] border-3 border-slate-200 border-t-indigo-650 rounded-full mb-3"></div>
            <p className="m-0 text-slate-505 font-semibold">Loading parameters details...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            
            {/* Unified Form Card Container */}
            <div className="bg-white rounded-2xl border border-slate-200 p-[28px_30px] shadow-sm flex flex-col gap-8">
              
              {/* Section 1: Offer Scope & Parameters */}
              <div>
                <h2 className="m-0 mb-5 text-base font-bold text-slate-800 border-b-[1.5px] border-slate-100 pb-3">
                  Offer Scope & Parameters
                </h2>

                <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-6">
                  
                  {/* Left Inputs column */}
                  <div className="flex flex-col gap-4.5">
                    {/* Brand */}
                    <div ref={brandDropdownRef} className="relative">
                      <label className="block text-xs font-bold text-slate-655 uppercase tracking-wider mb-2">
                        Brand <span className="text-rose-600">*</span>
                      </label>
                      
                      {/* Dropdown trigger header */}
                      <div
                        onClick={() => setIsBrandDropdownOpen(!isBrandDropdownOpen)}
                        className={`w-full border-[1.5px] rounded-[9px] px-3.5 py-[11px] text-sm outline-none bg-white cursor-pointer flex justify-between items-center select-none transition-all ${isBrandDropdownOpen ? "border-indigo-650 shadow-[0_0_0_3px_rgba(104,4,161,0.15)]" : "border-slate-300"} ${brand_name ? "text-slate-800" : "text-slate-400"}`}
                      >
                        <span>{brand_name || "Select Brand"}</span>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2.5}
                          stroke="currentColor"
                          className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${isBrandDropdownOpen ? "rotate-180" : ""}`}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                        </svg>
                      </div>

                      {/* Dropdown panel */}
                      {isBrandDropdownOpen && (
                        <div className="absolute top-full left-0 right-0 z-[100] mt-1.5 bg-white border border-slate-200 rounded-lg shadow-lg p-2 flex flex-col gap-2">
                          {/* Search bar inside dropdown */}
                          <div className="relative flex items-center">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth={2}
                              stroke="currentColor"
                              className="absolute left-2.5 w-[15px] h-[15px] text-slate-400"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                            </svg>
                            <input
                              ref={brandSearchInputRef}
                              type="text"
                              placeholder="Search brand..."
                              value={brandSearch}
                              onChange={(e) => setBrandSearch(e.target.value)}
                              onClick={(e) => e.stopPropagation()} // Keep dropdown open when searching
                              className="w-full border-[1.5px] border-slate-300 rounded-md py-2 pl-8 pr-3 text-sm outline-none text-slate-800 bg-white focus:border-indigo-650 transition-colors"
                            />
                          </div>

                          {/* Options list */}
                          <div className="max-h-[180px] overflow-y-auto flex flex-col gap-0.5">
                            {filteredBrands.length > 0 ? (
                              filteredBrands.map((b) => {
                                const isSelected = b === brand_name;
                                return (
                                  <div
                                    key={b}
                                    onClick={() => {
                                      setBrandName(b);
                                      setSelectedModelGroups([]); // reset selections on brand change
                                      setBrandSearch("");
                                      setIsBrandDropdownOpen(false);
                                    }}
                                    className={`px-3 py-2 text-[13.5px] rounded-md cursor-pointer transition-colors ${isSelected ? "text-indigo-650 font-semibold bg-purple-50" : "text-slate-650 bg-transparent hover:bg-slate-50 hover:text-slate-850"}`}
                                  >
                                    {b}
                                  </div>
                                );
                              })
                            ) : (
                              <div className="py-4 px-3 text-[13px] text-slate-405 text-center">
                                No brands found
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* State */}
                    <div>
                      <label className="block text-xs font-bold text-slate-655 uppercase tracking-wider mb-2">
                        State  <span className="text-rose-600">*</span>
                      </label>
                      <select
                        value={state_id}
                        onChange={(e) => setStateId(e.target.value)}
                        required
                        className="w-full border-[1.5px] border-slate-350 rounded-[9px] px-3.5 py-[11px] text-sm outline-none text-slate-800 bg-white focus:border-indigo-655 transition-colors"
                      >
                        <option value="">Select State</option>
                        {statesList.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Offer Type */}
                    <div>
                      <label className="block text-xs font-bold text-slate-655 uppercase tracking-wider mb-2">
                        Offer Type <span className="text-rose-600">*</span>
                      </label>
                      <select
                        value={offer_type}
                        onChange={(e) => setOfferType(e.target.value)}
                        required
                        className="w-full border-[1.5px] border-slate-350 rounded-[9px] px-3.5 py-[11px] text-sm outline-none text-slate-800 bg-white focus:border-indigo-655 transition-colors"
                      >
                        <option value="Cashback Offer">Cashback Offer</option>
                        <option value="Bundle Offer">Bundle Offer</option>
                        <option value="Upgrade Offer">Upgrade Offer</option>
                      </select>
                    </div>

                    {/* From & To dates side by side */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-655 uppercase tracking-wider mb-2">
                          From Date <span className="text-rose-600">*</span>
                        </label>
                        <input
                          type="date"
                          value={from_date}
                          onChange={(e) => setFromDate(e.target.value)}
                          required
                          className="w-full border-[1.5px] border-slate-350 rounded-[9px] px-3 py-2.5 text-sm outline-none text-slate-800 bg-white focus:border-indigo-655 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-655 uppercase tracking-wider mb-2">
                          To Date <span className="text-rose-600">*</span>
                        </label>
                        <input
                          type="date"
                          value={to_date}
                          onChange={(e) => setToDate(e.target.value)}
                          required
                          className="w-full border-[1.5px] border-slate-350 rounded-[9px] px-3 py-2.5 text-sm outline-none text-slate-800 bg-white focus:border-indigo-655 transition-colors"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Right Selector Column: Multi-Select Model Groups */}
                  <div className="flex flex-col">
                    <label className="block text-xs font-bold text-slate-655 uppercase tracking-wider mb-2">
                      Model Groups <span className="text-rose-600">*</span>
                    </label>

                    {/* Selected items tags display */}
                    {selectedModelGroups.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {selectedModelGroups.map((mg) => (
                          <span
                            key={mg}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-indigo-650 border border-purple-100"
                          >
                            {mg}
                            <button
                              type="button"
                              onClick={() => handleModelGroupToggle(mg)}
                              className="bg-none border-none text-purple-400 cursor-pointer px-0.5 text-sm font-bold leading-none hover:text-purple-650 transition-colors"
                            >
                              &times;
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Filter Search Input */}
                    {brand_name && (
                      <div className="mb-2.5">
                        <input
                          type="text"
                          placeholder="Search model groups..."
                          value={modelGroupSearch}
                          onChange={(e) => setModelGroupSearch(e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none text-slate-800 bg-white focus:border-indigo-655 transition-colors"
                        />
                      </div>
                    )}

                    {/* Checkboxes scrollbox */}
                    <div
                      className={`border-[1.5px] border-slate-200 rounded-xl p-3 max-h-[180px] overflow-y-auto ${brand_name ? "bg-white" : "bg-slate-50"}`}
                    >
                      {brand_name ? (
                        filteredModelGroups.length > 0 ? (
                          filteredModelGroups.map((mg) => {
                            const isChecked = selectedModelGroups.includes(mg);
                            return (
                              <label
                                key={mg}
                                className="flex items-center gap-2.5 py-1.5 px-1 text-sm text-slate-650 cursor-pointer border-b border-slate-50/50 last:border-b-0"
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleModelGroupToggle(mg)}
                                  className="w-4 h-4 accent-indigo-650 cursor-pointer"
                                />
                                <span className={isChecked ? "font-semibold text-indigo-650" : "font-normal text-slate-600"}>
                                  {mg}
                                </span>
                              </label>
                            );
                          })
                        ) : (
                          <div className="text-slate-400 text-[13px] text-center py-3">
                            No matching model groups found.
                          </div>
                        )
                      ) : (
                        <div className="text-slate-400 text-[13px] text-center py-5">
                          Please select a Brand to load model groups.
                        </div>
                      )}
                    </div>
                    {brand_name && (
                      <div className="text-[11px] text-slate-400 mt-1.5 flex justify-between">
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
                          className="border-none bg-none text-indigo-600 cursor-pointer font-semibold text-[11px] hover:underline"
                        >
                          {selectedModelGroups.length === modelGroupsForSelectedBrand.length ? "Deselect All" : "Select All"}
                        </button>
                      </div>
                    )}
                  </div>

                </div>
              </div>

              {/* Section 2: Transaction Rules - inside the same container */}
              <div className="border-t-[1.5px] border-slate-100 pt-6">
                
                <div className="flex items-center justify-between mb-5">
                  <h2 className="m-0 text-base font-bold text-slate-800">
                    Transaction Rules
                  </h2>
                  <button
                    type="button"
                    onClick={addTransactionRow}
                    className="flex items-center gap-1.5 px-3.5 py-1.75 rounded-lg bg-indigo-50 text-indigo-650 border-none cursor-pointer text-xs font-bold hover:bg-indigo-100 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    Add Transaction Type
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b-[1.5px] border-slate-200">
                        <th className="px-2.5 py-3 text-left text-slate-500 font-bold" style={{ minWidth: "180px" }}>Transaction Type *</th>
                        <th className="px-2.5 py-3 text-left text-slate-500 font-bold" style={{ minWidth: "120px" }}>Value Type *</th>
                        <th className="px-2.5 py-3 text-left text-slate-500 font-bold" style={{ minWidth: "130px" }}>Offer Type</th>
                        <th className="px-2.5 py-3 text-left text-slate-500 font-bold" style={{ minWidth: "110px" }}>Upto Value</th>
                        <th className="px-2.5 py-3 text-left text-slate-500 font-bold" style={{ minWidth: "180px" }}>Offer Text</th>
                        <th className="px-2.5 py-3 text-left text-slate-500 font-bold" style={{ minWidth: "160px" }}>Relative Offer</th>
                        <th className="px-2.5 py-3 text-center text-slate-500 font-bold" style={{ width: "70px" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((tx, idx) => (
                        <tr key={idx} className="border-b border-slate-100 last:border-b-0">
                          
                          {/* Transaction Type */}
                          <td className="p-2">
                            <select
                              value={tx.transaction_type}
                              onChange={(e) => handleTxChange(idx, "transaction_type", e.target.value)}
                              required
                              className="w-full border border-slate-300 rounded-md px-2.5 py-2 bg-white outline-none text-slate-700 text-sm focus:border-indigo-650 transition-colors"
                            >
                              <option value="Cash Transaction">Cash Transaction</option>
                              <option value="Card/Swipe Transaction">Card/Swipe Transaction</option>
                              <option value="Finance Transaction">Finance Transaction</option>
                              <option value="Bundle Transaction">Bundle Transaction</option>
                            </select>
                          </td>

                          {/* Value Type */}
                          <td className="p-2">
                            <select
                              value={tx.value_type}
                              onChange={(e) => handleTxChange(idx, "value_type", e.target.value)}
                              required
                              className="w-full border border-slate-300 rounded-md px-2.5 py-2 bg-white outline-none text-slate-700 text-sm focus:border-indigo-650 transition-colors"
                            >
                              <option value="In Rs.">In Rs.</option>
                              <option value="In %">In %</option>
                            </select>
                          </td>

                          {/* Offer Type Value text */}
                          <td className="p-2">
                            <input
                              type="text"
                              value={tx.offer_type_value}
                              onChange={(e) => handleTxChange(idx, "offer_type_value", e.target.value)}
                              placeholder="e.g. 2000"
                              className="w-full border border-slate-300 rounded-md px-2.5 py-2 outline-none text-slate-700 text-sm focus:border-indigo-655 transition-colors"
                            />
                          </td>

                          {/* Upto Value */}
                          <td className="p-2">
                            <input
                              type="number"
                              value={tx.upto_value}
                              onChange={(e) => handleTxChange(idx, "upto_value", e.target.value)}
                              placeholder="Max cap"
                              min="0"
                              step="any"
                              className="w-full border border-slate-300 rounded-md px-2.5 py-2 outline-none text-slate-700 text-sm focus:border-indigo-655 transition-colors"
                            />
                          </td>

                          {/* Offer Text */}
                          <td className="p-2">
                            <input
                              type="text"
                              value={tx.offer_text}
                              onChange={(e) => handleTxChange(idx, "offer_text", e.target.value)}
                              placeholder="Enter description"
                              className="w-full border border-slate-300 rounded-md px-2.5 py-2 outline-none text-slate-700 text-sm focus:border-indigo-655 transition-colors"
                            />
                          </td>

                          {/* Relative Offer */}
                          <td className="p-2">
                            <select
                              value={tx.relative_offer}
                              onChange={(e) => handleTxChange(idx, "relative_offer", e.target.value)}
                              className="w-full border border-slate-300 rounded-md px-2.5 py-2 bg-white outline-none text-slate-700 text-sm focus:border-indigo-650 transition-colors"
                            >
                              <option value="">-select-</option>
                            </select>
                          </td>

                          {/* Action delete */}
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeTransactionRow(idx)}
                              className="inline-flex w-8 h-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 cursor-pointer hover:bg-rose-100 transition-colors"
                              title="Delete row"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-[15px] h-[15px]">
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
            <div className="flex justify-end gap-3 mt-2.5">
              <button
                type="button"
                onClick={() => navigate("/admin/offers")}
                disabled={saving}
                className="px-6 py-2.75 rounded-[9px] border-[1.5px] border-slate-300 text-slate-600 bg-white font-semibold text-sm cursor-pointer hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-8 py-2.75 rounded-[9px] border-none text-white font-bold text-sm bg-gradient-to-br from-indigo-600 to-indigo-700 shadow-[0_3px_10px_rgba(104,4,161,0.3)] cursor-pointer disabled:bg-slate-400 disabled:cursor-not-allowed disabled:shadow-none hover:opacity-95 transition-all"
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

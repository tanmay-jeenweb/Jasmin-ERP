import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Navbar from "../../components/Navbar";
import { getStates } from "../../api/stateApi";
import { getMobileBrands } from "../../api/mobileBrandApi";
import { createVariation, updateVariation, getVariationById } from "../../api/variationApi";
import toast from "react-hot-toast";

// Helper to convert index to Excel column label starting from F (index 0 -> F, index 1 -> G...)
const getExcelColumnLabel = (index) => {
  let num = index + 6; // Starts at F (6th letter of alphabet)
  let label = "";
  while (num > 0) {
    let modulo = (num - 1) % 26;
    label = String.fromCharCode(65 + modulo) + label;
    num = Math.floor((num - modulo) / 26);
  }
  return label;
};

export default function VariationForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  // Master lists options
  const [statesList, setStatesList] = useState([]);
  const [brandsList, setBrandsList] = useState([]);

  // Selected State (single)
  const [selectedState, setSelectedState] = useState("");

  // Selected Brands (multiple)
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [isBrandDropdownOpen, setIsBrandDropdownOpen] = useState(false);
  const [brandSearch, setBrandSearch] = useState("");

  // Columns list
  const [columns, setColumns] = useState([
    { column_id: "F", column_name: "", type: "user input", formula: "" }
  ]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load options and form data
  const loadFormData = async () => {
    setLoading(true);
    try {
      const [stateRes, brandRes] = await Promise.all([
        getStates(),
        getMobileBrands()
      ]);
      setStatesList((stateRes.data?.data || []).filter((s) => s.live === "Yes"));
      setBrandsList(brandRes.data?.data || []);

      if (isEdit) {
        const varRes = await getVariationById(id);
        if (varRes.data?.success && varRes.data.data) {
          const detail = varRes.data.data;
          setSelectedState(detail.state_id.toString());
          
          // Parse brands if stored as JSON string
          const parsedBrands = Array.isArray(detail.brands)
            ? detail.brands
            : typeof detail.brands === "string"
            ? JSON.parse(detail.brands)
            : [];
          setSelectedBrands(parsedBrands);

          // Parse columns if stored as JSON string
          const parsedColumns = Array.isArray(detail.columns)
            ? detail.columns
            : typeof detail.columns === "string"
            ? JSON.parse(detail.columns)
            : [];
          setColumns(parsedColumns);
        } else {
          toast.error("Failed to retrieve variation details.");
          navigate("/admin/variations");
        }
      }
    } catch (error) {
      console.error("Error loading variation form data:", error);
      toast.error("Failed to load options from the server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFormData();

    // Close brand dropdown on clicking outside
    const handleClickOutside = (event) => {
      if (!event.target.closest(".brand-select-container")) {
        setIsBrandDropdownOpen(false);
        setBrandSearch("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [id]);

  // Brand multiselect handlers
  const filteredBrands = brandsList.filter((b) =>
    b.mobile_brand.toLowerCase().includes(brandSearch.toLowerCase())
  );

  const handleToggleBrand = (brandName) => {
    let updated = [...selectedBrands];
    if (brandName === "All") {
      const allFiltered = filteredBrands.map((b) => b.mobile_brand);
      const isAllFilteredSelected = allFiltered.every((item) => updated.includes(item));
      if (isAllFilteredSelected) {
        updated = updated.filter((val) => !allFiltered.includes(val));
      } else {
        allFiltered.forEach((item) => {
          if (!updated.includes(item)) updated.push(item);
        });
      }
    } else {
      if (updated.includes(brandName)) {
        updated = updated.filter((val) => val !== brandName);
      } else {
        updated.push(brandName);
      }
    }
    setSelectedBrands(updated);
  };

  const getBrandLabel = () => {
    if (selectedBrands.length === 0) return "Select Brands";
    if (selectedBrands.length === brandsList.length && brandsList.length > 0) return "All Brands";
    if (selectedBrands.length <= 2) return selectedBrands.join(", ");
    return `${selectedBrands.length} Brands Selected`;
  };

  // Dynamic Column Handlers
  const handleAddColumn = () => {
    const nextIndex = columns.length;
    const nextColId = getExcelColumnLabel(nextIndex);
    setColumns([
      ...columns,
      { column_id: nextColId, column_name: "", type: "user input", formula: "" }
    ]);
  };

  const handleRemoveColumn = (indexToRemove) => {
    if (columns.length === 1) {
      toast.error("At least one column is required.");
      return;
    }
    const updated = columns
      .filter((_, idx) => idx !== indexToRemove)
      .map((col, idx) => ({
        ...col,
        column_id: getExcelColumnLabel(idx) // Re-calculate IDs sequentially
      }));
    setColumns(updated);
  };

  const handleColumnFieldChange = (index, field, value) => {
    const updated = columns.map((col, idx) => {
      if (idx === index) {
        const newCol = { ...col, [field]: value };
        if (field === "type" && value === "user input") {
          newCol.formula = ""; // Clear formula if type is user input
        }
        return newCol;
      }
      return col;
    });
    setColumns(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedState) {
      toast.error("Please select a State.");
      return;
    }
    if (selectedBrands.length === 0) {
      toast.error("Please select at least one Brand.");
      return;
    }

    // Validate columns
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      if (!col.column_name.trim()) {
        toast.error(`Column Name cannot be blank (Row ${i + 1}).`);
        return;
      }
      if (col.type === "formulation" && !col.formula.trim()) {
        toast.error(`Formula is required when Type is Formulation (Row ${i + 1}).`);
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        stateId: parseInt(selectedState),
        brands: selectedBrands,
        columns: columns.map((c) => ({
          column_id: c.column_id,
          column_name: c.column_name.trim(),
          type: c.type,
          formula: c.type === "formulation" ? c.formula.trim() : ""
        }))
      };

      if (isEdit) {
        const res = await updateVariation(id, payload);
        if (res.data?.success) {
          toast.success("Variation rule updated successfully.");
          navigate("/admin/variations");
        } else {
          toast.error(res.data?.message || "Failed to update variation rule.");
        }
      } else {
        const res = await createVariation(payload);
        if (res.data?.success) {
          toast.success("Variation rule created successfully.");
          navigate("/admin/variations");
        } else {
          toast.error(res.data?.message || "Failed to create variation rule.");
        }
      }
    } catch (err) {
      console.error("Error saving variation rule:", err);
      toast.error(err.response?.data?.message || "Failed to save variation rule.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col flex-1 bg-slate-50 font-sans min-h-screen">
        <Navbar title="ERP Admin" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-slate-500 font-medium">Loading variation configuration...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 bg-slate-50 font-sans min-h-screen">
      <Navbar title="ERP Admin" />

      <main className="flex-1 w-full mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {isEdit ? "Edit Variation Rule" : "Create Variation Rule"}
            </h1>
            <p className="text-slate-500 mt-1">
              {isEdit
                ? "Update Excel variation column formulas and state mappings."
                : "Setup new variation column outputs for reports."}
            </p>
          </div>
          <button
            onClick={() => navigate("/admin/variations")}
            className="text-slate-500 hover:text-slate-700 font-medium text-sm flex items-center gap-1 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-4 h-4"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back to List
          </button>
        </div>

        {/* Form Container */}
        <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
          <form onSubmit={handleSubmit} className="space-y-8">
            
            {/* Row 1: State & Brand Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* State Dropdown */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  State <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedState}
                  onChange={(e) => setSelectedState(e.target.value)}
                  required
                  className="block w-full px-3.5 py-2.5 border border-slate-300 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-slate-800"
                >
                  <option value="">Select State</option>
                  {statesList.map((state) => (
                    <option key={state.id} value={state.id}>
                      {state.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Brand Searchable Multiselect Dropdown */}
              <div className="relative brand-select-container">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Brands <span className="text-rose-500">*</span>
                </label>
                <div
                  className="w-full min-h-[44px] px-3.5 py-2.5 border border-slate-300 rounded-lg bg-white sm:text-sm cursor-pointer flex justify-between items-center text-slate-800"
                  onClick={() => setIsBrandDropdownOpen(!isBrandDropdownOpen)}
                >
                  <span className="truncate">{getBrandLabel()}</span>
                  <svg
                    className={`w-4 h-4 text-slate-500 transition-transform duration-250 ${
                      isBrandDropdownOpen ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                {isBrandDropdownOpen && (
                  <div className="absolute z-20 mt-1.5 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto p-2.5 space-y-1">
                    <div className="px-1 py-1 sticky top-0 bg-white z-10">
                      <input
                        type="text"
                        placeholder="Search Brand..."
                        value={brandSearch}
                        onChange={(e) => setBrandSearch(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#6804a1] focus:border-[#6804a1]"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    
                    {/* Toggle All Checkbox */}
                    <label className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer text-sm font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={
                          filteredBrands.length > 0 &&
                          filteredBrands.every((b) => selectedBrands.includes(b.mobile_brand))
                        }
                        onChange={() => handleToggleBrand("All")}
                        className="h-4 w-4 text-[#6804a1] border-slate-300 rounded focus:ring-[#6804a1]"
                      />
                      All (Filtered)
                    </label>

                    {filteredBrands.length === 0 ? (
                      <div className="text-xs text-slate-400 p-2 text-center">No brands found</div>
                    ) : (
                      filteredBrands.map((b) => (
                        <label
                          key={b.id}
                          className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer text-sm text-slate-700"
                        >
                          <input
                            type="checkbox"
                            checked={selectedBrands.includes(b.mobile_brand)}
                            onChange={() => handleToggleBrand(b.mobile_brand)}
                            className="h-4 w-4 text-[#6804a1] border-slate-300 rounded focus:ring-[#6804a1]"
                          />
                          {b.mobile_brand}
                        </label>
                      ))
                    )}
                  </div>
                )}
              </div>

            </div>

            {/* Section 2: Columns Setup */}
            <div className="pt-4 border-t border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Columns Configurations</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Define custom columns. Column IDs are generated starting sequentially from F.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddColumn}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-indigo-200 rounded-lg text-indigo-650 bg-indigo-50 hover:bg-indigo-100 font-bold text-xs cursor-pointer transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2.5}
                    stroke="currentColor"
                    className="w-3.5 h-3.5"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Add Column
                </button>
              </div>

              {/* Dynamic Column List Table */}
              <div className="space-y-3">
                {columns.map((col, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-12 gap-4 p-4 px-0  bg-slate-50 rounded-xl border border-slate-200 items-center"
                  >
                    {/* Column ID Badge */}
                    <div className="col-span-1 flex items-center justify-center gap-2">
                      <span className="w-10 h-10 flex items-center justify-center rounded-lg bg-[#6804a1] text-white font-bold text-sm shadow-sm shrink-0">
                        {col.column_id}
                      </span>
                    </div>

                    {/* Column Name Input */}
                    <div className="col-span-4 w-full">
                      <input
                        type="text"
                        required
                        placeholder="Column Name (e.g. GST DP)"
                        value={col.column_name}
                        onChange={(e) => handleColumnFieldChange(index, "column_name", e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 bg-white rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-slate-800"
                      />
                    </div>

                    {/* Column Type Select */}
                    <div className="col-span-2 w-full">
                      <select
                        value={col.type}
                        onChange={(e) => handleColumnFieldChange(index, "type", e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 bg-white rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-slate-800"
                      >
                        <option value="user input">User Input</option>
                        <option value="formulation">Formulation</option>
                      </select>
                    </div>

                    {/* Column Formula Input */}
                    <div className="col-span-4 w-full">
                      <input
                        type="text"
                        placeholder={
                          col.type === "formulation"
                            ? "Excel Formula (e.g. =F2*1.18)"
                            : "Formula disabled (User Input)"
                        }
                        disabled={col.type === "user input"}
                        value={col.formula}
                        onChange={(e) => handleColumnFieldChange(index, "formula", e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-slate-800 font-mono ${
                          col.type === "user input"
                            ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                            : "bg-white border-slate-300"
                        }`}
                      />
                    </div>

                    {/* Trash Delete Action */}
                    <div className="col-span-1 flex justify-center w-full">
                      <button
                        type="button"
                        onClick={() => handleRemoveColumn(index)}
                        className="p-2 border border-rose-200 rounded-lg text-rose-650 bg-rose-50 hover:bg-rose-100 transition-colors cursor-pointer"
                        title="Remove Column"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.8}
                          stroke="currentColor"
                          className="w-4 h-4"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M14.74 9l-.34 9m-4.78 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                          />
                        </svg>
                      </button>
                    </div>

                  </div>
                ))}
              </div>
            </div>

            {/* Form Action Controls */}
            <div className="pt-6 border-t border-slate-200 flex justify-end gap-3.5">
              <button
                type="button"
                onClick={() => navigate("/admin/variations")}
                disabled={saving}
                className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-600 bg-white hover:bg-slate-50 font-semibold text-sm cursor-pointer transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-7 py-2.5 rounded-lg border-none text-white font-bold text-sm bg-gradient-to-br from-indigo-600 to-indigo-750 hover:opacity-95 shadow-[0_2px_8px_rgba(104,4,161,0.3)] disabled:bg-slate-400 disabled:cursor-not-allowed disabled:shadow-none cursor-pointer transition-all flex items-center justify-center"
              >
                {saving ? (isEdit ? "Saving Changes..." : "Creating...") : isEdit ? "Save Changes" : "Create Variation"}
              </button>
            </div>

          </form>
        </div>
      </main>
    </div>
  );
}

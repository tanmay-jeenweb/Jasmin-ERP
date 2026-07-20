import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Navbar from "../../components/Navbar";
import { getStates } from "../../api/stateApi";
import { getDistinctBrands } from "../../api/itemModelApi";
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
    const [allBrands, setAllBrands] = useState([]);

    // Form Fields
    const [selectedState, setSelectedState] = useState("");
    const [formatName, setFormatName] = useState("");
    const [columns, setColumns] = useState([
        { column_id: "F", column_name: "", type: "user input", formula: "" }
    ]);
    const [brandConfigs, setBrandConfigs] = useState([]);

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Load options and form data
    const loadFormData = async () => {
        setLoading(true);
        try {
            const [stateRes, brandRes] = await Promise.all([
                getStates(),
                getDistinctBrands()
            ]);
            setStatesList((stateRes.data?.data || []).filter((s) => s.live === "Yes"));
            setAllBrands(brandRes.data?.data || []);

            if (isEdit) {
                const varRes = await getVariationById(id);
                if (varRes.data?.success && varRes.data.data) {
                    const detail = varRes.data.data;
                    setSelectedState(detail.state_id.toString());
                    setFormatName(detail.format_name || "");

                    // Parse columns if stored as JSON string
                    const parsedColumns = Array.isArray(detail.columns)
                        ? detail.columns
                        : typeof detail.columns === "string"
                            ? JSON.parse(detail.columns)
                            : [];

                    // Map column types: rename formulation to default formulation for consistency
                    const mappedColumns = parsedColumns.map((col) => ({
                        ...col,
                        type: col.type === "formulation" ? "default formulation" : col.type
                    }));
                    setColumns(mappedColumns);

                    // Parse brandConfigs if stored as JSON string
                    const parsedConfigs = Array.isArray(detail.brand_configs)
                        ? detail.brand_configs
                        : typeof detail.brand_configs === "string"
                            ? JSON.parse(detail.brand_configs)
                            : [];

                    const mappedConfigs = parsedConfigs.map((cfg) => ({
                        id: cfg.id || Date.now() + Math.random().toString(),
                        brands: cfg.brands || [],
                        columns: cfg.columns || [],
                        isDropdownOpen: false,
                        searchQuery: ""
                    }));
                    setBrandConfigs(mappedConfigs);
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

        // Close all brand config dropdowns on clicking outside
        const handleClickOutside = (event) => {
            if (!event.target.closest(".brand-override-select-container")) {
                setBrandConfigs((prev) =>
                    prev.map((c) => ({ ...c, isDropdownOpen: false, searchQuery: "" }))
                );
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [id]);

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
        const removedCol = columns[indexToRemove];
        const updated = columns
            .filter((_, idx) => idx !== indexToRemove)
            .map((col, idx) => ({
                ...col,
                column_id: getExcelColumnLabel(idx) // Re-calculate IDs sequentially
            }));
        setColumns(updated);

        // Also update any brand configs that referenced this column_id
        setBrandConfigs((prevConfigs) =>
            prevConfigs.map((cfg) => {
                const updatedCols = cfg.columns
                    .filter((c) => {
                        const oldIdx = columns.findIndex((col) => col.column_id === c.column_id);
                        return oldIdx !== indexToRemove;
                    })
                    .map((c) => {
                        const oldIdx = columns.findIndex((col) => col.column_id === c.column_id);
                        const newIdx = oldIdx > indexToRemove ? oldIdx - 1 : oldIdx;
                        return {
                            ...c,
                            column_id: getExcelColumnLabel(newIdx)
                        };
                    });
                return { ...cfg, columns: updatedCols };
            })
        );
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

        if (field === "type" && value === "user input") {
            const colId = columns[index].column_id;
            setBrandConfigs((prevConfigs) =>
                prevConfigs.map((cfg) => ({
                    ...cfg,
                    columns: cfg.columns.filter((c) => c.column_id !== colId)
                }))
            );
        }
    };

    // Brand Override Handlers
    const handleAddBrandConfig = () => {
        setBrandConfigs([
            ...brandConfigs,
            {
                id: Date.now() + Math.random().toString(),
                brands: [],
                columns: [],
                isDropdownOpen: false,
                searchQuery: ""
            }
        ]);
    };

    const handleRemoveBrandConfig = (configId) => {
        setBrandConfigs(brandConfigs.filter((cfg) => cfg.id !== configId));
    };

    const handleToggleBrandInConfig = (configId, brandName) => {
        setBrandConfigs(
            brandConfigs.map((cfg) => {
                if (cfg.id === configId) {
                    let updatedBrands = [...cfg.brands];
                    if (updatedBrands.includes(brandName)) {
                        updatedBrands = updatedBrands.filter((b) => b !== brandName);
                    } else {
                        updatedBrands.push(brandName);
                    }
                    return { ...cfg, brands: updatedBrands };
                }
                return cfg;
            })
        );
    };

    const handleOverrideFormulaChange = (configId, columnId, value) => {
        setBrandConfigs(
            brandConfigs.map((cfg) => {
                if (cfg.id === configId) {
                    const updatedCols = [...cfg.columns];
                    const existingIdx = updatedCols.findIndex((c) => c.column_id === columnId);
                    if (existingIdx >= 0) {
                        updatedCols[existingIdx] = { ...updatedCols[existingIdx], formula: value };
                    } else {
                        updatedCols.push({ column_id: columnId, formula: value });
                    }
                    return { ...cfg, columns: updatedCols };
                }
                return cfg;
            })
        );
    };

    const getAvailableBrands = (currentConfigId) => {
        const alreadySelected = brandConfigs
            .filter((cfg) => cfg.id !== currentConfigId)
            .flatMap((cfg) => cfg.brands || []);
        return allBrands.filter((b) => !alreadySelected.includes(b));
    };

    const formulationColumns = columns.filter(
        (col) => col.type === "default formulation" || col.type === "formulation"
    );

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!selectedState) {
            toast.error("Please select a State.");
            return;
        }
        if (!formatName.trim()) {
            toast.error("Please enter a Format Name.");
            return;
        }

        // Validate columns
        for (let i = 0; i < columns.length; i++) {
            const col = columns[i];
            if (!col.column_name.trim()) {
                toast.error(`Column Name cannot be blank (Row ${i + 1}).`);
                return;
            }
            if ((col.type === "default formulation" || col.type === "formulation") && !col.formula.trim()) {
                toast.error(`Formula is required when Type is Default Formulation (Row ${i + 1}).`);
                return;
            }
        }

        // Validate brand configs
        for (let i = 0; i < brandConfigs.length; i++) {
            const cfg = brandConfigs[i];
            if (cfg.brands.length === 0) {
                toast.error(`Please select at least one Brand for override configuration block ${i + 1}.`);
                return;
            }
        }

        // Clean brand overrides: filter out empty formulas
        const cleanBrandConfigs = brandConfigs
            .map((cfg) => ({
                brands: cfg.brands,
                columns: cfg.columns.filter((c) => c.formula && c.formula.trim() !== "")
            }))
            .filter((cfg) => cfg.brands.length > 0 && cfg.columns.length > 0);

        setSaving(true);
        try {
            const payload = {
                stateId: parseInt(selectedState),
                formatName: formatName.trim(),
                columns: columns.map((c) => ({
                    column_id: c.column_id,
                    column_name: c.column_name.trim(),
                    type: c.type,
                    formula: (c.type === "default formulation" || c.type === "formulation") ? c.formula.trim() : ""
                })),
                brandConfigs: cleanBrandConfigs
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

                        {/* Row 1: State & Format Name */}
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

                            {/* Format Name Input */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Format Name <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. South Region Format"
                                    value={formatName}
                                    onChange={(e) => setFormatName(e.target.value)}
                                    className="block w-full px-3.5 py-2.5 border border-slate-300 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-slate-800"
                                />
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
                                        className="grid grid-cols-12 gap-4 p-4 px-0 bg-slate-50 rounded-xl border border-slate-200 items-center"
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
                                                <option value="default formulation">Default Formulation</option>
                                            </select>
                                        </div>

                                        {/* Column Formula Input */}
                                        <div className="col-span-4 w-full">
                                            <input
                                                type="text"
                                                placeholder={
                                                    col.type === "default formulation" || col.type === "formulation"
                                                        ? "Excel Formula (e.g. =F2*1.18)"
                                                        : "Formula disabled (User Input)"
                                                }
                                                disabled={col.type === "user input"}
                                                value={col.formula}
                                                onChange={(e) => handleColumnFieldChange(index, "formula", e.target.value)}
                                                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-slate-800 font-mono ${col.type === "user input"
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

                        {/* Section 3: Brand-wise Override Configurations */}
                        <div className="pt-6 border-t border-slate-200">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800">Brand-wise Override Configurations</h3>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Optionally configure specific brand(s) to use different formulas for Default Formulation columns.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleAddBrandConfig}
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
                                    Add Brand Override
                                </button>
                            </div>

                            {brandConfigs.length === 0 ? (
                                <div className="text-center py-8 border border-dashed border-slate-300 rounded-xl bg-slate-50/50">
                                    <span className="text-slate-400 text-sm">No brand overrides configured. All brands will use default configuration.</span>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {brandConfigs.map((cfg, cfgIndex) => {
                                        const availableBrands = getAvailableBrands(cfg.id);
                                        const filteredBrands = availableBrands.filter((b) =>
                                            b.toLowerCase().includes(cfg.searchQuery.toLowerCase())
                                        );

                                        const getOverrideBrandLabel = () => {
                                            if (cfg.brands.length === 0) return "Select Brand(s)";
                                            if (cfg.brands.length <= 2) return cfg.brands.join(", ");
                                            return `${cfg.brands.length} Brands Selected`;
                                        };

                                        return (
                                            <div
                                                key={cfg.id}
                                                className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-4"
                                            >
                                                {/* Override Block Header */}
                                                <div className="flex items-center justify-between gap-4">
                                                    <div className="flex-1 max-w-md relative brand-override-select-container">
                                                        <label className="block text-xs font-bold text-slate-650 mb-1.5">
                                                            Apply override to Brand(s) <span className="text-rose-500">*</span>
                                                        </label>
                                                        <div
                                                            onClick={() =>
                                                                setBrandConfigs(
                                                                    brandConfigs.map((c) =>
                                                                        c.id === cfg.id ? { ...c, isDropdownOpen: !c.isDropdownOpen } : c
                                                                    )
                                                                )
                                                            }
                                                            className="min-h-[38px] px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm cursor-pointer flex justify-between items-center text-slate-800"
                                                        >
                                                            <span className="truncate font-semibold">{getOverrideBrandLabel()}</span>
                                                            <svg
                                                                className={`w-4 h-4 text-slate-500 transition-transform duration-250 ${cfg.isDropdownOpen ? "rotate-180" : ""
                                                                    }`}
                                                                fill="none"
                                                                stroke="currentColor"
                                                                viewBox="0 0 24 24"
                                                            >
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                                            </svg>
                                                        </div>

                                                        {cfg.isDropdownOpen && (
                                                            <div className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto p-2 space-y-1">
                                                                <div className="px-1 py-1 sticky top-0 bg-white z-10">
                                                                    <input
                                                                        type="text"
                                                                        placeholder="Search Brand..."
                                                                        value={cfg.searchQuery}
                                                                        onChange={(e) =>
                                                                            setBrandConfigs(
                                                                                brandConfigs.map((c) =>
                                                                                    c.id === cfg.id ? { ...c, searchQuery: e.target.value } : c
                                                                                )
                                                                            )
                                                                        }
                                                                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#6804a1] focus:border-[#6804a1]"
                                                                        onClick={(e) => e.stopPropagation()}
                                                                    />
                                                                </div>

                                                                {filteredBrands.length === 0 ? (
                                                                    <div className="text-xs text-slate-400 p-2 text-center">No brand available</div>
                                                                ) : (
                                                                    filteredBrands.map((brandName) => (
                                                                        <label
                                                                            key={brandName}
                                                                            className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer text-xs text-slate-700"
                                                                        >
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={cfg.brands.includes(brandName)}
                                                                                onChange={() => handleToggleBrandInConfig(cfg.id, brandName)}
                                                                                className="h-3.5 w-3.5 text-[#6804a1] border-slate-300 rounded focus:ring-[#6804a1]"
                                                                            />
                                                                            {brandName}
                                                                        </label>
                                                                    ))
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveBrandConfig(cfg.id)}
                                                        className="mt-6 p-2 border border-rose-200 rounded-lg text-rose-650 bg-rose-50 hover:bg-rose-100 transition-colors cursor-pointer"
                                                        title="Remove Brand Override"
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

                                                {/* Override Formulas Grid */}
                                                <div className="bg-white border border-slate-200 rounded-lg p-4">
                                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Formula Overrides</h4>

                                                    {formulationColumns.length === 0 ? (
                                                        <div className="text-xs text-amber-600 bg-amber-50 p-2.5 rounded border border-amber-200 font-medium">
                                                            No Default Formulation columns have been configured above. Please add one first to override its formula.
                                                        </div>
                                                    ) : (
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            {formulationColumns.map((col) => {
                                                                const overrideCol = cfg.columns.find((c) => c.column_id === col.column_id);
                                                                const overrideVal = overrideCol ? overrideCol.formula : "";

                                                                return (
                                                                    <div key={col.column_id} className="space-y-1.5">
                                                                        <div className="flex justify-between items-center text-xs">
                                                                            <span className="font-semibold text-slate-700">
                                                                                Column {col.column_id} ({col.column_name})
                                                                            </span>
                                                                            <span className="text-slate-400 font-mono text-[10px]">
                                                                                Default: {col.formula || "—"}
                                                                            </span>
                                                                        </div>
                                                                        <input
                                                                            type="text"
                                                                            placeholder={`Enter formula override (e.g. =F2*1.05)`}
                                                                            value={overrideVal}
                                                                            onChange={(e) =>
                                                                                handleOverrideFormulaChange(cfg.id, col.column_id, e.target.value)
                                                                            }
                                                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-slate-800 bg-white"
                                                                        />
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>

                                            </div>
                                        );
                                    })}
                                </div>
                            )}
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
                                className="px-7 py-2.5 rounded-lg border-none text-white font-bold text-sm bg-gradient-to-br from-indigo-650 to-indigo-750 hover:opacity-95 shadow-[0_2px_8px_rgba(104,4,161,0.3)] disabled:bg-slate-400 disabled:cursor-not-allowed disabled:shadow-none cursor-pointer transition-all flex items-center justify-center"
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

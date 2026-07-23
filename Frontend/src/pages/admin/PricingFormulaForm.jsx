import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Navbar from "../../components/Navbar";
import { getStates } from "../../api/stateApi";
import { getDistinctBrands } from "../../api/itemModelApi";
import { getLandingTypes } from "../../api/landingTypeApi";
import { createPricingFormula, updatePricingFormula, getPricingFormulaById } from "../../api/pricingFormulaApi";
import toast from "react-hot-toast";

// Fixed standard columns (A to E) present in every Price List format
const FIXED_COLUMNS = [
    { column_id: "A", column_name: "Product Code", type: "Standard Field" },
    { column_id: "B", column_name: "Brand", type: "Standard Field" },
    { column_id: "C", column_name: "ICAT Name", type: "Standard Field" },
    { column_id: "D", column_name: "Model Group Name", type: "Standard Field" },
    { column_id: "E", column_name: "Model Name", type: "Standard Field" }
];

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

export default function PricingFormulaForm() {
    const { id, copyId } = useParams();
    const navigate = useNavigate();
    const isEdit = !!id;
    const isCopy = !!copyId;
    const targetId = id || copyId;

    // Master lists options
    const [statesList, setStatesList] = useState([]);
    const [allBrands, setAllBrands] = useState([]);
    const [landingTypesList, setLandingTypesList] = useState([]);

    // Form Fields
    const [selectedState, setSelectedState] = useState("");
    const [formatName, setFormatName] = useState("");
    const [columns, setColumns] = useState([
        { column_id: "F", column_name: "", type: "user input", formula: "", landing_types: ["All"], not_show_in_report: false, isLandingTypeDropdownOpen: false, landingTypeSearch: "" }
    ]);
    const [brandConfigs, setBrandConfigs] = useState([]);

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Load options and form data
    const loadFormData = async () => {
        setLoading(true);
        try {
            const [stateRes, brandRes, ltRes] = await Promise.all([
                getStates(),
                getDistinctBrands(),
                getLandingTypes()
            ]);
            setStatesList((stateRes.data?.data || []).filter((s) => s.live === "Yes"));
            setAllBrands(brandRes.data?.data || []);
            setLandingTypesList((ltRes.data?.data || []).filter((lt) => lt.live === "Yes"));

            if (targetId) {
                const varRes = await getPricingFormulaById(targetId);
                if (varRes.data?.success && varRes.data.data) {
                    const detail = varRes.data.data;
                    setSelectedState(detail.state_id ? detail.state_id.toString() : "");
                    setFormatName(isCopy ? `${detail.format_name || ""} (Copy)`.trim() : (detail.format_name || ""));

                    const parsedColumns = Array.isArray(detail.columns)
                        ? detail.columns
                        : typeof detail.columns === "string"
                            ? JSON.parse(detail.columns)
                            : [];
                    
                    const fixedIds = ["A", "B", "C", "D", "E"];
                    const dynamicColumnsOnly = parsedColumns.filter(c => !fixedIds.includes(c.column_id) && !c.is_deleted);
                    
                    const mappedColumns = dynamicColumnsOnly.map((col) => ({
                        ...col,
                        type: col.type === "formulation" ? "default formulation" : col.type,
                        landing_types: Array.isArray(col.landing_types) && col.landing_types.length > 0 ? col.landing_types : ["All"],
                        not_show_in_report: !!col.not_show_in_report,
                        isLandingTypeDropdownOpen: false,
                        landingTypeSearch: ""
                    }));
                    setColumns(mappedColumns.length > 0 ? mappedColumns : [
                        { column_id: "F", column_name: "", type: "user input", formula: "", landing_types: ["All"], not_show_in_report: false, isLandingTypeDropdownOpen: false, landingTypeSearch: "" }
                    ]);

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
                    toast.error("Failed to retrieve pricing formula details.");
                    navigate("/admin/pricing-formulas");
                }
            }
        } catch (error) {
            console.error("Error loading pricing formula form data:", error);
            toast.error("Failed to load options from the server.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadFormData();

        const handleClickOutside = (event) => {
            if (!event.target.closest(".brand-override-select-container")) {
                setBrandConfigs((prev) =>
                    prev.map((c) => ({ ...c, isDropdownOpen: false, searchQuery: "" }))
                );
            }
            if (!event.target.closest(".col-landing-type-select-container")) {
                setColumns((prev) =>
                    prev.map((c) => ({ ...c, isLandingTypeDropdownOpen: false, landingTypeSearch: "" }))
                );
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [id, copyId]);

    // Helper to find all columns depending on targetCol via formulas
    const checkColumnDependencies = (targetCol, currentColumns, currentBrandConfigs) => {
        if (!targetCol) return [];
        const targetId = targetCol.column_id;
        const targetName = targetCol.column_name ? targetCol.column_name.trim() : "";

        const dependentCols = new Set();
        const idRegex = targetId ? new RegExp(`\\b\\$?${targetId}\\$?(\\d+)?\\b`, "i") : null;

        const formulaHasDependency = (formula) => {
            if (!formula || typeof formula !== "string" || !formula.trim()) return false;
            const upperFormula = formula.trim().toUpperCase();

            if (idRegex && idRegex.test(upperFormula)) {
                return true;
            }
            if (targetName && targetName.length > 0) {
                const upperName = targetName.toUpperCase();
                if (upperFormula.includes(upperName)) {
                    return true;
                }
            }
            return false;
        };

        // Check default column formulas
        currentColumns.forEach((col) => {
            if (col.column_id !== targetId) {
                if (formulaHasDependency(col.formula)) {
                    const label = `Column ${col.column_id}${col.column_name ? ` (${col.column_name})` : ""}`;
                    dependentCols.add(label);
                }
            }
        });

        // Check brand override formulas
        (currentBrandConfigs || []).forEach((cfg) => {
            const brandNames = cfg.brands && cfg.brands.length > 0 ? cfg.brands.join(", ") : "Brand Override";
            (cfg.columns || []).forEach((col) => {
                if (col.column_id !== targetId) {
                    if (formulaHasDependency(col.formula)) {
                        const mainCol = currentColumns.find((c) => c.column_id === col.column_id);
                        const colLabel = mainCol ? `Column ${mainCol.column_id}${mainCol.column_name ? ` (${mainCol.column_name})` : ""}` : `Column ${col.column_id}`;
                        dependentCols.add(`${colLabel} (in ${brandNames} config)`);
                    }
                }
            });
        });

        return Array.from(dependentCols);
    };

    // Dynamic Column Handlers
    const handleAddColumn = () => {
        const nextIndex = columns.length;
        const nextColId = getExcelColumnLabel(nextIndex);
        setColumns([
            ...columns,
            { column_id: nextColId, column_name: "", type: "user input", formula: "", landing_types: ["All"], not_show_in_report: false, isLandingTypeDropdownOpen: false, landingTypeSearch: "" }
        ]);
    };

    const handleRemoveColumn = (indexToRemove) => {
        if (columns.length === 1) {
            toast.error("At least one column is required.");
            return;
        }

        const colToRemove = columns[indexToRemove];
        const dependents = checkColumnDependencies(colToRemove, columns, brandConfigs);

        if (dependents.length > 0) {
            const colLabel = `Column ${colToRemove.column_id}${colToRemove.column_name ? ` (${colToRemove.column_name})` : ""}`;
            toast.error(
                `Cannot delete ${colLabel} because ${dependents.join(", ")} depends on it in its formula. Please update or remove those formulas first.`,
                { duration: 6000 }
            );
            return;
        }

        const updated = columns
            .filter((_, idx) => idx !== indexToRemove)
            .map((col, idx) => ({
                ...col,
                column_id: getExcelColumnLabel(idx)
            }));
        setColumns(updated);

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
                    newCol.formula = "";
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

    const getColumnLandingTypeLabel = (col) => {
        const selected = col.landing_types || [];
        let label = "";
        if (selected.includes("All")) label = "All Landing Types";
        else if (selected.length === 0) label = "Select Landing Types";
        else if (selected.length <= 2) label = selected.join(", ");
        else label = `${selected.length} Types Selected`;

        if (col.not_show_in_report) {
            label += " • [Not Show in Report]";
        }
        return label;
    };

    const handleToggleColumnLandingType = (colIndex, typeName) => {
        setColumns((prevCols) =>
            prevCols.map((col, idx) => {
                if (idx !== colIndex) return col;
                let current = [...(col.landing_types || [])];
                const search = (col.landingTypeSearch || "").toLowerCase();
                const filteredLTs = landingTypesList.filter((lt) =>
                    lt.name.toLowerCase().includes(search)
                );

                if (typeName === "All") {
                    const isAllSelected = current.includes("All") || (
                        filteredLTs.length > 0 && filteredLTs.every((lt) => current.includes(lt.name))
                    );
                    if (isAllSelected) {
                        const filteredNames = filteredLTs.map((lt) => lt.name);
                        current = current.filter((t) => t !== "All" && !filteredNames.includes(t));
                    } else {
                        filteredLTs.forEach((lt) => {
                            if (!current.includes(lt.name)) current.push(lt.name);
                        });
                        if (landingTypesList.length > 0 && landingTypesList.every((lt) => current.includes(lt.name))) {
                            if (!current.includes("All")) current.push("All");
                        }
                    }
                } else {
                    if (current.includes(typeName)) {
                        current = current.filter((t) => t !== typeName && t !== "All");
                    } else {
                        current.push(typeName);
                        if (landingTypesList.length > 0 && landingTypesList.every((lt) => current.includes(lt.name))) {
                            if (!current.includes("All")) current.push("All");
                        }
                    }
                }
                return { ...col, landing_types: current };
            })
        );
    };

    const handleColumnLandingTypeSearchChange = (colIndex, value) => {
        setColumns((prevCols) =>
            prevCols.map((col, idx) => (idx === colIndex ? { ...col, landingTypeSearch: value } : col))
        );
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

        for (let i = 0; i < brandConfigs.length; i++) {
            const cfg = brandConfigs[i];
            if (cfg.brands.length === 0) {
                toast.error(`Please select at least one Brand for override configuration block ${i + 1}.`);
                return;
            }
        }

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
                    formula: (c.type === "default formulation" || c.type === "formulation") ? c.formula.trim() : "",
                    landing_types: Array.isArray(c.landing_types) && c.landing_types.length > 0 ? c.landing_types : ["All"],
                    not_show_in_report: !!c.not_show_in_report
                })),
                brandConfigs: cleanBrandConfigs
            };

            if (isEdit) {
                const res = await updatePricingFormula(id, payload);
                if (res.data?.success) {
                    toast.success("Pricing formula rule updated successfully.");
                    navigate("/admin/pricing-formulas");
                } else {
                    toast.error(res.data?.message || "Failed to update pricing formula rule.");
                }
            } else {
                const res = await createPricingFormula(payload);
                if (res.data?.success) {
                    toast.success(isCopy ? "Pricing formula rule copied successfully." : "Pricing formula rule created successfully.");
                    navigate("/admin/pricing-formulas");
                } else {
                    toast.error(res.data?.message || (isCopy ? "Failed to copy pricing formula rule." : "Failed to create pricing formula rule."));
                }
            }
        } catch (err) {
            console.error("Error saving pricing formula rule:", err);
            toast.error(err.response?.data?.message || "Failed to save pricing formula rule.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col flex-1 bg-slate-50 font-sans min-h-screen">
                <Navbar title="ERP Admin" />
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-slate-500 font-medium">Loading pricing formula configuration...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col flex-1 bg-slate-50 font-sans min-h-screen">
            <Navbar title="ERP Admin" />

            <main className="flex-1 w-full mx-auto px-6 py-8">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">
                            {isEdit ? "Edit Pricing Formula Rule" : isCopy ? "Copy Pricing Formula Rule" : "Create Pricing Formula Rule"}
                        </h1>
                        <p className="text-slate-500 mt-1">
                            {isEdit
                                ? "Update Excel pricing formula column output rules and state mappings."
                                : isCopy
                                    ? "Clone an existing pricing formula rule to setup a new format or state output."
                                    : "Setup new pricing formula column outputs for reports."}
                        </p>
                    </div>
                    <button
                        onClick={() => navigate("/admin/pricing-formulas")}
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

                <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
                    <form onSubmit={handleSubmit} className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

                        <div className="pt-4 border-t border-slate-200">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800">Columns Configurations</h3>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Columns A–E are fixed standard system fields. Custom formula & input columns start from F.
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

                            <div className="space-y-3">
                                {/* Fixed Standard System Columns (A - E) */}
                                {FIXED_COLUMNS.map((fixedCol) => (
                                    <div
                                        key={fixedCol.column_id}
                                        className="flex flex-col md:flex-row md:items-center gap-3 p-3.5 bg-slate-100/80 border border-slate-200 rounded-lg opacity-90 shadow-2xs"
                                    >
                                        <div className="w-16 flex items-center justify-center font-bold text-slate-600 bg-slate-200/90 border border-slate-300/70 rounded-md py-2 text-sm">
                                            {fixedCol.column_id}
                                        </div>

                                        <div className="flex-1">
                                            <input
                                                type="text"
                                                value={fixedCol.column_name}
                                                disabled
                                                readOnly
                                                className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm bg-slate-100/90 text-slate-700 font-semibold cursor-not-allowed select-none"
                                            />
                                        </div>

                                        <div className="w-full md:w-48">
                                            <div className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs bg-slate-100/90 text-slate-500 font-semibold flex items-center gap-1.5">
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5 text-slate-400">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                                                </svg>
                                                <span>{fixedCol.type}</span>
                                            </div>
                                        </div>

                                        <div className="w-full md:w-52 px-3 py-2 text-xs font-semibold text-slate-400 italic">
                                            System Default (Read Only)
                                        </div>

                                        <div className="w-9 h-9 flex items-center justify-center text-slate-400 shrink-0" title="Fixed column cannot be edited or deleted">
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-slate-400">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                                            </svg>
                                        </div>
                                    </div>
                                ))}

                                {/* Custom Dynamic User Columns (F, G, H...) */}
                                {columns.map((col, index) => (
                                    <div
                                        key={index}
                                        className="flex flex-col md:flex-row md:items-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded-lg"
                                    >
                                        <div className="w-16 flex items-center justify-center font-bold text-indigo-700 bg-indigo-100/70 border border-indigo-200 rounded-md py-2 text-sm">
                                            {col.column_id}
                                        </div>

                                        <div className="flex-1">
                                            <input
                                                type="text"
                                                placeholder="Column Name (e.g. Basic Price)"
                                                value={col.column_name}
                                                onChange={(e) => handleColumnFieldChange(index, "column_name", e.target.value)}
                                                required
                                                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                            />
                                        </div>

                                         <div className="w-full md:w-48">
                                            <select
                                                value={col.type}
                                                onChange={(e) => handleColumnFieldChange(index, "type", e.target.value)}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                            >
                                                <option value="user input">User Input</option>
                                                <option value="default formulation">Default Formulation</option>
                                            </select>
                                        </div>

                                        {(col.type === "default formulation" || col.type === "formulation") && (
                                            <div className="flex-1">
                                                <input
                                                    type="text"
                                                    placeholder="Formula (e.g. F2 + G2)"
                                                    value={col.formula}
                                                    onChange={(e) => handleColumnFieldChange(index, "formula", e.target.value)}
                                                    required
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                                />
                                            </div>
                                        )}

                                        <div className="w-full md:w-52 relative col-landing-type-select-container">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setColumns((prevCols) =>
                                                        prevCols.map((c, i) =>
                                                            i === index
                                                                ? { ...c, isLandingTypeDropdownOpen: !c.isLandingTypeDropdownOpen }
                                                                : { ...c, isLandingTypeDropdownOpen: false }
                                                        )
                                                    );
                                                }}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white text-left flex items-center justify-between focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                                title="Allowed Landing Types"
                                            >
                                                <span className="truncate text-slate-700 font-medium">{getColumnLandingTypeLabel(col)}</span>
                                                <svg className="w-4 h-4 text-slate-400 shrink-0 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </button>

                                            {col.isLandingTypeDropdownOpen && (
                                                <div className="absolute z-30 right-0 md:left-0 mt-1 w-60 bg-white border border-slate-200 rounded-md shadow-lg p-2 max-h-56 overflow-y-auto">
                                                    <input
                                                        type="text"
                                                        placeholder="Search landing types..."
                                                        value={col.landingTypeSearch || ""}
                                                        onChange={(e) => handleColumnLandingTypeSearchChange(index, e.target.value)}
                                                        className="w-full px-2 py-1 mb-2 border border-slate-200 rounded text-xs focus:outline-none focus:border-indigo-500"
                                                    />
                                                    <label className="flex items-center px-2 py-1.5 text-xs hover:bg-rose-50 rounded cursor-pointer font-bold text-rose-700 border-b border-slate-100 mb-1">
                                                        <input
                                                            type="checkbox"
                                                            checked={!!col.not_show_in_report}
                                                            onChange={(e) => {
                                                                const checked = e.target.checked;
                                                                setColumns((prevCols) =>
                                                                    prevCols.map((c, i) => i === index ? { ...c, not_show_in_report: checked } : c)
                                                                );
                                                            }}
                                                            className="mr-2 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                                                        />
                                                        Not Show in Report
                                                    </label>
                                                    <label className="flex items-center px-2 py-1 text-xs hover:bg-slate-50 rounded cursor-pointer font-bold text-indigo-700 border-b border-slate-100 mb-1">
                                                        <input
                                                            type="checkbox"
                                                            checked={
                                                                (col.landing_types || []).includes("All") ||
                                                                (landingTypesList.length > 0 && landingTypesList.every((lt) => (col.landing_types || []).includes(lt.name)))
                                                            }
                                                            onChange={() => handleToggleColumnLandingType(index, "All")}
                                                            className="mr-2 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                        />
                                                        All Landing Types
                                                    </label>
                                                    {landingTypesList
                                                        .filter((lt) => lt.name.toLowerCase().includes((col.landingTypeSearch || "").toLowerCase()))
                                                        .map((lt) => (
                                                            <label key={lt.id} className="flex items-center px-2 py-1 text-xs hover:bg-slate-50 rounded cursor-pointer text-slate-700">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={(col.landing_types || []).includes(lt.name)}
                                                                    onChange={() => handleToggleColumnLandingType(index, lt.name)}
                                                                    className="mr-2 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                                />
                                                                {lt.name}
                                                            </label>
                                                        ))}
                                                </div>
                                            )}
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => handleRemoveColumn(index)}
                                            className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors self-end md:self-center cursor-pointer"
                                            title="Remove Column"
                                        >
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                strokeWidth={2}
                                                stroke="currentColor"
                                                className="w-5 h-5"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {formulationColumns.length > 0 && (
                            <div className="pt-4 border-t border-slate-200">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-800">Brand-wise Formula Overrides</h3>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            Specify custom formulas for specific brands. Brands not configured will use default formulas.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleAddBrandConfig}
                                        className="flex items-center gap-1.5 px-3 py-1.5 border border-purple-200 rounded-lg text-indigo-650 bg-purple-50 hover:bg-purple-100 font-bold text-xs cursor-pointer transition-colors"
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
                                        Add Brand Override Block
                                    </button>
                                </div>

                                <div className="space-y-6">
                                    {brandConfigs.map((cfg, configIdx) => {
                                        const availableBrands = getAvailableBrands(cfg.id);
                                        const filteredBrands = availableBrands.filter((b) =>
                                            b.toLowerCase().includes((cfg.searchQuery || "").toLowerCase())
                                        );

                                        return (
                                            <div
                                                key={cfg.id}
                                                className="p-5 bg-purple-50/40 border border-purple-150 rounded-xl relative space-y-4"
                                            >
                                                <div className="flex items-center justify-between border-b border-purple-100 pb-3">
                                                    <span className="font-bold text-sm text-indigo-700">
                                                        Override Block #{configIdx + 1}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveBrandConfig(cfg.id)}
                                                        className="text-xs font-semibold text-rose-600 hover:text-rose-800 bg-rose-50 px-2.5 py-1 rounded border border-rose-200 cursor-pointer"
                                                    >
                                                        Remove Block
                                                    </button>
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                                        Select Brand(s)
                                                    </label>

                                                    <div className="relative brand-override-select-container">
                                                        <div
                                                            onClick={() =>
                                                                setBrandConfigs((prev) =>
                                                                    prev.map((c) =>
                                                                        c.id === cfg.id ? { ...c, isDropdownOpen: !c.isDropdownOpen } : c
                                                                    )
                                                                )
                                                            }
                                                            className="min-h-[42px] px-3 py-2 border border-slate-300 bg-white rounded-lg cursor-pointer flex flex-wrap items-center gap-1.5 text-sm"
                                                        >
                                                            {cfg.brands.length === 0 ? (
                                                                <span className="text-slate-400">Choose brands...</span>
                                                            ) : (
                                                                cfg.brands.map((b) => (
                                                                    <span
                                                                        key={b}
                                                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 border border-indigo-200"
                                                                    >
                                                                        {b}
                                                                        <span
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleToggleBrandInConfig(cfg.id, b);
                                                                            }}
                                                                            className="hover:text-indigo-900 cursor-pointer font-bold"
                                                                        >
                                                                            ×
                                                                        </span>
                                                                    </span>
                                                                ))
                                                            )}
                                                        </div>

                                                        {cfg.isDropdownOpen && (
                                                            <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-y-auto p-2">
                                                                <input
                                                                    type="text"
                                                                    placeholder="Search brand..."
                                                                    value={cfg.searchQuery || ""}
                                                                    onChange={(e) =>
                                                                        setBrandConfigs((prev) =>
                                                                            prev.map((c) =>
                                                                                c.id === cfg.id ? { ...c, searchQuery: e.target.value } : c
                                                                            )
                                                                        )
                                                                    }
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    className="w-full px-2.5 py-1.5 mb-2 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                                />

                                                                {filteredBrands.length === 0 ? (
                                                                    <div className="p-2 text-xs text-slate-400 text-center">
                                                                        No matching brands
                                                                    </div>
                                                                ) : (
                                                                    filteredBrands.map((brand) => {
                                                                        const isSelected = cfg.brands.includes(brand);
                                                                        return (
                                                                            <div
                                                                                key={brand}
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    handleToggleBrandInConfig(cfg.id, brand);
                                                                                }}
                                                                                className={`flex items-center justify-between px-3 py-1.5 text-xs rounded cursor-pointer ${
                                                                                    isSelected ? "bg-indigo-50 text-indigo-700 font-semibold" : "hover:bg-slate-50 text-slate-700"
                                                                                }`}
                                                                            >
                                                                                <span>{brand}</span>
                                                                                {isSelected && <span className="font-bold">✓</span>}
                                                                            </div>
                                                                        );
                                                                    })
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-bold text-slate-700 mb-2">
                                                        Formulas Override
                                                    </label>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                        {formulationColumns.map((col) => {
                                                            const existingOverride = cfg.columns.find((c) => c.column_id === col.column_id);
                                                            return (
                                                                <div key={col.column_id} className="flex items-center gap-2">
                                                                    <span className="w-12 text-center text-xs font-bold text-indigo-700 bg-white border border-slate-200 py-2 rounded">
                                                                        {col.column_id}
                                                                    </span>
                                                                    <input
                                                                        type="text"
                                                                        placeholder={`Default: ${col.formula || "None"}`}
                                                                        value={existingOverride?.formula || ""}
                                                                        onChange={(e) =>
                                                                            handleOverrideFormulaChange(cfg.id, col.column_id, e.target.value)
                                                                        }
                                                                        className="flex-1 px-3 py-1.5 border border-slate-300 rounded-md text-xs font-mono bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                                                                    />
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="pt-6 border-t border-slate-200 flex justify-end gap-3.5">
                            <button
                                type="button"
                                onClick={() => navigate("/admin/pricing-formulas")}
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
                                {saving ? (isEdit ? "Saving Changes..." : isCopy ? "Creating Copy..." : "Creating...") : isEdit ? "Save Changes" : isCopy ? "Create Copy" : "Create Pricing Formula Rule"}
                            </button>
                        </div>
                    </form>
                </div>
            </main>
        </div>
    );
}

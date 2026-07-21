import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import { getPricingFormulas, deletePricingFormula } from "../../api/pricingFormulaApi";
import { getBranches } from "../../api/branchApi";
import { getDistinctBrands, getItemModels } from "../../api/itemModelApi";
import DataTable from "../../components/DataTable";
import toast from "react-hot-toast";
import { usePermission } from "../../context/PermissionContext";
import ExcelJS from "exceljs";

// Helper to dynamically map formulas to specific spreadsheet rows
const mapFormulaForRow = (formula, targetRow) => {
    if (!formula) return "";
    let upper = formula.trim().toUpperCase();
    if (upper.startsWith("=")) {
        upper = upper.substring(1);
    }
    const hasRowNumbers = /[A-Z]+\d+/.test(upper);
    let mappedFormula = "";
    if (hasRowNumbers) {
        mappedFormula = upper.replace(/([A-Z]+)2(?!\d)/g, `$1${targetRow}`);
    } else {
        const functions = ["SUM", "AVERAGE", "MIN", "MAX", "IF", "COUNT", "ROUND", "ABS", "PRODUCT", "AND", "OR", "NOT", "IFERROR"];
        mappedFormula = upper.replace(/\b([A-Z]+)\b/g, (match) => {
            if (functions.includes(match)) return match;
            if (match.length <= 3) return `${match}${targetRow}`;
            return match;
        });
    }

    if (mappedFormula.startsWith("IFERROR")) {
        return mappedFormula;
    }
    return `IFERROR(${mappedFormula},"")`;
};

export default function PricingFormulaMasterList() {
    const [formulas, setFormulas] = useState([]);
    const [branches, setBranches] = useState([]);
    const [modelBrands, setModelBrands] = useState([]);
    const [itemModels, setItemModels] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const navigate = useNavigate();
    const { hasPermission } = usePermission();

    const loadFormulas = async () => {
        setLoading(true);
        setError("");
        try {
            const response = await getPricingFormulas();
            if (response.data?.success) {
                setFormulas(response.data.data || []);
            } else {
                setError(response.data?.message || "Failed to load pricing formula rules.");
            }
        } catch (err) {
            console.error("Failed to load pricing formula rules", err);
            setError("Unable to load pricing formula rules. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const loadBranches = async () => {
        try {
            const response = await getBranches();
            const rawData = response.data?.success ? (response.data.data || []) : (response.data || []);
            setBranches(rawData);
        } catch (err) {
            console.error("Failed to load branches for export", err);
        }
    };

    const loadModelBrands = async () => {
        try {
            const response = await getDistinctBrands();
            setModelBrands(response.data?.data || []);
        } catch (err) {
            console.error("Failed to load brands from model master for export", err);
        }
    };

    const loadItemModels = async () => {
        try {
            const response = await getItemModels();
            setItemModels(response.data?.data || []);
        } catch (err) {
            console.error("Failed to load item models for export", err);
        }
    };

    useEffect(() => {
        loadFormulas();
        loadBranches();
        loadModelBrands();
        loadItemModels();
    }, []);

    const handleExport = async (row) => {
        let toastId;
        try {
            toastId = toast.loading("Generating Excel file...");

            let currentItemModels = itemModels;
            if (currentItemModels.length === 0) {
                try {
                    const response = await getItemModels();
                    currentItemModels = response.data?.data || [];
                    setItemModels(currentItemModels);
                } catch (err) {
                    console.error("Failed to fetch item models in export fallback", err);
                }
            }

            const activeModels = currentItemModels.filter(
                (m) => !m.item_status || String(m.item_status).toLowerCase() === "active"
            );

            if (activeModels.length === 0) {
                toast.dismiss(toastId);
                toast.error("No active item models found to export. Please sync Model Master.");
                return;
            }

            const columnsList = Array.isArray(row.columns)
                ? row.columns
                : typeof row.columns === "string"
                    ? JSON.parse(row.columns)
                    : [];

            const brandConfigsList = Array.isArray(row.brand_configs)
                ? row.brand_configs
                : typeof row.brand_configs === "string"
                    ? JSON.parse(row.brand_configs)
                    : [];

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet("Pricing Formula Sheet", {
                views: [{ showGridLines: true }]
            });

            const excelColumns = [
                { header: "Product Code", key: "product_code", width: 18 },
                { header: "Brand", key: "brand", width: 18 },
                { header: "ICAT Name", key: "icat_name", width: 25 },
                { header: "Model Group Name", key: "model_group_name", width: 25 },
                { header: "Model", key: "model", width: 25 }
            ];

            columnsList.forEach((col) => {
                excelColumns.push({
                    header: col.column_name,
                    key: col.column_id,
                    width: 18
                });
            });

            worksheet.columns = excelColumns;

            let currentRowNum = 2;
            activeModels.forEach((modelItem) => {
                const brand = modelItem.brand_name || "";
                const rowData = {
                    product_code: modelItem.item_code || "",
                    brand: brand,
                    icat_name: modelItem.icat_name || "",
                    model_group_name: modelItem.model_group_name || "",
                    model: modelItem.model_name || ""
                };

                columnsList.forEach((col) => {
                    const isFormulation = col.type === "formulation" || col.type === "default formulation";
                    if (isFormulation) {
                        const override = brandConfigsList.find((cfg) => Array.isArray(cfg.brands) && cfg.brands.includes(brand));
                        const overrideCol = override?.columns?.find((c) => c.column_id === col.column_id);
                        const formulaToUse = (overrideCol && overrideCol.formula) ? overrideCol.formula : col.formula;

                        if (formulaToUse) {
                            const mappedFormula = mapFormulaForRow(formulaToUse, currentRowNum);
                            rowData[col.column_id] = { formula: mappedFormula };
                        } else {
                            rowData[col.column_id] = "";
                        }
                    } else {
                        rowData[col.column_id] = "";
                    }
                });

                worksheet.addRow(rowData);
                currentRowNum++;
            });

            // Style Header
            const headerRow = worksheet.getRow(1);
            headerRow.height = 26;
            headerRow.eachCell((cell) => {
                cell.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
                cell.fill = {
                    type: "pattern",
                    pattern: "solid",
                    fgColor: { argb: "FF6804A1" }
                };
                cell.alignment = { horizontal: "center", vertical: "middle" };
                cell.border = {
                    top: { style: "medium", color: { argb: "FF4A0266" } },
                    bottom: { style: "medium", color: { argb: "FF4A0266" } },
                    left: { style: "thin", color: { argb: "FFE2E8F0" } },
                    right: { style: "thin", color: { argb: "FFE2E8F0" } }
                };
            });

            // Style Data Rows
            for (let r = 2; r < currentRowNum; r++) {
                const dataRow = worksheet.getRow(r);
                dataRow.height = 20;
                dataRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                    cell.font = { name: "Segoe UI", size: 10 };
                    cell.border = {
                        top: { style: "thin", color: { argb: "FFE2E8F0" } },
                        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
                        left: { style: "thin", color: { argb: "FFE2E8F0" } },
                        right: { style: "thin", color: { argb: "FFE2E8F0" } }
                    };
                    if (colNumber <= 5) {
                        cell.alignment = { horizontal: "center", vertical: "middle" };
                    } else {
                        cell.alignment = { horizontal: "right", vertical: "middle" };
                    }
                });
            }

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `Pricing_Formula_Sheet_${row.state_name || "State"}_${new Date().toISOString().slice(0, 10)}.xlsx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            toast.dismiss(toastId);
            toast.success("Excel exported successfully!");
        } catch (err) {
            console.error("Export failed", err);
            if (toastId) toast.dismiss(toastId);
            toast.error("Failed to export pricing formula sheet.");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this pricing formula rule?")) return;
        try {
            const response = await deletePricingFormula(id);
            if (response.data?.success) {
                toast.success("Pricing formula rule deleted successfully");
                await loadFormulas();
            } else {
                toast.error(response.data?.message || "Unable to delete pricing formula rule.");
            }
        } catch (err) {
            console.error("Failed to delete pricing formula rule", err);
            toast.error(err?.response?.data?.message || "Unable to delete pricing formula rule.");
        }
    };

    const columns = useMemo(() => {
        const cols = [
            {
                key: "id",
                label: "ID",
                minWidth: "60px",
                render: (row) => <span className="font-semibold text-slate-500">#{row.id}</span>
            },
            {
                key: "state_name",
                label: "State",
                render: (row) => <span className="font-bold text-slate-800">{row.state_name || "N/A"}</span>
            },
            {
                key: "format_name",
                label: "Format Name",
                render: (row) => {
                    if (row.format_name) {
                        return <span className="font-bold text-slate-800">{row.format_name}</span>;
                    }
                    const brandList = Array.isArray(row.brands)
                        ? row.brands
                        : typeof row.brands === "string"
                            ? JSON.parse(row.brands)
                            : [];
                    return (
                        <span className="text-slate-500 italic text-xs">
                            Old Style ({brandList.join(", ")})
                        </span>
                    );
                }
            },
            {
                key: "brand_configs",
                label: "Brand-wise Overrides",
                minWidth: "200px",
                render: (row) => {
                    const configs = Array.isArray(row.brand_configs)
                        ? row.brand_configs
                        : typeof row.brand_configs === "string"
                            ? JSON.parse(row.brand_configs)
                            : [];
                    if (configs.length === 0) {
                        return <span className="text-slate-400 text-xs font-semibold">None (Uses Default)</span>;
                    }
                    const overriddenBrands = configs.flatMap((cfg) => cfg.brands || []);
                    return (
                        <div className="flex flex-wrap gap-1 max-w-[250px]">
                            {overriddenBrands.map((b, idx) => (
                                <span
                                    key={idx}
                                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-150"
                                >
                                    {b}
                                </span>
                            ))}
                        </div>
                    );
                }
            },
            {
                key: "columns",
                label: "Configured Columns",
                minWidth: "350px",
                render: (row) => {
                    const colsList = Array.isArray(row.columns)
                        ? row.columns
                        : typeof row.columns === "string"
                            ? JSON.parse(row.columns)
                            : [];
                    return (
                        <div className="flex flex-wrap gap-1.5 max-w-[450px]">
                            {colsList.map((col, idx) => (
                                <span
                                    key={idx}
                                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-150"
                                    title={col.type === "formulation" ? `Formula: ${col.formula}` : "User Input field"}
                                >
                                    <span className="font-bold mr-1">{col.column_id}</span>({col.column_name})
                                    {col.type === "formulation" ? (
                                        <span className="ml-1 text-[10px] text-indigo-500 font-mono">fx</span>
                                    ) : null}
                                </span>
                            ))}
                        </div>
                    );
                }
            }
        ];

        const canUpdate = hasPermission("variation_master", "update");
        const canDelete = hasPermission("variation_master", "delete");

        cols.push({
            key: "actions",
            label: "Actions",
            sortable: false,
            minWidth: "150px",
            render: (row) => (
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => handleExport(row)}
                        className="flex w-8 h-8 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 cursor-pointer hover:bg-emerald-100 transition-colors"
                        title="Export Excel"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.8}
                            stroke="currentColor"
                            className="w-[15px] h-[15px]"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12-3-3m0 0-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                            />
                        </svg>
                    </button>

                    {canUpdate && (
                        <button
                            onClick={() => navigate(`/admin/pricing-formulas/edit/${row.id}`)}
                            className="flex w-8 h-8 items-center justify-center rounded-lg border border-purple-200 bg-purple-50 text-indigo-650 cursor-pointer hover:bg-purple-100 transition-colors"
                            title="Edit"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth={1.8}
                                stroke="currentColor"
                                className="w-[15px] h-[15px]"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931Z"
                                />
                            </svg>
                        </button>
                    )}
                    {canDelete && (
                        <button
                            onClick={() => handleDelete(row.id)}
                            className="flex w-8 h-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 cursor-pointer hover:bg-rose-100 transition-colors"
                            title="Delete"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth={1.8}
                                stroke="currentColor"
                                className="w-[15px] h-[15px]"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M6 7.5h12m-1.5 0-.563 12.375A2.25 2.25 0 0113.693 21H10.307a2.25 2.25 0 01-2.244-2.125L7.5 7.5m3-3h3A1.5 1.5 0 0115 6v1.5H9V6a1.5 1.5 0 011.5-1.5Z"
                                />
                            </svg>
                        </button>
                    )}
                </div>
            )
        });

        return cols;
    }, [hasPermission, navigate, itemModels, handleExport]);

    return (
        <div className="flex flex-col flex-1 bg-slate-50 font-sans">
            <Navbar title="ERP Admin" />

            <main className="flex-1 flex flex-col w-full mx-auto px-[30px] py-8">
                {error && (
                    <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg mb-5 text-sm font-medium">
                        {error}
                    </div>
                )}
                <DataTable
                    tableId="variation_master"
                    title="Pricing Formula Master"
                    data={formulas}
                    columns={columns}
                    loading={loading}
                    searchPlaceholder="Search state or format name..."
                    actionButton={
                        hasPermission("variation_master", "write") ? (
                            <button
                                onClick={() => navigate("/admin/pricing-formulas/add")}
                                className="flex w-10 h-10 items-center justify-center rounded-[9px] bg-gradient-to-br from-indigo-650 to-indigo-750 text-white border-none cursor-pointer shadow-[0_2px_8px_rgba(104,4,161,0.35)] hover:opacity-95 transition-opacity"
                                title="Create Pricing Formula Rule"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth={2.5}
                                    stroke="currentColor"
                                    className="w-[18px] h-[18px]"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                </svg>
                            </button>
                        ) : null
                    }
                />
            </main>
        </div>
    );
}

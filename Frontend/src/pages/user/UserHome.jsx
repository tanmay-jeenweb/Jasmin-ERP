import { useEffect, useState, useMemo } from "react";
import Navbar from "../../components/Navbar";
import DataTable from "../../components/DataTable";
import { getAbmWiseCashDepositReport } from "../../api/stockCashDepositApi";
import { getStates } from "../../api/stateApi";
import { getTargetVsAchievements, syncTargetVsAchievements } from "../../api/targetVsAchievementApi";
import { getMobileBrands } from "../../api/mobileBrandApi";
import { getBrandWiseSales, syncBrandWiseSales } from "../../api/brandWiseSalesApi";
import toast from "react-hot-toast";
import * as XLSX from "xlsx-js-style";

export default function UserHome() {
    const user = useMemo(() => JSON.parse(localStorage.getItem("user") || "{}"), []);

        const [data, setData] = useState([]);
    const [states, setStates] = useState([]);
    const [selectedState, setSelectedState] = useState("All");
    const [loading, setLoading] = useState(false);

    // Brand Wise Sales States
    const [targetData, setTargetData] = useState([]);
    const [brandsList, setBrandsList] = useState([]);
    const [brandSalesData, setBrandSalesData] = useState([]);
    const [activeTab, setActiveTab] = useState("cash_deposit");
    const [brandSyncDate, setBrandSyncDate] = useState(() => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    });
    const [brandSyncing, setBrandSyncing] = useState(false);

    const [cashDepositTotals, setCashDepositTotals] = useState({
        opening_cash: 0,
        cash_deposit: 0,
        pending_cash_deposit: 0,
        pending_pct: 0
    });

    const loadCashDepositData = async (state) => {
        try {
            const res = await getAbmWiseCashDepositReport(state);
            if (res.data?.success) {
                setData(res.data.data || []);
                setCashDepositTotals(res.data.totals || {
                    opening_cash: 0,
                    cash_deposit: 0,
                    pending_cash_deposit: 0,
                    pending_pct: 0
                });
            }
        } catch (err) {
            console.error("Failed to load ABM wise cash deposit report:", err);
        }
    };

    const loadBrandSalesData = async (date, state = "All") => {
        try {
            const res = await getBrandWiseSales(date, state);
            setBrandSalesData(res.data?.data || []);
        } catch (err) {
            console.error("Failed to load brand wise sales:", err);
        }
    };

    // Load states, report data, target vs achievement, and brands
    const loadData = async () => {
        setLoading(true);
        try {
            const [statesRes, targetRes, brandsRes] = await Promise.all([
                getStates().catch(err => {
                    console.error("Failed to load states from API:", err);
                    return { data: { data: [] } };
                }),
                getTargetVsAchievements().catch(err => {
                    console.error("Failed to load target vs achievement data:", err);
                    return { data: { data: [] } };
                }),
                getMobileBrands().catch(err => {
                    console.error("Failed to load brands from API:", err);
                    return { data: { data: [] } };
                })
            ]);

            setStates(statesRes.data.data || []);
            setTargetData(targetRes.data.data || []);
            setBrandsList(brandsRes.data.data || []);
            
            await Promise.all([
                loadCashDepositData(selectedState),
                loadBrandSalesData(brandSyncDate, selectedState)
            ]);
        } catch (err) {
            console.error("Failed to load dashboard data:", err);
            toast.error("Failed to load dashboard data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (states.length > 0) {
            loadCashDepositData(selectedState);
        }
    }, [selectedState]);

    useEffect(() => {
        if (brandSyncDate && states.length > 0) {
            loadBrandSalesData(brandSyncDate, selectedState);
        }
    }, [brandSyncDate, selectedState]);

    // Get list of states that actually have data in the report as fallback/helper
    const activeStates = useMemo(() => {
        const dbStates = states.map(s => s.name);
        return Array.from(new Set(dbStates)).sort((a, b) => a.localeCompare(b));
    }, [states]);

    // Format data with Total row appended for the table
    const formattedData = useMemo(() => {
        const base = data.map((item, index) => ({
            ...item,
            id: `abm-row-${index}`,
            sr_no: index + 1
        }));

        if (base.length === 0) return [];

        const totalRow = {
            id: "Total",
            sr_no: "",
            abm_name: "Total",
            opening_cash: cashDepositTotals.opening_cash,
            cash_deposit: cashDepositTotals.cash_deposit,
            pending_cash_deposit: cashDepositTotals.pending_cash_deposit,
            pending_pct: cashDepositTotals.pending_pct
        };

        return [...base, totalRow];
    }, [data, cashDepositTotals]);

    // Brand Totals calculated from real brandSalesData state

    // Calculate Brand Totals for Footer Row
    const brandTotals = useMemo(() => {
        const t = {
            ftd_qty_ach: 0,
            ftd_value_ach: 0,
            lmftd_qty_ach: 0,
            lmftd_value_ach: 0,
            mtd_qty_ach: 0,
            mtd_value_ach: 0,
            lmtd_qty_ach: 0,
            lmtd_value_ach: 0,
            growth_qty_percentage: 0,
            growth_value_percentage: 0
        };

        brandSalesData.forEach(row => {
            t.ftd_qty_ach += row.ftd_qty_ach;
            t.ftd_value_ach += row.ftd_value_ach;
            t.lmftd_qty_ach += row.lmftd_qty_ach;
            t.lmftd_value_ach += row.lmftd_value_ach;
            t.mtd_qty_ach += row.mtd_qty_ach;
            t.mtd_value_ach += row.mtd_value_ach;
            t.lmtd_qty_ach += row.lmtd_qty_ach;
            t.lmtd_value_ach += row.lmtd_value_ach;
        });

        t.growth_qty_percentage = t.mtd_qty_ach !== 0 ? ((t.mtd_qty_ach - t.lmtd_qty_ach) / t.mtd_qty_ach) * 100 : 0;
        t.growth_value_percentage = t.mtd_value_ach !== 0 ? ((t.mtd_value_ach - t.lmtd_value_ach) / t.mtd_value_ach) * 100 : 0;

        return t;
    }, [brandSalesData]);

    // Format Brand Data with Total row appended
    const formattedBrandData = useMemo(() => {
        const base = brandSalesData.map((item, index) => ({
            ...item,
            id: `brand-row-${index}`,
            sr_no: index + 1
        }));

        if (base.length === 0) return [];

        const totalRow = {
            id: "Total",
            sr_no: "",
            brand_name: "Total",
            ftd_qty_ach: brandTotals.ftd_qty_ach,
            ftd_value_ach: brandTotals.ftd_value_ach,
            lmftd_qty_ach: brandTotals.lmftd_qty_ach,
            lmftd_value_ach: brandTotals.lmftd_value_ach,
            mtd_qty_ach: brandTotals.mtd_qty_ach,
            mtd_value_ach: brandTotals.mtd_value_ach,
            lmtd_qty_ach: brandTotals.lmtd_qty_ach,
            lmtd_value_ach: brandTotals.lmtd_value_ach,
            growth_qty_percentage: brandTotals.growth_qty_percentage,
            growth_value_percentage: brandTotals.growth_value_percentage
        };

        return [...base, totalRow];
    }, [brandSalesData, brandTotals]);

    // Number formatting helper
    const formatVal = (val) => {
        if (val === null || val === undefined) return "0.00";
        return Number(val).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    // Format helper function for quantities
    const formatQtyVal = (val) => {
        if (val === null || val === undefined) return "0";
        return Number(val).toLocaleString("en-IN");
    };

    // Format helper function for values with Rupee symbol
    const formatValueVal = (val) => {
        if (val === null || val === undefined) return "₹ 0.00";
        return `₹ ${Number(val).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    // Excel Export function for ABM Cash Deposit Report
    const handleExportExcel = () => {
        try {
            if (data.length === 0) {
                toast.error("No data available to export");
                return;
            }

            const dataToExport = data.map((row, index) => ({
                "Sr. No": index + 1,
                "ABM Name": row.abm_name,
                "Opening Cash": row.opening_cash,
                "Cash Deposit": row.cash_deposit,
                "Pending Cash Deposit": row.pending_cash_deposit,
                "Pending Deposit %": `${(row.pending_pct || 0).toFixed(2)}%`
            }));

            // Add totals row
            dataToExport.push({
                "Sr. No": "Total",
                "ABM Name": "",
                "Opening Cash": cashDepositTotals.opening_cash,
                "Cash Deposit": cashDepositTotals.cash_deposit,
                "Pending Cash Deposit": cashDepositTotals.pending_cash_deposit,
                "Pending Deposit %": `${(cashDepositTotals.pending_pct || 0).toFixed(2)}%`
            });

            const worksheet = XLSX.utils.json_to_sheet(dataToExport);

            // Column width configuration
            const maxLens = {};
            dataToExport.forEach(row => {
                Object.keys(row).forEach(key => {
                    const val = String(row[key]);
                    maxLens[key] = Math.max(maxLens[key] || key.length, val.length);
                });
            });
            worksheet["!cols"] = Object.keys(maxLens).map(key => ({
                wch: maxLens[key] + 3
            }));

            // Table styling
            if (worksheet["!ref"]) {
                const range = XLSX.utils.decode_range(worksheet["!ref"]);
                for (let col = range.s.c; col <= range.e.c; col++) {
                    const headerAddress = XLSX.utils.encode_cell({ r: 0, c: col });
                    if (worksheet[headerAddress]) {
                        worksheet[headerAddress].s = {
                            font: { bold: true, color: { rgb: "1E293B" } },
                            fill: { fgColor: { rgb: "E9D5FF" } },
                            alignment: { horizontal: "center" }
                        };
                    }

                    // Style the last (Totals) row
                    const totalAddress = XLSX.utils.encode_cell({ r: range.e.r, c: col });
                    if (worksheet[totalAddress]) {
                        worksheet[totalAddress].s = {
                            font: { bold: true },
                            fill: { fgColor: { rgb: "F1F5F9" } }
                        };
                    }
                }
            }

            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "ABM Cash Deposit Summary");
            XLSX.writeFile(workbook, `ABM_Wise_Cash_Deposit_Report_${selectedState}.xlsx`);
            toast.success("Excel report exported successfully!");
        } catch (err) {
            console.error("Failed to export Excel report:", err);
            toast.error("Failed to export Excel report");
        }
    };

    // Excel Export function for Brand Wise Sales
    const handleExportBrandExcel = () => {
        try {
            if (brandSalesData.length === 0) {
                toast.error("No data available to export");
                return;
            }

            const dataToExport = brandSalesData.map((row, index) => ({
                "Sr. No": index + 1,
                "Brand Name": row.brand_name,
                "FTD QTY": row.ftd_qty_ach,
                "FTD Value": row.ftd_value_ach,
                "LMFTD QTY": row.lmftd_qty_ach,
                "LMFTD Value": row.lmftd_value_ach,
                "MTD QTY": row.mtd_qty_ach,
                "MTD Value": row.mtd_value_ach,
                "LMTD QTY": row.lmtd_qty_ach,
                "LMTD Value": row.lmtd_value_ach,
                "Growth QTY %": `${row.growth_qty_percentage.toFixed(2)}%`,
                "Growth Value %": `${row.growth_value_percentage.toFixed(2)}%`
            }));

            // Add totals row
            dataToExport.push({
                "Sr. No": "Total",
                "Brand Name": "",
                "FTD QTY": brandTotals.ftd_qty_ach,
                "FTD Value": brandTotals.ftd_value_ach,
                "LMFTD QTY": brandTotals.lmftd_qty_ach,
                "LMFTD Value": brandTotals.lmftd_value_ach,
                "MTD QTY": brandTotals.mtd_qty_ach,
                "MTD Value": brandTotals.mtd_value_ach,
                "LMTD QTY": brandTotals.lmtd_qty_ach,
                "LMTD Value": brandTotals.lmtd_value_ach,
                "Growth QTY %": `${brandTotals.growth_qty_percentage.toFixed(2)}%`,
                "Growth Value %": `${brandTotals.growth_value_percentage.toFixed(2)}%`
            });

            const worksheet = XLSX.utils.json_to_sheet(dataToExport);

            // Column width configuration
            const maxLens = {};
            dataToExport.forEach(row => {
                Object.keys(row).forEach(key => {
                    const val = String(row[key]);
                    maxLens[key] = Math.max(maxLens[key] || key.length, val.length);
                });
            });
            worksheet["!cols"] = Object.keys(maxLens).map(key => ({
                wch: maxLens[key] + 3
            }));

            // Table styling
            if (worksheet["!ref"]) {
                const range = XLSX.utils.decode_range(worksheet["!ref"]);
                for (let col = range.s.c; col <= range.e.c; col++) {
                    const headerAddress = XLSX.utils.encode_cell({ r: 0, c: col });
                    if (worksheet[headerAddress]) {
                        worksheet[headerAddress].s = {
                            font: { bold: true, color: { rgb: "1E293B" } },
                            fill: { fgColor: { rgb: "E9D5FF" } },
                            alignment: { horizontal: "center" }
                        };
                    }

                    // Style the last (Totals) row
                    const totalAddress = XLSX.utils.encode_cell({ r: range.e.r, c: col });
                    if (worksheet[totalAddress]) {
                        worksheet[totalAddress].s = {
                            font: { bold: true },
                            fill: { fgColor: { rgb: "F1F5F9" } }
                        };
                    }
                }
            }

            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Brand Wise Sales Summary");
            XLSX.writeFile(workbook, `Brand_Wise_Sales_Report.xlsx`);
            toast.success("Excel report exported successfully!");
        } catch (err) {
            console.error("Failed to export Excel report:", err);
            toast.error("Failed to export Excel report");
        }
    };

    // Brand Sync Handler
    const handleBrandSync = async () => {
        setBrandSyncing(true);
        try {
            const response = await syncBrandWiseSales(brandSyncDate);
            if (response.data?.success) {
                toast.success(response.data.message || "Brand Wise Sales synced successfully!");
                await loadBrandSalesData(brandSyncDate);
            } else {
                toast.error(response.data?.message || "Sync failed");
            }
        } catch (err) {
            console.error("Failed to sync Brand Wise Sales:", err);
            toast.error("Failed to sync Brand Wise Sales. Please try again.");
        } finally {
            setBrandSyncing(false);
        }
    };

    // Columns structure matching the DataTable structure for Cash Deposit Report
    const columns = useMemo(() => [
        {
            key: "sr_no",
            label: "Sr. No",
            minWidth: "70px",
            render: (row) => <span className={`font-semibold ${row.id === "Total" ? "text-slate-900 font-bold" : "text-slate-500"}`}>{row.sr_no}</span>
        },
        {
            key: "abm_name",
            label: "ABM Name",
            minWidth: "180px",
            render: (row) => <span className={row.id === "Total" ? "font-bold text-slate-900" : "font-semibold text-indigo-950"}>{row.abm_name || "—"}</span>
        },
        {
            key: "opening_cash",
            label: "Opening Cash",
            minWidth: "150px",
            render: (row) => <span className={row.id === "Total" ? "font-bold text-slate-900" : "font-medium text-slate-700"}>₹ {formatVal(row.opening_cash)}</span>
        },
        {
            key: "cash_deposit",
            label: "Cash Deposit",
            minWidth: "150px",
            render: (row) => <span className={row.id === "Total" ? "font-bold text-slate-900" : "font-medium text-slate-700"}>₹ {formatVal(row.cash_deposit)}</span>
        },
        {
            key: "pending_cash_deposit",
            label: "Pending Cash Deposit",
            minWidth: "180px",
            render: (row) => <span className={row.id === "Total" ? "font-extrabold text-rose-900" : "font-semibold text-rose-600"}>₹ {formatVal(row.pending_cash_deposit)}</span>
        },
        {
            key: "pending_pct",
            label: "Pending Deposit %",
            minWidth: "160px",
            render: (row) => {
                const pct = row.pending_pct || 0;
                let badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
                if (pct > 30) {
                    badgeClass = "bg-rose-50 text-rose-700 border-rose-200";
                } else if (pct > 10) {
                    badgeClass = "bg-amber-50 text-amber-700 border-amber-200";
                }
                return (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${badgeClass}`}>
                        {pct.toFixed(2)} %
                    </span>
                );
            }
        }
    ], [cashDepositTotals]);

    // Brand columns
    const brandColumns = useMemo(() => [
        {
            key: "sr_no",
            label: "Sr. No",
            minWidth: "70px",
            render: (row) => <span className={`font-semibold ${row.id === "Total" ? "text-slate-900 font-bold" : "text-slate-500"}`}>{row.sr_no}</span>
        },
        {
            key: "brand_name",
            label: "Brand Name",
            minWidth: "150px",
            render: (row) => <span className={row.id === "Total" ? "font-bold text-slate-900" : "font-semibold text-indigo-950"}>{row.brand_name || "—"}</span>
        },
        {
            key: "ftd_qty_ach",
            label: "FTD QTY",
            minWidth: "110px",
            render: (row) => <span className={row.id === "Total" ? "font-bold text-slate-900" : "font-medium text-slate-700"}>{formatQtyVal(row.ftd_qty_ach)}</span>
        },
        {
            key: "ftd_value_ach",
            label: "FTD Value",
            minWidth: "130px",
            render: (row) => <span className={row.id === "Total" ? "font-bold text-slate-900" : "font-medium text-slate-700"}>{formatValueVal(row.ftd_value_ach)}</span>
        },
        {
            key: "lmftd_qty_ach",
            label: "LMFTD QTY",
            minWidth: "110px",
            render: (row) => <span className={row.id === "Total" ? "font-bold text-slate-900" : "font-medium text-slate-600"}>{formatQtyVal(row.lmftd_qty_ach)}</span>
        },
        {
            key: "lmftd_value_ach",
            label: "LMFTD Value",
            minWidth: "130px",
            render: (row) => <span className={row.id === "Total" ? "font-bold text-slate-900" : "font-medium text-slate-600"}>{formatValueVal(row.lmftd_value_ach)}</span>
        },
        {
            key: "mtd_qty_ach",
            label: "MTD QTY",
            minWidth: "110px",
            render: (row) => <span className={row.id === "Total" ? "font-bold text-slate-900" : "font-semibold text-blue-700"}>{formatQtyVal(row.mtd_qty_ach)}</span>
        },
        {
            key: "mtd_value_ach",
            label: "MTD Value",
            minWidth: "170px",
            render: (row) => <span className={row.id === "Total" ? "font-bold text-slate-900" : "font-semibold text-blue-700"}>{formatValueVal(row.mtd_value_ach)}</span>
        },
        {
            key: "lmtd_qty_ach",
            label: "LMTD QTY",
            minWidth: "110px",
            render: (row) => <span className={row.id === "Total" ? "font-bold text-slate-900" : "font-medium text-slate-600"}>{formatQtyVal(row.lmtd_qty_ach)}</span>
        },
        {
            key: "lmtd_value_ach",
            label: "LMTD Value",
            minWidth: "170px",
            render: (row) => <span className={row.id === "Total" ? "font-bold text-slate-900" : "font-medium text-slate-600"}>{formatValueVal(row.lmtd_value_ach)}</span>
        },
        {
            key: "growth_qty_percentage",
            label: "Growth QTY%",
            minWidth: "130px",
            render: (row) => {
                const pct = row.growth_qty_percentage || 0;
                const isPositive = pct >= 0;
                const colorClass = isPositive ? "text-emerald-700 font-bold bg-emerald-50 border-emerald-200" : "text-rose-700 font-bold bg-rose-50 border-rose-200";
                return (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs border ${colorClass}`}>
                        {isPositive ? "+" : ""}{pct.toFixed(2)} %
                    </span>
                );
            }
        },
        {
            key: "growth_value_percentage",
            label: "Growth Value%",
            minWidth: "130px",
            render: (row) => {
                const pct = row.growth_value_percentage || 0;
                const isPositive = pct >= 0;
                const colorClass = isPositive ? "text-emerald-700 font-bold bg-emerald-50 border-emerald-200" : "text-rose-700 font-bold bg-rose-50 border-rose-200";
                return (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs border ${colorClass}`}>
                        {isPositive ? "+" : ""}{pct.toFixed(2)} %
                    </span>
                );
            }
        }
    ], [brandTotals]);

    // Filters element passed to DataTable toggleActions for Cash Deposit tab
    const filtersElement = (
        <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-semibold text-slate-600 flex items-center gap-1.5 whitespace-nowrap">
                State:
            </label>
            <select
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-700 outline-none focus:border-[#6804a1] focus:ring-1 focus:ring-[#6804a1] shadow-sm transition-all duration-150 cursor-pointer min-w-[150px]"
            >
                <option value="All">All States</option>
                {activeStates.map(state => (
                    <option key={state} value={state}>{state}</option>
                ))}
            </select>
        </div>
    );

    // Export button passed to DataTable actionButton for Cash Deposit tab
    const exportButton = (
        <button
            onClick={handleExportExcel}
            className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-lg bg-[#6804a1] hover:bg-[#520380] text-white text-sm font-semibold shadow-md transition-all duration-200 cursor-pointer border-none focus:outline-none"
            title="Export report to Excel"
        >
            <i className="fa-solid fa-file-excel text-sm"></i>
            <span>Export</span>
        </button>
    );

    // Filters/sync elements for Brand Wise Sales tab
    const brandSyncElement = (
        <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-lg px-2 h-10">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Sync Date</span>
                <input
                    type="date"
                    value={brandSyncDate}
                    onChange={(e) => setBrandSyncDate(e.target.value)}
                    className="bg-transparent border-none text-sm text-slate-700 font-medium focus:outline-none cursor-pointer"
                />
            </div>
            <label className="text-sm font-semibold text-slate-600 flex items-center gap-1.5 whitespace-nowrap">
                State:
            </label>
            <select
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-700 outline-none focus:border-[#6804a1] focus:ring-1 focus:ring-[#6804a1] shadow-sm transition-all duration-150 cursor-pointer min-w-[150px]"
            >
                <option value="All">All States</option>
                {activeStates.map(state => (
                    <option key={state} value={state}>{state}</option>
                ))}
            </select>
        </div>
    );

    const brandActionButton = (
        <div className="flex items-center gap-3">
            <button
                onClick={handleBrandSync}
                disabled={brandSyncing || loading}
                className="flex items-center gap-2 h-10 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-md transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border-none focus:outline-none"
                title="Sync Brand Wise Sales from External API"
            >
                {brandSyncing ? "Syncing..." : "Sync"}
            </button>
            <button
                onClick={handleExportBrandExcel}
                className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-lg bg-[#6804a1] hover:bg-[#520380] text-white text-sm font-semibold shadow-md transition-all duration-200 cursor-pointer border-none focus:outline-none"
                title="Export report to Excel"
            >
                <i className="fa-solid fa-file-excel text-sm"></i>
                <span>Export</span>
            </button>
        </div>
    );

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 font-sans text-slate-900">
            <Navbar title="ERP Dashboard" />

            <main className="flex-grow w-full mx-auto py-8 px-4 sm:px-6 lg:px-8">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-slate-900">Dashboard Overview</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Welcome back, <span className="font-semibold text-[#6804a1]">{user.name || "User"}</span>. View real-time reports and sales analytics.
                    </p>
                </div>

                {/* Tabs */}
                <div className="border-b border-slate-200 mb-6">
                    <nav className="-mb-px flex space-x-8">
                        <button
                            onClick={() => setActiveTab("cash_deposit")}
                            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-semibold text-sm transition-colors cursor-pointer focus:outline-none
                                ${activeTab === 'cash_deposit'
                                    ? 'border-[#6804a1] text-[#6804a1]'
                                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                                }`}
                        >
                            Cash Deposit Report (ABM Wise)
                        </button>
                        <button
                            onClick={() => setActiveTab("brand_sales")}
                            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-semibold text-sm transition-colors cursor-pointer focus:outline-none
                                ${activeTab === 'brand_sales'
                                    ? 'border-[#6804a1] text-[#6804a1]'
                                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                                }`}
                        >
                            Brand Wise Sales
                        </button>
                    </nav>
                </div>

                {/* Tab 1: Cash Deposit Report */}
                {activeTab === "cash_deposit" && (
                    <div className="flex-1 flex flex-col mb-8">
                        <DataTable
                            tableId="abm_wise_cash_deposit_report"
                            title="ABM Wise Cash Deposit Report"
                            data={formattedData}
                            columns={columns}
                            loading={loading}
                            toggleActions={filtersElement}
                            actionButton={exportButton}
                            searchPlaceholder="Search ABM names..."
                        />
                    </div>
                )}

                {/* Tab 2: Brand Wise Sales */}
                {activeTab === "brand_sales" && (
                    <div className="flex-1 flex flex-col mb-8">
                        <DataTable
                            tableId="brand_wise_sales_report"
                            title="Brand Wise Sales"
                            data={formattedBrandData}
                            columns={brandColumns}
                            loading={loading}
                            toggleActions={brandSyncElement}
                            actionButton={brandActionButton}
                            searchPlaceholder="Search brand name..."
                        />
                    </div>
                )}
            </main>
        </div>
    );
}

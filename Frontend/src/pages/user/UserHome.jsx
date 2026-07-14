import { useEffect, useState, useMemo } from "react";
import Navbar from "../../components/Navbar";
import DataTable from "../../components/DataTable";
import { getStockCashDepositReport } from "../../api/stockCashDepositApi";
import { getStates } from "../../api/stateApi";
import toast from "react-hot-toast";
import * as XLSX from "xlsx-js-style";

export default function UserHome() {
    const user = useMemo(() => JSON.parse(localStorage.getItem("user") || "{}"), []);

    const [data, setData] = useState([]);
    const [states, setStates] = useState([]);
    const [selectedState, setSelectedState] = useState("All");
    const [loading, setLoading] = useState(false);

    // Load states and report data
    const loadData = async () => {
        setLoading(true);
        try {
            const [reportRes, statesRes] = await Promise.all([
                getStockCashDepositReport(),
                getStates().catch(err => {
                    console.error("Failed to load states from API:", err);
                    return { data: { data: [] } };
                })
            ]);

            setData(reportRes.data.data || []);
            setStates(statesRes.data.data || []);
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

    // Get list of states that actually have data in the report as fallback/helper
    const activeStates = useMemo(() => {
        const reportStates = data
            .map(r => r.state_name)
            .filter(name => name && name !== "—");
        const uniqueReportStates = Array.from(new Set(reportStates));
        
        // Merge with all states from database to be comprehensive
        const dbStates = states.map(s => s.name);
        const combined = Array.from(new Set([...uniqueReportStates, ...dbStates]));
        return combined.sort((a, b) => a.localeCompare(b));
    }, [data, states]);

    // Group data by ABM Wise Cash Deposit
    const abmSummary = useMemo(() => {
        const summary = {};
        
        data.forEach(item => {
            // Apply State Filter
            if (selectedState !== "All" && item.state_name !== selectedState) {
                return;
            }

            const abm = item.abm_name || "—";
            if (!summary[abm]) {
                summary[abm] = {
                    abm_name: abm,
                    opening_cash: 0,
                    cash_deposit: 0,
                    pending_cash_deposit: 0
                };
            }

            summary[abm].opening_cash += Number(item.opening_cash_deposit_pending || 0);
            summary[abm].cash_deposit += Number(item.cash_deposit || 0);
            summary[abm].pending_cash_deposit += Number(item.pending_cash_deposit || 0);
        });

        return Object.values(summary).map(group => {
            const pending_pct = group.opening_cash > 0
                ? (group.pending_cash_deposit / group.opening_cash) * 100
                : 0;
            return {
                ...group,
                pending_pct
            };
        });
    }, [data, selectedState]);

    // Calculate Summary Totals for Cards and Table Footer
    const totals = useMemo(() => {
        const t = {
            opening_cash: 0,
            cash_deposit: 0,
            pending_cash_deposit: 0,
            pending_pct: 0
        };

        // Use the state-filtered summary (abmSummary) so cards match the selected state
        abmSummary.forEach(item => {
            t.opening_cash += item.opening_cash;
            t.cash_deposit += item.cash_deposit;
            t.pending_cash_deposit += item.pending_cash_deposit;
        });

        t.pending_pct = t.opening_cash > 0
            ? (t.pending_cash_deposit / t.opening_cash) * 100
            : 0;

        return t;
    }, [abmSummary]);

    // Format data with Total row appended for the table
    const formattedData = useMemo(() => {
        const base = abmSummary.map((item, index) => ({
            ...item,
            id: `abm-row-${index}`,
            sr_no: index + 1
        }));

        if (base.length === 0) return [];

        const totalRow = {
            id: "Total",
            sr_no: "",
            abm_name: "Total",
            opening_cash: totals.opening_cash,
            cash_deposit: totals.cash_deposit,
            pending_cash_deposit: totals.pending_cash_deposit,
            pending_pct: totals.pending_pct
        };

        return [...base, totalRow];
    }, [abmSummary, totals]);

    // Number formatting helper
    const formatVal = (val) => {
        if (val === null || val === undefined) return "0.00";
        return Number(val).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    // Excel Export function
    const handleExportExcel = () => {
        try {
            if (abmSummary.length === 0) {
                toast.error("No data available to export");
                return;
            }

            const dataToExport = abmSummary.map((row, index) => ({
                "Sr. No": index + 1,
                "ABM Name": row.abm_name,
                "Opening Cash": row.opening_cash,
                "Cash Deposit": row.cash_deposit,
                "Pending Cash Deposit": row.pending_cash_deposit,
                "Pending Deposit %": `${row.pending_pct.toFixed(2)}%`
            }));

            // Add totals row
            dataToExport.push({
                "Sr. No": "Total",
                "ABM Name": "",
                "Opening Cash": totals.opening_cash,
                "Cash Deposit": totals.cash_deposit,
                "Pending Cash Deposit": totals.pending_cash_deposit,
                "Pending Deposit %": `${totals.pending_pct.toFixed(2)}%`
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
                            font: { bold: true, color: { rgb: "FFFFFF" } },
                            fill: { fgColor: { rgb: "6804A1" } },
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

    // Columns structure matching the DataTable structure
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
    ], [totals]);

    // Filters element passed to DataTable toggleActions
    const filtersElement = (
        <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-semibold text-slate-600 flex items-center gap-1.5 whitespace-nowrap">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-[#6804a1]">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581a1.44 1.44 0 0 0 2.037 0l4.318-4.317a1.44 1.44 0 0 0 0-2.037L10.06 3.66a2.25 2.25 0 0 0-1.591-.659Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12.75 7.5h.008v.008h-.008V7.5Z" />
                </svg>
                Filter by State:
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

    // Export button passed to DataTable actionButton
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

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 font-sans text-slate-900">
            <Navbar title="ERP Dashboard" />

            <main className="flex-grow w-full max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-slate-900">Dashboard Overview</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Welcome back, <span className="font-semibold text-[#6804a1]">{user.name || "User"}</span>. Real-time cash deposit reports.
                    </p>
                </div>

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
            </main>
        </div>
    );
}

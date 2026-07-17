import { useEffect, useState, useMemo } from "react";
import Navbar from "../../components/Navbar";
import { getABMWiseTargetVsAchievements } from "../../api/targetVsAchievementApi";
import DataTable from "../../components/DataTable";
import * as XLSX from "xlsx-js-style";
import toast from "react-hot-toast";

export default function ABMWiseTvAReport() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exportingReport, setExportingReport] = useState(false);

  // Filter States
  const [selectedStates, setSelectedStates] = useState([]);
  const [stateSearchText, setStateSearchText] = useState("");
  const [isStateFilterOpen, setIsStateFilterOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await getABMWiseTargetVsAchievements();
      setData(response.data.data || []);
    } catch (err) {
      console.error("Failed to load target vs achievement data", err);
      setError("Unable to load Target vs Achievement data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Format quantities, values and percentages
  const formatQty = (val) => {
    if (val === null || val === undefined) return "—";
    return Number(val).toLocaleString('en-IN');
  };

  const formatDdrQty = (val) => {
    if (val === null || val === undefined) return "—";
    return Number(val).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  const formatVal = (val) => {
    if (val === null || val === undefined) return "—";
    return Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatPct = (val) => {
    if (val === null || val === undefined) return "—";
    return `${Number(val).toFixed(2)}%`;
  };

  // Extract unique states
  const uniqueStates = useMemo(() => {
    const list = data
      .map(r => r.state_name)
      .filter(state => state && state !== "—");
    return Array.from(new Set(list)).sort((a, b) => a.localeCompare(b));
  }, [data]);

  // Apply state filter to raw data
  const filteredRawData = useMemo(() => {
    return data.filter(item => {
      return selectedStates.length === 0 || selectedStates.includes(item.state_name);
    });
  }, [data, selectedStates]);

  // Group filtered raw data by ABM Name
  const groupedData = useMemo(() => {
    const groups = {};

    filteredRawData.forEach(item => {
      const abm = item.abm_name || "—";
      if (!groups[abm]) {
        groups[abm] = {
          abm_name: abm,
          qty_tgt: 0,
          value_tgt: 0,
          ftd_qty_ach: 0,
          ftd_value_ach: 0,
          lmftd_qty_ach: 0,
          lmftd_value_ach: 0,
          mtd_qty_ach: 0,
          mtd_value_ach: 0,
          lmtd_qty_ach: 0,
          lmtd_value_ach: 0,
          btd_qty: 0,
          btd_value: 0,
          ddr_qty: 0,
          ddr_value: 0
        };
      }

      groups[abm].qty_tgt += Number(item.qty_tgt || 0);
      groups[abm].value_tgt += Number(item.value_tgt || 0);
      groups[abm].ftd_qty_ach += Number(item.ftd_qty_ach || 0);
      groups[abm].ftd_value_ach += Number(item.ftd_value_ach || 0);
      groups[abm].lmftd_qty_ach += Number(item.lmftd_qty_ach || 0);
      groups[abm].lmftd_value_ach += Number(item.lmftd_value_ach || 0);
      groups[abm].mtd_qty_ach += Number(item.mtd_qty_ach || 0);
      groups[abm].mtd_value_ach += Number(item.mtd_value_ach || 0);
      groups[abm].lmtd_qty_ach += Number(item.lmtd_qty_ach || 0);
      groups[abm].lmtd_value_ach += Number(item.lmtd_value_ach || 0);
      groups[abm].btd_qty += Number(item.btd_qty || 0);
      groups[abm].btd_value += Number(item.btd_value || 0);
      groups[abm].ddr_qty += Number(item.ddr_qty || 0);
      groups[abm].ddr_value += Number(item.ddr_value || 0);
    });

    return Object.values(groups).map((group, index) => {
      const qtyTgt = group.qty_tgt;
      const valueTgt = group.value_tgt;
      const mtdQty = group.mtd_qty_ach;
      const mtdVal = group.mtd_value_ach;
      const lmtdQty = group.lmtd_qty_ach;
      const lmtdVal = group.lmtd_value_ach;

      const mtd_qty_percentage_ach = qtyTgt > 0 ? (mtdQty / qtyTgt) * 100 : 0;
      const mtd_value_percentage_ach = valueTgt > 0 ? (mtdVal / valueTgt) * 100 : 0;

      const growth_qty_percentage = mtdQty !== 0 ? ((mtdQty - lmtdQty) / mtdQty) * 100 : 0;
      const growth_value_percentage = mtdVal !== 0 ? ((mtdVal - lmtdVal) / mtdVal) * 100 : 0;

      return {
        ...group,
        id: index + 1,
        sr_no: index + 1,
        mtd_qty_percentage_ach,
        mtd_value_percentage_ach,
        growth_qty_percentage,
        growth_value_percentage
      };
    });
  }, [filteredRawData]);

  // Calculate totals
  const totals = useMemo(() => {
    const t = {
      qty_tgt: 0,
      value_tgt: 0,
      ftd_qty_ach: 0,
      ftd_value_ach: 0,
      lmftd_qty_ach: 0,
      lmftd_value_ach: 0,
      mtd_qty_ach: 0,
      mtd_value_ach: 0,
      lmtd_qty_ach: 0,
      lmtd_value_ach: 0,
      btd_qty: 0,
      btd_value: 0,
      ddr_qty: 0,
      ddr_value: 0,
      mtd_qty_percentage_ach: 0,
      mtd_value_percentage_ach: 0,
      growth_qty_percentage: 0,
      growth_value_percentage: 0
    };

    groupedData.forEach(g => {
      t.qty_tgt += g.qty_tgt;
      t.value_tgt += g.value_tgt;
      t.ftd_qty_ach += g.ftd_qty_ach;
      t.ftd_value_ach += g.ftd_value_ach;
      t.lmftd_qty_ach += g.lmftd_qty_ach;
      t.lmftd_value_ach += g.lmftd_value_ach;
      t.mtd_qty_ach += g.mtd_qty_ach;
      t.mtd_value_ach += g.mtd_value_ach;
      t.lmtd_qty_ach += g.lmtd_qty_ach;
      t.lmtd_value_ach += g.lmtd_value_ach;
      t.btd_qty += g.btd_qty;
      t.btd_value += g.btd_value;
      t.ddr_qty += g.ddr_qty;
      t.ddr_value += g.ddr_value;
    });

    t.mtd_qty_percentage_ach = t.qty_tgt > 0 ? (t.mtd_qty_ach / t.qty_tgt) * 100 : 0;
    t.mtd_value_percentage_ach = t.value_tgt > 0 ? (t.mtd_value_ach / t.value_tgt) * 100 : 0;
    t.growth_qty_percentage = t.mtd_qty_ach !== 0 ? ((t.mtd_qty_ach - t.lmtd_qty_ach) / t.mtd_qty_ach) * 100 : 0;
    t.growth_value_percentage = t.mtd_value_ach !== 0 ? ((t.mtd_value_ach - t.lmtd_value_ach) / t.mtd_value_ach) * 100 : 0;

    return t;
  }, [groupedData]);

  // Export full report to Excel using xlsx-js-style
  const handleExportReport = async () => {
    if (groupedData.length === 0) {
      toast.error("No data available to export.");
      return;
    }
    setExportingReport(true);
    try {
      const monthYear = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });

      const headers = [
        "Sr. No",
        "ABM Name",
        "QTY TGT",
        "Value TGT",
        "FTD QTY ACH",
        "FTD Value ACH",
        "LMFTD QTY ACH",
        "LMFTD Value ACH",
        "MTD QTY ACH",
        "MTD Value ACH",
        "MTD QTY % ACH",
        "MTD Value % ACH",
        "LMTD QTY ACH",
        "LMTD Value ACH",
        "BTD Qty.",
        "BTD Value",
        "DDR Qty.",
        "DDR Value",
        "Growth Qty. %",
        "Growth Value %"
      ];

      const rows = groupedData.map((item, index) => [
        index + 1,
        item.abm_name || "",
        item.qty_tgt !== null && item.qty_tgt !== undefined ? Number(item.qty_tgt) : null,
        item.value_tgt !== null && item.value_tgt !== undefined ? Number(item.value_tgt) : null,
        item.ftd_qty_ach !== null && item.ftd_qty_ach !== undefined ? Number(item.ftd_qty_ach) : null,
        item.ftd_value_ach !== null && item.ftd_value_ach !== undefined ? Number(item.ftd_value_ach) : null,
        item.lmftd_qty_ach !== null && item.lmftd_qty_ach !== undefined ? Number(item.lmftd_qty_ach) : null,
        item.lmftd_value_ach !== null && item.lmftd_value_ach !== undefined ? Number(item.lmftd_value_ach) : null,
        item.mtd_qty_ach !== null && item.mtd_qty_ach !== undefined ? Number(item.mtd_qty_ach) : null,
        item.mtd_value_ach !== null && item.mtd_value_ach !== undefined ? Number(item.mtd_value_ach) : null,
        item.mtd_qty_percentage_ach !== null && item.mtd_qty_percentage_ach !== undefined ? Number(item.mtd_qty_percentage_ach) / 100 : null,
        item.mtd_value_percentage_ach !== null && item.mtd_value_percentage_ach !== undefined ? Number(item.mtd_value_percentage_ach) / 100 : null,
        item.lmtd_qty_ach !== null && item.lmtd_qty_ach !== undefined ? Number(item.lmtd_qty_ach) : null,
        item.lmtd_value_ach !== null && item.lmtd_value_ach !== undefined ? Number(item.lmtd_value_ach) : null,
        item.btd_qty !== null && item.btd_qty !== undefined ? Number(item.btd_qty) : null,
        item.btd_value !== null && item.btd_value !== undefined ? Number(item.btd_value) : null,
        item.ddr_qty !== null && item.ddr_qty !== undefined ? Number(item.ddr_qty) : null,
        item.ddr_value !== null && item.ddr_value !== undefined ? Number(item.ddr_value) : null,
        item.growth_qty_percentage !== null && item.growth_qty_percentage !== undefined ? Number(item.growth_qty_percentage) / 100 : null,
        item.growth_value_percentage !== null && item.growth_value_percentage !== undefined ? Number(item.growth_value_percentage) / 100 : null
      ]);

      const totalRow = [
        "",
        "TOTAL",
        totals.qty_tgt,
        totals.value_tgt,
        totals.ftd_qty_ach,
        totals.ftd_value_ach,
        totals.lmftd_qty_ach,
        totals.lmftd_value_ach,
        totals.mtd_qty_ach,
        totals.mtd_value_ach,
        totals.mtd_qty_percentage_ach / 100,
        totals.mtd_value_percentage_ach / 100,
        totals.lmtd_qty_ach,
        totals.lmtd_value_ach,
        totals.btd_qty,
        totals.btd_value,
        totals.ddr_qty,
        totals.ddr_value,
        totals.growth_qty_percentage / 100,
        totals.growth_value_percentage / 100
      ];

      const aoa = [headers, ...rows, totalRow];
      const worksheet = XLSX.utils.aoa_to_sheet(aoa);

      const range = XLSX.utils.decode_range(worksheet["!ref"]);

      const getNumFmt = (colIndex) => {
        const qtyCols = [2, 4, 6, 8, 12, 14, 16];
        const valCols = [3, 5, 7, 9, 13, 15, 17];
        const pctCols = [10, 11];
        const growthCols = [18, 19];

        if (qtyCols.includes(colIndex)) return "#,##0";
        if (valCols.includes(colIndex)) return "#,##0.00";
        if (pctCols.includes(colIndex)) return "0.00%";
        if (growthCols.includes(colIndex)) return "+0.00%;-0.00%;0.00%";
        return undefined;
      };

      for (let r = range.s.r; r <= range.e.r; r++) {
        for (let c = range.s.c; c <= range.e.c; c++) {
          const address = XLSX.utils.encode_cell({ r, c });
          if (!worksheet[address]) {
            worksheet[address] = { t: "s", v: "" };
          }
          const cell = worksheet[address];

          cell.s = {
            font: { name: "Segoe UI", sz: 10 },
            border: {
              top: { style: "thin", color: { rgb: "E2E8F0" } },
              bottom: { style: "thin", color: { rgb: "E2E8F0" } },
              left: { style: "thin", color: { rgb: "E2E8F0" } },
              right: { style: "thin", color: { rgb: "E2E8F0" } }
            }
          };

          if (r === 0) {
            // Header styling
            cell.s.font = { name: "Segoe UI", sz: 10, bold: true, color: { rgb: "FFFFFF" } };
            cell.s.fill = { fgColor: { rgb: "4F46E5" } };
            cell.s.alignment = { horizontal: "center", vertical: "center", wrapText: true };
            cell.s.border = {
              top: { style: "medium", color: { rgb: "3730A3" } },
              bottom: { style: "medium", color: { rgb: "3730A3" } }
            };
          } else if (r === range.e.r) {
            // Total row styling
            cell.s.font = { name: "Segoe UI", sz: 10, bold: true, color: { rgb: "1E293B" } };
            cell.s.fill = { fgColor: { rgb: "F1F5F9" } };
            cell.s.border = {
              top: { style: "thin", color: { rgb: "94A3B8" } },
              bottom: { style: "double", color: { rgb: "1E293B" } }
            };
            cell.s.alignment = (c === 0) ? { horizontal: "center" } : (c === 1 ? { horizontal: "left" } : { horizontal: "right" });

            const fmt = getNumFmt(c);
            if (fmt) cell.z = fmt;
          } else {
            // Data rows styling
            if (r % 2 === 0) {
              cell.s.fill = { fgColor: { rgb: "F8FAFC" } };
            }
            cell.s.alignment = (c === 0) ? { horizontal: "center" } : (c === 1 ? { horizontal: "left" } : { horizontal: "right" });

            const fmt = getNumFmt(c);
            if (fmt) cell.z = fmt;
          }
        }
      }

      // Column widths calculation
      const maxLens = {};
      headers.forEach((h, idx) => { maxLens[idx] = h.length; });
      aoa.forEach(row => {
        row.forEach((val, idx) => {
          let formattedVal = "";
          if (val !== null && val !== undefined) {
            if (typeof val === 'number') {
              formattedVal = val.toLocaleString('en-IN');
            } else {
              formattedVal = String(val);
            }
          }
          maxLens[idx] = Math.max(maxLens[idx] || 0, formattedVal.length);
        });
      });

      worksheet["!cols"] = Object.keys(maxLens).map(idx => ({
        wch: Math.max(maxLens[idx] + 3, 10)
      }));

      // Set row heights
      worksheet["!rows"] = [];
      worksheet["!rows"][0] = { hpt: 26 };
      for (let r = 1; r <= groupedData.length; r++) {
        worksheet["!rows"][r] = { hpt: 20 };
      }
      worksheet["!rows"][groupedData.length + 1] = { hpt: 22 };

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "ABM wise TvA Report");
      XLSX.writeFile(workbook, `ABM_wise_TvA_Report_${monthYear.replace(/\s+/g, '_')}.xlsx`);

      toast.success("Excel report exported successfully!");
    } catch (err) {
      console.error("Failed to export Excel report:", err);
      toast.error("Failed to export Excel report. Please try again.");
    } finally {
      setExportingReport(false);
    }
  };

  const columns = useMemo(() => [
    {
      key: "sr_no",
      label: "Sr. No",
      minWidth: "70px",
      render: (row) => <span className="font-semibold text-slate-500">{row.sr_no}</span>
    },
    {
      key: "abm_name",
      label: "ABM NAME",
      minWidth: "180px",
      render: (row) => <span className="font-semibold text-indigo-700">{row.abm_name || "—"}</span>
    },
    {
      key: "qty_tgt",
      label: "QTY TGT",
      minWidth: "110px",
      render: (row) => <span className="font-medium text-slate-700">{formatQty(row.qty_tgt)}</span>
    },
    {
      key: "value_tgt",
      label: "Value TGT",
      minWidth: "130px",
      render: (row) => <span className="font-medium text-slate-700">{formatVal(row.value_tgt)}</span>
    },
    {
      key: "ftd_qty_ach",
      label: "FTD QTY ACH",
      minWidth: "130px",
      render: (row) => <span className="text-emerald-700 font-semibold">{formatQty(row.ftd_qty_ach)}</span>
    },
    {
      key: "ftd_value_ach",
      label: "FTD Value ACH",
      minWidth: "140px",
      render: (row) => <span className="text-emerald-700 font-semibold">{formatVal(row.ftd_value_ach)}</span>
    },
    {
      key: "lmftd_qty_ach",
      label: "LMFTD QTY ACH",
      minWidth: "150px",
      render: (row) => <span className="text-slate-600">{formatQty(row.lmftd_qty_ach)}</span>
    },
    {
      key: "lmftd_value_ach",
      label: "LMFTD Value ACH",
      minWidth: "160px",
      render: (row) => <span className="text-slate-600">{formatVal(row.lmftd_value_ach)}</span>
    },
    {
      key: "mtd_qty_ach",
      label: "MTD QTY ACH",
      minWidth: "130px",
      render: (row) => <span className="text-blue-700 font-semibold">{formatQty(row.mtd_qty_ach)}</span>
    },
    {
      key: "mtd_value_ach",
      label: "MTD Value ACH",
      minWidth: "170px",
      render: (row) => <span className="text-blue-700 font-semibold">{formatVal(row.mtd_value_ach)}</span>
    },
    {
      key: "mtd_qty_percentage_ach",
      label: "MTD QTY % ACH",
      minWidth: "140px",
      render: (row) => {
        const pct = row.mtd_qty_percentage_ach;
        const color = pct >= 100 ? "text-emerald-600 font-bold" : "text-amber-600 font-semibold";
        return <span className={color}>{formatPct(pct)}</span>;
      }
    },
    {
      key: "mtd_value_percentage_ach",
      label: "MTD Value % ACH",
      minWidth: "150px",
      render: (row) => {
        const pct = row.mtd_value_percentage_ach;
        const color = pct >= 100 ? "text-emerald-600 font-bold" : "text-amber-600 font-semibold";
        return <span className={color}>{formatPct(pct)}</span>;
      }
    },
    {
      key: "lmtd_qty_ach",
      label: "LMTD QTY ACH",
      minWidth: "140px",
      render: (row) => <span className="text-slate-600">{formatQty(row.lmtd_qty_ach)}</span>
    },
    {
      key: "lmtd_value_ach",
      label: "LMTD Value ACH",
      minWidth: "170px",
      render: (row) => <span className="text-slate-600">{formatVal(row.lmtd_value_ach)}</span>
    },
    {
      key: "btd_qty",
      label: "BTD Qty.",
      minWidth: "110px",
      render: (row) => <span className="text-slate-700">{formatQty(row.btd_qty)}</span>
    },
    {
      key: "btd_value",
      label: "BTD Value",
      minWidth: "120px",
      render: (row) => <span className="text-slate-700">{formatVal(row.btd_value)}</span>
    },
    {
      key: "ddr_qty",
      label: "DDR Qty.",
      minWidth: "110px",
      render: (row) => <span className="text-slate-700">{formatDdrQty(row.ddr_qty)}</span>
    },
    {
      key: "ddr_value",
      label: "DDR Value",
      minWidth: "120px",
      render: (row) => <span className="text-slate-700">{formatVal(row.ddr_value)}</span>
    },
    {
      key: "growth_qty_percentage",
      label: "Growth Qty. %",
      minWidth: "135px",
      render: (row) => {
        const pct = row.growth_qty_percentage;
        const color = pct >= 0 ? "text-emerald-600 font-bold" : "text-rose-600 font-bold";
        return <span className={color}>{pct >= 0 ? `+${formatPct(pct)}` : formatPct(pct)}</span>;
      }
    },
    {
      key: "growth_value_percentage",
      label: "Growth Value %",
      minWidth: "140px",
      render: (row) => {
        const pct = row.growth_value_percentage;
        const color = pct >= 0 ? "text-emerald-600 font-bold" : "text-rose-600 font-bold";
        return <span className={color}>{pct >= 0 ? `+${formatPct(pct)}` : formatPct(pct)}</span>;
      }
    }
  ], []);

  // Filters Component
  const filtersElement = (
    <div className="flex flex-wrap items-center gap-3">
      {/* State Multi-select Dropdown */}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setIsStateFilterOpen(!isStateFilterOpen);
          }}
          className="flex items-center justify-between gap-2 h-10 px-3 rounded-lg border border-slate-300 bg-white hover:border-slate-400 text-sm font-semibold transition-colors duration-150 cursor-pointer focus:outline-none"
        >
          <span className="text-slate-700">
            {selectedStates.length === 0
              ? "All States"
              : `${selectedStates.length} State${selectedStates.length > 1 ? 's' : ''}`}
          </span>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3 text-slate-400">
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </button>

        {isStateFilterOpen && (
          <>
            <div className="fixed inset-0 z-45" onClick={() => setIsStateFilterOpen(false)}></div>
            <div className="absolute left-0 mt-1 w-64 rounded-xl border border-slate-200 bg-white shadow-xl py-2 z-50 flex flex-col">
              <div className="px-3 py-1.5 border-b border-slate-100 flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5 text-slate-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.602 10.602Z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search states..."
                  value={stateSearchText}
                  onChange={(e) => setStateSearchText(e.target.value)}
                  className="w-full text-xs border-none outline-none bg-transparent"
                />
              </div>
              <div className="px-2 py-1 border-b border-slate-100 flex items-center justify-between text-[11px] font-bold text-indigo-650">
                <button
                  type="button"
                  onClick={() => setSelectedStates(uniqueStates)}
                  className="bg-transparent border-none cursor-pointer hover:underline text-indigo-600 font-semibold"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedStates([])}
                  className="bg-transparent border-none cursor-pointer hover:underline text-indigo-600 font-semibold"
                >
                  Deselect All
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto px-1 py-1 space-y-0.5">
                {uniqueStates
                  .filter(name => name.toLowerCase().includes(stateSearchText.toLowerCase()))
                  .map(stateName => {
                    const isChecked = selectedStates.includes(stateName);
                    return (
                      <label key={stateName} className="flex items-center gap-2 px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50 rounded-lg cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setSelectedStates(selectedStates.filter(name => name !== stateName));
                            } else {
                              setSelectedStates([...selectedStates, stateName]);
                            }
                          }}
                          className="accent-[#6804a1] h-3.5 w-3.5 flex-shrink-0"
                        />
                        <span className="truncate">{stateName}</span>
                      </label>
                    );
                  })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );

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
          tableId="abm_wise_tva_report"
          title="ABM wise TvA Report"
          data={groupedData}
          columns={columns}
          loading={loading}
          toggleActions={filtersElement}
          searchPlaceholder="Search ..."
          actionButton={
            <button
              onClick={handleExportReport}
              disabled={exportingReport || loading}
              className="flex items-center gap-2 h-10 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold shadow-md transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border-none focus:outline-none"
              title="Export Report to Excel"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-4 h-4 text-white flex-shrink-0 ${exportingReport ? 'animate-bounce' : ''}`}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.35 16.15l2.25 2.25 3.75-3.75M19.5 8.25v11.25a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V4.5a2.25 2.25 0 0 1 2.25-2.25h9.123m0 0L19.5 8.25m-3.377-6v4.875c0 .621.504 1.125 1.125 1.125h4.875" />
              </svg>
              <span>Export Excel</span>
            </button>
          }
        />
      </main>
    </div>
  );
}

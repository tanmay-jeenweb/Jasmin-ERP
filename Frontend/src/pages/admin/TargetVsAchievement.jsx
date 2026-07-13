import { useEffect, useState, useMemo, useRef } from "react";
import Navbar from "../../components/Navbar";
import { getTargetVsAchievements, importTargetVsAchievements, syncTargetVsAchievements } from "../../api/targetVsAchievementApi";
import { getBranches } from "../../api/branchApi";
import DataTable from "../../components/DataTable";
import * as XLSX from "xlsx-js-style";
import toast from "react-hot-toast";

export default function TargetVsAchievement() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportingReport, setExportingReport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncDate, setSyncDate] = useState(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const fileInputRef = useRef(null);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await getTargetVsAchievements();
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

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await getBranches();
      const branches = response.data.data || [];

      const monthName = new Date().toLocaleString('en-US', { month: 'long' });
      const monthYear = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });

      const qtyTgtHeader = `${monthName} QTY TGT`;
      const qtyValHeader = `${monthName} QTY Val`;

      const dataToExport = branches.map((branch) => ({
        "Month": monthYear,
        "ID": "",
        "Branch Name": branch.name || "",
        "Updated ABM name": "",
        [qtyTgtHeader]: "",
        [qtyValHeader]: ""
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);

      // Auto-fit columns
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

      // Make header row bold
      if (worksheet["!ref"]) {
        const range = XLSX.utils.decode_range(worksheet["!ref"]);
        for (let col = range.s.c; col <= range.e.c; col++) {
          const address = XLSX.utils.encode_cell({ r: 0, c: col });
          if (worksheet[address]) {
            worksheet[address].s = {
              font: { bold: true }
            };
          }
        }
      }

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
      XLSX.writeFile(workbook, "Target_vs_Achievement_Template.xlsx");

      toast.success("Excel template exported successfully!");
    } catch (err) {
      console.error("Failed to export Excel template:", err);
      toast.error("Failed to export Excel template. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const handleExportReport = async () => {
    if (data.length === 0) {
      toast.error("No data available to export.");
      return;
    }
    setExportingReport(true);
    try {
      const monthYear = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });

      const headers = [
        "Sr. No",
        "Branch Name",
        "Updated ABM Name",
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

      const rows = data.map((item, index) => [
        index + 1,
        item.branch_name || "",
        item.updated_abm_name || "",
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

      // Calculate totals
      const totalQtyTgt = data.reduce((sum, item) => sum + (Number(item.qty_tgt) || 0), 0);
      const totalValueTgt = data.reduce((sum, item) => sum + (Number(item.value_tgt) || 0), 0);
      const totalMtdQtyAch = data.reduce((sum, item) => sum + (Number(item.mtd_qty_ach) || 0), 0);
      const totalMtdValueAch = data.reduce((sum, item) => sum + (Number(item.mtd_value_ach) || 0), 0);

      const totalMtdQtyPct = totalQtyTgt > 0 ? totalMtdQtyAch / totalQtyTgt : null;
      const totalMtdValPct = totalValueTgt > 0 ? totalMtdValueAch / totalValueTgt : null;
      const totalGrowthQtyPct = totalQtyTgt > 0 ? totalMtdQtyAch / totalQtyTgt : null;
      const totalGrowthValPct = totalValueTgt > 0 ? totalMtdValueAch / totalValueTgt : null;

      const totalRow = [
        "",
        "TOTAL",
        "",
        totalQtyTgt,
        totalValueTgt,
        data.reduce((sum, item) => sum + (Number(item.ftd_qty_ach) || 0), 0),
        data.reduce((sum, item) => sum + (Number(item.ftd_value_ach) || 0), 0),
        data.reduce((sum, item) => sum + (Number(item.lmftd_qty_ach) || 0), 0),
        data.reduce((sum, item) => sum + (Number(item.lmftd_value_ach) || 0), 0),
        totalMtdQtyAch,
        totalMtdValueAch,
        totalMtdQtyPct,
        totalMtdValPct,
        data.reduce((sum, item) => sum + (Number(item.lmtd_qty_ach) || 0), 0),
        data.reduce((sum, item) => sum + (Number(item.lmtd_value_ach) || 0), 0),
        data.reduce((sum, item) => sum + (Number(item.btd_qty) || 0), 0),
        data.reduce((sum, item) => sum + (Number(item.btd_value) || 0), 0),
        data.reduce((sum, item) => sum + (Number(item.ddr_qty) || 0), 0),
        data.reduce((sum, item) => sum + (Number(item.ddr_value) || 0), 0),
        totalGrowthQtyPct,
        totalGrowthValPct
      ];

      const aoa = [headers, ...rows, totalRow];
      const worksheet = XLSX.utils.aoa_to_sheet(aoa);

      const range = XLSX.utils.decode_range(worksheet["!ref"]);

      const getNumFmt = (colIndex) => {
        const qtyCols = [3, 5, 7, 9, 13, 15, 17];
        const valCols = [4, 6, 8, 10, 14, 16, 18];
        const pctCols = [11, 12];
        const growthCols = [19, 20];

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
            cell.s.alignment = (c === 0 || c === 2) ? { horizontal: "center" } : (c === 1 ? { horizontal: "left" } : { horizontal: "right" });

            const fmt = getNumFmt(c);
            if (fmt) cell.z = fmt;
          } else {
            // Data rows styling
            if (r % 2 === 0) {
              cell.s.fill = { fgColor: { rgb: "F8FAFC" } };
            }
            cell.s.alignment = (c === 0 || c === 2) ? { horizontal: "center" } : (c === 1 ? { horizontal: "left" } : { horizontal: "right" });

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
      for (let r = 1; r <= data.length; r++) {
        worksheet["!rows"][r] = { hpt: 20 };
      }
      worksheet["!rows"][data.length + 1] = { hpt: 22 };

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
      XLSX.writeFile(workbook, `Target_vs_Achievement_Report_${monthYear.replace(/\s+/g, '_')}.xlsx`);

      toast.success("Excel report exported successfully!");
    } catch (err) {
      console.error("Failed to export Excel report:", err);
      toast.error("Failed to export Excel report. Please try again.");
    } finally {
      setExportingReport(false);
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const dataBuffer = evt.target.result;
        const workbook = XLSX.read(dataBuffer, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        if (jsonData.length === 0) {
          toast.error("The selected file is empty.");
          setImporting(false);
          return;
        }

        // Validate structure and map columns dynamically
        const firstRow = jsonData[0];
        const keys = Object.keys(firstRow);

        const branchNameKey = keys.find(k =>
          k.toLowerCase().includes('branch name') ||
          k.toLowerCase() === 'branch_name' ||
          k.toLowerCase() === 'branch'
        );

        const abmNameKey = keys.find(k =>
          k.toLowerCase().includes('abm name') ||
          k.toLowerCase() === 'abm_name' ||
          k.toLowerCase() === 'abm' ||
          k.toLowerCase().includes('updated abm name')
        );

        const qtyTgtKey = keys.find(k =>
          k.toLowerCase().includes('qty tgt') ||
          k.toLowerCase() === 'qty_tgt' ||
          k.toLowerCase() === 'qty tgt'
        );

        const qtyValKey = keys.find(k =>
          k.toLowerCase().includes('qty val') ||
          k.toLowerCase() === 'qty_val' ||
          k.toLowerCase().includes('qty val') ||
          k.toLowerCase().includes('value tgt') ||
          k.toLowerCase() === 'value_tgt' ||
          k.toLowerCase().includes('qty val')
        );

        if (!branchNameKey) {
          toast.error("Branch Name column not found in Excel sheet.");
          setImporting(false);
          return;
        }

        if (!qtyTgtKey) {
          toast.error("QTY TGT column not found in Excel sheet.");
          setImporting(false);
          return;
        }

        if (!qtyValKey) {
          toast.error("QTY Val (Value Target) column not found in Excel sheet.");
          setImporting(false);
          return;
        }

        const mappedData = jsonData.map((row) => {
          const rawBranchName = row[branchNameKey];
          const rawAbmName = abmNameKey ? row[abmNameKey] : null;
          const rawQtyTgt = row[qtyTgtKey];
          const rawQtyVal = row[qtyValKey];

          return {
            branch_name: rawBranchName ? String(rawBranchName).trim() : '',
            updated_abm_name: rawAbmName ? String(rawAbmName).trim() : null,
            qty_tgt: rawQtyTgt !== undefined && rawQtyTgt !== "" ? Number(rawQtyTgt) : null,
            value_tgt: rawQtyVal !== undefined && rawQtyVal !== "" ? Number(rawQtyVal) : null,
          };
        }).filter(item => item.branch_name);

        if (mappedData.length === 0) {
          toast.error("No valid rows containing a Branch Name were found.");
          setImporting(false);
          return;
        }

        const response = await importTargetVsAchievements(mappedData);
        if (response.data?.success) {
          toast.success(response.data.message || "Target vs Achievement records imported successfully!");
          loadData();
        } else {
          toast.error(response.data?.message || "Import failed");
        }
      } catch (err) {
        console.error("Failed to parse/import Excel file:", err);
        toast.error("Failed to import Excel. Please verify the format.");
      } finally {
        setImporting(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    };

    reader.onerror = () => {
      toast.error("Failed to read the file.");
      setImporting(false);
    };

    reader.readAsArrayBuffer(file);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await syncTargetVsAchievements(syncDate);
      if (response.data?.success) {
        toast.success(response.data.message || "Achievements synced successfully!");
        loadData();
      } else {
        toast.error(response.data?.message || "Sync failed");
      }
    } catch (err) {
      console.error("Failed to sync achievements:", err);
      toast.error("Failed to sync achievements from external API. Please try again.");
    } finally {
      setSyncing(false);
    }
  };

  // Format quantities, values and percentages
  const formatQty = (val) => {
    if (val === null || val === undefined) return "—";
    return Number(val).toLocaleString('en-IN');
  };

  const formatVal = (val) => {
    if (val === null || val === undefined) return "—";
    return Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatPct = (val) => {
    if (val === null || val === undefined) return "—";
    return `${Number(val).toFixed(2)}%`;
  };

  // Add serial number (Sr. No) sequentially based on row index
  const formattedData = useMemo(() => {
    return data.map((item, index) => ({
      ...item,
      sr_no: index + 1
    }));
  }, [data]);

  const columns = useMemo(() => [
    {
      key: "sr_no",
      label: "Sr. No",
      minWidth: "70px",
      render: (row) => <span className="font-semibold text-slate-505">{row.sr_no}</span>
    },
    {
      key: "branch_name",
      label: "Branch Name",
      minWidth: "150px",
      render: (row) => <span className="font-bold text-slate-800">{row.branch_name || "—"}</span>
    },
    {
      key: "updated_abm_name",
      label: "UPDATED ABM NAME",
      minWidth: "180px",
      render: (row) => <span className="font-semibold text-indigo-700">{row.updated_abm_name || "—"}</span>
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
      minWidth: "140px",
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
      minWidth: "150px",
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
      render: (row) => <span className="text-slate-700">{formatQty(row.ddr_qty)}</span>
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
          tableId="target_vs_achievement"
          title="Target vs Achievement"
          data={formattedData}
          columns={columns}
          loading={loading}
          searchPlaceholder="Search ..."
          actionButton={
            <div className="contents">
              {/* Date selector for manual sync override */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-lg px-2 h-10">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Sync</span>
                <input
                  type="date"
                  value={syncDate}
                  onChange={(e) => setSyncDate(e.target.value)}
                  className="bg-transparent border-none text-sm text-slate-700 font-medium focus:outline-none cursor-pointer"
                />
              </div>

              {/* Sync Achievements button */}
              <button
                onClick={handleSync}
                disabled={syncing || exporting || exportingReport || importing}
                className="flex items-center gap-2 h-10 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-md transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border-none focus:outline-none"
                title="Sync Achievements from External API"
              >
                
                {syncing ? "Syncing..." : "Sync"}
              </button>

              {/* Export Report button */}
              <button
                onClick={handleExportReport}
                disabled={exportingReport || exporting || syncing || importing}
                className="flex items-center gap-2 h-10 px-4 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold shadow-md transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border-none focus:outline-none"
                title="Export Styled Excel Report"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" className={`w-4 h-4 ${exportingReport ? 'animate-bounce' : ''}`}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.03 0 1.9.693 2.166 1.638m-7.377 12.475 3 3 9-9" />
                </svg>
                {exportingReport ? "Exporting..." : "E. Report "}
              </button>

              {/* Export Template button */}
              <button
                onClick={handleExport}
                disabled={exporting || exportingReport || syncing || importing}
                className="flex items-center gap-2 h-10 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-md transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border-none focus:outline-none"
                title="Export Excel Template for Import"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" className={`w-4 h-4 ${exporting ? 'animate-bounce' : ''}`}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                {exporting ? "Exporting..." : "E. Template"}
              </button>

              {/* Import button */}
              <button
                onClick={() => fileInputRef.current.click()}
                disabled={importing || exporting || exportingReport || syncing}
                className="flex items-center gap-2 h-10 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-md transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border-none focus:outline-none"
                title="Import Filled Excel Template"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" className={`w-4 h-4 ${importing ? 'animate-bounce' : ''}`}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                </svg>
                {importing ? "Importing..." : "Import"}
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImport}
                accept=".xlsx,.xls"
                className="hidden"
              />
            </div>
          }
        />
      </main>
    </div>
  );
}

import { useEffect, useState, useMemo, useRef } from "react";
import Navbar from "../../components/Navbar";
import { getTargetVsAchievements, importTargetVsAchievements, syncTargetVsAchievements } from "../../api/targetVsAchievementApi";
import { getBranches } from "../../api/branchApi";
import DataTable from "../../components/DataTable";
import * as XLSX from "xlsx-js-style";
import ExcelJS from "exceljs";
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
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Filter States
  const [selectedBranches, setSelectedBranches] = useState([]);
  const [selectedAbms, setSelectedAbms] = useState([]);
  const [branchSearchText, setBranchSearchText] = useState("");
  const [abmSearchText, setAbmSearchText] = useState("");
  const [isBranchFilterOpen, setIsBranchFilterOpen] = useState(false);
  const [isAbmFilterOpen, setIsAbmFilterOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showDropdown]);

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

      // Create new ExcelJS Workbook
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Template", {
        views: [{ showGridLines: true }]
      });

      // Define columns
      worksheet.columns = [
        { header: "Month", key: "month" },
        { header: "ID", key: "id" },
        { header: "Branch Name", key: "branch_name" },
        { header: "Updated ABM name", key: "abm_name" },
        { header: qtyTgtHeader, key: "qty_tgt" },
        { header: qtyValHeader, key: "qty_val" }
      ];

      // Add data rows
      branches.forEach((branch) => {
        worksheet.addRow({
          month: monthYear,
          id: "",
          branch_name: branch.name || "",
          abm_name: "",
          qty_tgt: "",
          qty_val: ""
        });
      });

      // Dynamic Auto-fit columns
      worksheet.columns.forEach(column => {
        let maxLen = column.header ? String(column.header).length : 10;
        column.eachCell({ includeEmpty: true }, cell => {
          const val = cell.value ? String(cell.value) : "";
          if (val.length > maxLen) {
            maxLen = val.length;
          }
        });
        column.width = Math.max(maxLen + 4, 12);
      });

      // Style header row (Row 1)
      const headerRow = worksheet.getRow(1);
      headerRow.height = 26;
      headerRow.eachCell((cell) => {
        cell.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF6804A1" } // Purple background
        };
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        cell.border = {
          top: { style: "medium", color: { argb: "FF4A0266" } },
          bottom: { style: "medium", color: { argb: "FF4A0266" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } }
        };
      });

      // Style data rows & set locked columns (1 to 3: Month, ID, Branch Name)
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip headers
        row.height = 20;

        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          // Font style
          cell.font = { name: "Segoe UI", size: 10 };

          // Alignments
          if (colNumber <= 3) {
            cell.alignment = { horizontal: "center", vertical: "middle" };
          } else if (colNumber === 4) {
            cell.alignment = { horizontal: "left", vertical: "middle" };
          } else {
            cell.alignment = { horizontal: "right", vertical: "middle" };
          }

          // Zebra striping fill
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: rowNumber % 2 === 0 ? "FFF8FAFC" : "FFFFFFFF" }
          };

          // Borders
          cell.border = {
            top: { style: "thin", color: { argb: "FFE2E8F0" } },
            bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
            left: { style: "thin", color: { argb: "FFE2E8F0" } },
            right: { style: "thin", color: { argb: "FFE2E8F0" } }
          };

          // Lock Month, ID, and Branch Name (columns 1, 2, 3), unlock others
          cell.protection = {
            locked: colNumber <= 3
          };
        });
      });

      // Protect sheet with empty password to activate locks
      await worksheet.protect("", {
        selectLockedCells: true,
        selectUnlockedCells: true
      });

      // Export file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "Target_vs_Achievement_Template.xlsx";
      anchor.click();
      window.URL.revokeObjectURL(url);

      toast.success("Excel template exported successfully!");
    } catch (err) {
      console.error("Failed to export Excel template:", err);
      toast.error("Failed to export Excel template. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const handleExportReport = async () => {
    if (filteredData.length === 0) {
      toast.error("No data available to export.");
      return;
    }
    setExportingReport(true);
    try {
      const monthYear = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });

      const headers = [
        "Sr. No",
        "Branch Name",
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

      const rows = filteredData.map((item, index) => [
        index + 1,
        item.branch_name || "",
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

      // Calculate totals
      const totalQtyTgt = filteredData.reduce((sum, item) => sum + (Number(item.qty_tgt) || 0), 0);
      const totalValueTgt = filteredData.reduce((sum, item) => sum + (Number(item.value_tgt) || 0), 0);
      const totalMtdQtyAch = filteredData.reduce((sum, item) => sum + (Number(item.mtd_qty_ach) || 0), 0);
      const totalMtdValueAch = filteredData.reduce((sum, item) => sum + (Number(item.mtd_value_ach) || 0), 0);

      const totalLmtdQtyAch = filteredData.reduce((sum, item) => sum + (Number(item.lmtd_qty_ach) || 0), 0);
      const totalLmtdValueAch = filteredData.reduce((sum, item) => sum + (Number(item.lmtd_value_ach) || 0), 0);

      const totalMtdQtyPct = totalQtyTgt > 0 ? totalMtdQtyAch / totalQtyTgt : null;
      const totalMtdValPct = totalValueTgt > 0 ? totalMtdValueAch / totalValueTgt : null;
      const totalGrowthQtyPct = totalMtdQtyAch !== 0 ? (totalMtdQtyAch - totalLmtdQtyAch) / totalMtdQtyAch : null;
      const totalGrowthValPct = totalMtdValueAch !== 0 ? (totalMtdValueAch - totalLmtdValueAch) / totalMtdValueAch : null;

      const totalRow = [
        "",
        "TOTAL",
        "",
        totalQtyTgt,
        totalValueTgt,
        filteredData.reduce((sum, item) => sum + (Number(item.ftd_qty_ach) || 0), 0),
        filteredData.reduce((sum, item) => sum + (Number(item.ftd_value_ach) || 0), 0),
        filteredData.reduce((sum, item) => sum + (Number(item.lmftd_qty_ach) || 0), 0),
        filteredData.reduce((sum, item) => sum + (Number(item.lmftd_value_ach) || 0), 0),
        totalMtdQtyAch,
        totalMtdValueAch,
        totalMtdQtyPct,
        totalMtdValPct,
        filteredData.reduce((sum, item) => sum + (Number(item.lmtd_qty_ach) || 0), 0),
        filteredData.reduce((sum, item) => sum + (Number(item.lmtd_value_ach) || 0), 0),
        filteredData.reduce((sum, item) => sum + (Number(item.btd_qty) || 0), 0),
        filteredData.reduce((sum, item) => sum + (Number(item.btd_value) || 0), 0),
        filteredData.reduce((sum, item) => sum + (Number(item.ddr_qty) || 0), 0),
        filteredData.reduce((sum, item) => sum + (Number(item.ddr_value) || 0), 0),
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
      for (let r = 1; r <= filteredData.length; r++) {
        worksheet["!rows"][r] = { hpt: 20 };
      }
      worksheet["!rows"][filteredData.length + 1] = { hpt: 22 };

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

  // Extract unique branches
  const uniqueBranches = useMemo(() => {
    const list = data
      .map(r => ({ id: r.branch_id || r.id, name: r.branch_name }))
      .filter(r => r.name);
    const seen = new Set();
    return list.filter(item => {
      const duplicate = seen.has(item.name);
      seen.add(item.name);
      return !duplicate;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  // Extract unique ABMs
  const uniqueAbms = useMemo(() => {
    const list = data
      .map(r => r.abm_name)
      .filter(name => name && name !== "—");
    return Array.from(new Set(list)).sort((a, b) => a.localeCompare(b));
  }, [data]);

  // Filtered dataset
  const filteredData = useMemo(() => {
    return data.filter(item => {
      const branchMatch = selectedBranches.length === 0 || selectedBranches.includes(item.branch_name);
      const abmMatch = selectedAbms.length === 0 || selectedAbms.includes(item.abm_name);
      return branchMatch && abmMatch;
    });
  }, [data, selectedBranches, selectedAbms]);

  // Add serial number (Sr. No) sequentially based on row index
  const formattedData = useMemo(() => {
    return filteredData.map((item, index) => ({
      ...item,
      sr_no: index + 1
    }));
  }, [filteredData]);

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
      {/* Branch Multi-select Dropdown */}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setIsBranchFilterOpen(!isBranchFilterOpen);
            setIsAbmFilterOpen(false);
          }}
          className="flex items-center justify-between gap-2 h-10 px-3 rounded-lg border border-slate-300 bg-white hover:border-slate-400 text-sm font-semibold transition-colors duration-150 cursor-pointer focus:outline-none"
        >
          <span className="text-slate-700">
            {selectedBranches.length === 0
              ? "All Branches"
              : `${selectedBranches.length} Branch${selectedBranches.length > 1 ? 'es' : ''}`}
          </span>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3 text-slate-400">
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </button>

        {isBranchFilterOpen && (
          <>
            <div className="fixed inset-0 z-45" onClick={() => setIsBranchFilterOpen(false)}></div>
            <div className="absolute left-0 mt-1 w-64 rounded-xl border border-slate-200 bg-white shadow-xl py-2 z-50 flex flex-col">
              <div className="px-3 py-1.5 border-b border-slate-100 flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5 text-slate-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.602 10.602Z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search branches..."
                  value={branchSearchText}
                  onChange={(e) => setBranchSearchText(e.target.value)}
                  className="w-full text-xs border-none outline-none bg-transparent"
                />
              </div>
              <div className="px-2 py-1 border-b border-slate-100 flex items-center justify-between text-[11px] font-bold text-indigo-650">
                <button
                  type="button"
                  onClick={() => setSelectedBranches(uniqueBranches.map(b => b.name))}
                  className="bg-transparent border-none cursor-pointer hover:underline text-indigo-600 font-semibold"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedBranches([])}
                  className="bg-transparent border-none cursor-pointer hover:underline text-indigo-600 font-semibold"
                >
                  Deselect All
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto px-1 py-1 space-y-0.5">
                {uniqueBranches
                  .filter(b => b.name.toLowerCase().includes(branchSearchText.toLowerCase()))
                  .map(branch => {
                    const isChecked = selectedBranches.includes(branch.name);
                    return (
                      <label key={branch.name} className="flex items-center gap-2 px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50 rounded-lg cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setSelectedBranches(selectedBranches.filter(name => name !== branch.name));
                            } else {
                              setSelectedBranches([...selectedBranches, branch.name]);
                            }
                          }}
                          className="accent-[#6804a1] h-3.5 w-3.5 flex-shrink-0"
                        />
                        <span className="truncate">{branch.name}</span>
                      </label>
                    );
                  })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ABM Multi-select Dropdown */}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setIsAbmFilterOpen(!isAbmFilterOpen);
            setIsBranchFilterOpen(false);
          }}
          className="flex items-center justify-between gap-2 h-10 px-3 rounded-lg border border-slate-300 bg-white hover:border-slate-400 text-sm font-semibold transition-colors duration-150 cursor-pointer focus:outline-none"
        >
          <span className="text-slate-700">
            {selectedAbms.length === 0
              ? "All ABMs"
              : `${selectedAbms.length} ABM${selectedAbms.length > 1 ? 's' : ''}`}
          </span>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3 text-slate-400">
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </button>

        {isAbmFilterOpen && (
          <>
            <div className="fixed inset-0 z-45" onClick={() => setIsAbmFilterOpen(false)}></div>
            <div className="absolute left-0 mt-1 w-64 rounded-xl border border-slate-200 bg-white shadow-xl py-2 z-50 flex flex-col">
              <div className="px-3 py-1.5 border-b border-slate-100 flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5 text-slate-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.602 10.602Z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search ABMs..."
                  value={abmSearchText}
                  onChange={(e) => setAbmSearchText(e.target.value)}
                  className="w-full text-xs border-none outline-none bg-transparent"
                />
              </div>
              <div className="px-2 py-1 border-b border-slate-100 flex items-center justify-between text-[11px] font-bold text-indigo-650">
                <button
                  type="button"
                  onClick={() => setSelectedAbms(uniqueAbms)}
                  className="bg-transparent border-none cursor-pointer hover:underline text-indigo-600 font-semibold"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedAbms([])}
                  className="bg-transparent border-none cursor-pointer hover:underline text-indigo-600 font-semibold"
                >
                  Deselect All
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto px-1 py-1 space-y-0.5">
                {uniqueAbms
                  .filter(name => name.toLowerCase().includes(abmSearchText.toLowerCase()))
                  .map(abmName => {
                    const isChecked = selectedAbms.includes(abmName);
                    return (
                      <label key={abmName} className="flex items-center gap-2 px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50 rounded-lg cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setSelectedAbms(selectedAbms.filter(name => name !== abmName));
                            } else {
                              setSelectedAbms([...selectedAbms, abmName]);
                            }
                          }}
                          className="accent-[#6804a1] h-3.5 w-3.5 flex-shrink-0"
                        />
                        <span className="truncate">{abmName}</span>
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
          tableId="target_vs_achievement"
          title="Target vs Achievement"
          data={formattedData}
          columns={columns}
          loading={loading}
          toggleActions={filtersElement}
          searchPlaceholder="Search ..."
          actionButton={
            <div className="contents">
              {/* Date selector for manual sync override */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-lg px-2 h-10">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" className="w-3.5 h-3.5 text-slate-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                </svg>
                <input
                  type="date"
                  value={syncDate}
                  onChange={(e) => setSyncDate(e.target.value)}
                  className="bg-transparent border-none text-xs text-slate-700 font-semibold focus:outline-none cursor-pointer w-[110px] p-0"
                />
              </div>

              {/* Sync Achievements button */}
              <button
                onClick={handleSync}
                disabled={syncing || exporting || exportingReport || importing}
                className="flex items-center justify-center h-10 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border-none focus:outline-none"
                title="Sync Achievements from External API"
              >
                {syncing ? "Syncing..." : "Sync"}
              </button>

              {/* Actions Dropdown */}
              <div className="relative inline-block text-left" ref={dropdownRef}>
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  disabled={syncing || exporting || exportingReport || importing}
                  className="flex items-center gap-2 h-10 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold shadow-md transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border-none focus:outline-none"
                  title="Import/Export Options"
                >
                  <span>Export / Import</span>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className={`w-3.5 h-3.5 transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>

                {showDropdown && (
                  <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-1.5 origin-top-right">
                    {/* Export Report */}
                    <button
                      onClick={() => {
                        setShowDropdown(false);
                        handleExportReport();
                      }}
                      disabled={exportingReport || exporting || syncing || importing}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 border-none bg-transparent cursor-pointer text-sm font-medium"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-4 h-4 text-teal-600 flex-shrink-0 ${exportingReport ? 'animate-bounce' : ''}`}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.35 16.15l2.25 2.25 3.75-3.75M19.5 8.25v11.25a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V4.5a2.25 2.25 0 0 1 2.25-2.25h9.123m0 0L19.5 8.25m-3.377-6v4.875c0 .621.504 1.125 1.125 1.125h4.875" />
                      </svg>
                      <span>E. Report</span>
                    </button>

                    {/* Export Template */}
                    <button
                      onClick={() => {
                        setShowDropdown(false);
                        handleExport();
                      }}
                      disabled={exporting || exportingReport || syncing || importing}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 border-none bg-transparent cursor-pointer text-sm font-medium"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" className={`w-4 h-4 text-emerald-600 flex-shrink-0 ${exporting ? 'animate-bounce' : ''}`}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                      <span>E. Template</span>
                    </button>

                    {/* Import */}
                    <button
                      onClick={() => {
                        setShowDropdown(false);
                        fileInputRef.current.click();
                      }}
                      disabled={importing || exporting || exportingReport || syncing}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 border-none bg-transparent cursor-pointer text-sm font-medium"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" className={`w-4 h-4 text-indigo-600 flex-shrink-0 ${importing ? 'animate-bounce' : ''}`}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                      </svg>
                      <span>Import</span>
                    </button>
                  </div>
                )}
              </div>
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

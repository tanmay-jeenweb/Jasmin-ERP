import { useEffect, useState, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import DataTable from "../../components/DataTable";
import {
  getSpecialTvaReport,
  importSpecialTvaTargets
} from "../../api/specialTvaApi";
import { getBranches } from "../../api/branchApi";
import toast from "react-hot-toast";
import { usePermission } from "../../context/PermissionContext";
import ExcelJS from "exceljs";
import * as XLSX from "xlsx-js-style";

// Helper to format numbers with commas
const formatNumber = (num, decimals = 0) => {
  if (num === undefined || num === null || isNaN(num)) return "0";
  const n = Number(num);
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
};

// Helper to format date display
const formatDate = (val) => {
  if (!val) return "—";
  const str = String(val).split("T")[0];
  const parts = str.split("-");
  if (parts.length === 3) {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const [y, m, d] = parts;
    const mName = months[parseInt(m, 10) - 1] || m;
    return `${parseInt(d, 10)} ${mName} ${y}`;
  }
  return str;
};

// Color badge for achievement percentage
const getPctBadgeClass = (pct) => {
  if (pct === null || pct === undefined || isNaN(pct) || pct === 0) {
    return "text-slate-400 font-normal";
  }
  if (pct >= 100) {
    return "font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/80";
  }
  if (pct >= 80) {
    return "font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/80";
  }
  return "font-semibold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200/80";
};

export default function SpecialTvaReport() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasPermission, isAdmin } = usePermission();
  const canWrite = isAdmin || hasPermission("special_tva_report", "write") || hasPermission("special_tva_master", "write");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reportData, setReportData] = useState(null);
  const [exportingReport, setExportingReport] = useState(false);
  const [exportingTemplate, setExportingTemplate] = useState(false);

  // Dropdown states
  const [showExportImportDropdown, setShowExportImportDropdown] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importing, setImporting] = useState(false);

  const dropdownRef = useRef(null);
  const filtersRef = useRef(null);
  const fileInputRef = useRef(null);

  // Filter states
  const [selectedStates, setSelectedStates] = useState([]);
  const [selectedZones, setSelectedZones] = useState([]);
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [stateSearchText, setStateSearchText] = useState("");
  const [zoneSearchText, setZoneSearchText] = useState("");

  const loadReport = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getSpecialTvaReport(id);
      if (res.data?.success) {
        setReportData(res.data.data);
      } else {
        setError(res.data?.message || "Failed to load report data");
      }
    } catch (err) {
      console.error("Failed to load special TVA report:", err);
      setError("Unable to load report data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadReport();
    }
  }, [id]);

  // Click outside listener for dropdowns
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowExportImportDropdown(false);
      }
      if (filtersRef.current && !filtersRef.current.contains(e.target)) {
        setIsFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const master = reportData?.master;
  const brandHeaders = reportData?.brand_headers || [];
  const rawRecords = reportData?.records || [];

  // Unique filter options
  const uniqueStates = useMemo(() => {
    const s = new Set();
    rawRecords.forEach(r => { if (r.state) s.add(r.state.trim()); });
    return Array.from(s).sort();
  }, [rawRecords]);

  const uniqueZones = useMemo(() => {
    const z = new Set();
    rawRecords.forEach(r => { if (r.zone) z.add(r.zone.trim()); });
    return Array.from(z).sort();
  }, [rawRecords]);

  const uniqueTypes = useMemo(() => {
    const t = new Set();
    rawRecords.forEach(r => { if (r.type) t.add(r.type.trim()); });
    return Array.from(t).sort();
  }, [rawRecords]);

  // Filter records
  const filteredRecords = useMemo(() => {
    return rawRecords.filter(row => {
      if (selectedStates.length > 0 && !selectedStates.includes(row.state)) return false;
      if (selectedZones.length > 0 && !selectedZones.includes(row.zone)) return false;
      if (selectedTypes.length > 0 && !selectedTypes.includes(row.type)) return false;
      return true;
    });
  }, [rawRecords, selectedStates, selectedZones, selectedTypes]);

  const totalActiveFilters = selectedStates.length + selectedZones.length + selectedTypes.length;

  const handleClearAllFilters = () => {
    setSelectedStates([]);
    setSelectedZones([]);
    setSelectedTypes([]);
    setStateSearchText("");
    zoneSearchText("");
  };

  // ─── Format Data for DataTable ───────────────────────────────────────────────
  // Flattened row records with keys matching column IDs, plus native totalRow (id: "Total")
  const { tableRows, totalsRowData } = useMemo(() => {
    if (!reportData || filteredRecords.length === 0) {
      return { tableRows: [], totalsRowData: null };
    }

    const totals = {
      id: "Total",
      s_no: "∑",
      party_name: `Total (${filteredRecords.length})`,
      type: "—",
      state: "—",
      zone: "—",
      mf: "—",
      period_target: 0
    };

    brandHeaders.forEach(bh => {
      totals[`tgt_${bh}`] = 0;
      totals[`ach_${bh}`] = 0;
      totals[`pct_${bh}`] = 0;
    });

    const rows = filteredRecords.map((r, idx) => {
      const flatRow = {
        id: r.branch_code || idx,
        s_no: idx + 1,
        branch_code: r.branch_code,
        party_name: r.party_name,
        type: r.type,
        state: r.state,
        zone: r.zone,
        mf: r.mf,
        period_target: r.period_target || 0
      };

      totals.period_target += (r.period_target || 0);

      // Section 1: Target
      brandHeaders.forEach(bh => {
        const val = r.brand_targets?.[bh] || 0;
        flatRow[`tgt_${bh}`] = val;
        totals[`tgt_${bh}`] += val;
      });

      // Section 2: Achievement QTY
      brandHeaders.forEach(bh => {
        const val = r.achievement_qty?.[bh] || 0;
        flatRow[`ach_${bh}`] = val;
        totals[`ach_${bh}`] += val;
      });

      // Section 3: Achievement %
      brandHeaders.forEach(bh => {
        const val = r.achievement_pct?.[bh] !== undefined ? r.achievement_pct[bh] : 0;
        flatRow[`pct_${bh}`] = val;
      });

      return flatRow;
    });

    // Calculate totals achievement %
    brandHeaders.forEach(bh => {
      const totTgt = totals[`tgt_${bh}`] || 0;
      const totAch = totals[`ach_${bh}`] || 0;
      totals[`pct_${bh}`] = totTgt > 0 ? Number(((totAch / totTgt) * 100).toFixed(2)) : 0;
    });

    return {
      tableRows: [...rows, totals],
      totalsRowData: totals
    };
  }, [reportData, filteredRecords, brandHeaders]);

  // ─── Header Groups (Super-Headers) ──────────────────────────────────────────
  // Order: Fixed Columns -> Target -> Achievement -> Achievement %
  const headerGroups = useMemo(() => {
    if (brandHeaders.length === 0) return [];
    return [
      {
        title: "Branch Info & Target",
        columns: ["s_no", "party_name", "type", "state", "zone", "mf", "period_target"],
        colSpan: 7,
        className: "bg-slate-900 border-r border-slate-700 text-slate-100"
      },
      {
        title: "Target",
        columns: brandHeaders.map(bh => `tgt_${bh}`),
        colSpan: brandHeaders.length,
        className: "bg-teal-900/95 border-r border-teal-700 text-teal-100 font-bold"
      },
      {
        title: "Achievement",
        columns: brandHeaders.map(bh => `ach_${bh}`),
        colSpan: brandHeaders.length,
        className: "bg-blue-900/95 border-r border-blue-700 text-blue-100 font-bold"
      },
      {
        title: "Achievement %",
        columns: brandHeaders.map(bh => `pct_${bh}`),
        colSpan: brandHeaders.length,
        className: "bg-indigo-900/95 border-r border-indigo-700 text-indigo-100 font-bold"
      }
    ];
  }, [brandHeaders]);

  // ─── DataTable Columns Definition (New Requested Order) ─────────────────────
  // 1. Fixed -> 2. Target -> 3. Achievement -> 4. Achievement %
  const columns = useMemo(() => {
    const cols = [
      {
        key: "s_no",
        label: "S.No.",
        minWidth: "60px",
        render: (row) => (
          <span className={`text-center block ${row.id === "Total" ? "font-bold text-slate-900" : "text-slate-500"}`}>
            {row.s_no}
          </span>
        )
      },
      {
        key: "party_name",
        label: "Party Name",
        minWidth: "220px",
        render: (row) => (
          <span className={`block truncate ${row.id === "Total" ? "font-extrabold text-slate-950 text-sm" : "font-semibold text-slate-800"}`} title={row.party_name}>
            {row.party_name}
          </span>
        )
      },
      {
        key: "type",
        label: "TYPE",
        minWidth: "85px",
        render: (row) => (
          <span className="capitalize text-slate-650">{row.type}</span>
        )
      },
      {
        key: "state",
        label: "State",
        minWidth: "110px",
        render: (row) => (
          <span className="truncate block text-slate-650">{row.state}</span>
        )
      },
      {
        key: "zone",
        label: "Zone",
        minWidth: "90px",
        render: (row) => (
          <span className="text-slate-650">{row.zone || "—"}</span>
        )
      },
      {
        key: "mf",
        label: "MF",
        minWidth: "60px",
        render: (row) => (
          <span className="text-slate-400 text-center block">{row.mf || "—"}</span>
        )
      },
      {
        key: "period_target",
        label: "Target",
        minWidth: "125px",
        render: (row) => (
          <span className={`text-right block ${row.id === "Total" ? "font-extrabold text-amber-700 text-sm" : "font-bold text-slate-900"}`}>
            {formatNumber(row.period_target)}
          </span>
        )
      }
    ];

    // ── Group 2: Target Columns ──
    brandHeaders.forEach(bh => {
      const isTotal = bh === "Total";
      cols.push({
        key: `tgt_${bh}`,
        label: bh,
        minWidth: isTotal ? "95px" : "85px",
        render: (row) => {
          const val = row[`tgt_${bh}`] || 0;
          return (
            <span className={`text-right block ${isTotal ? "font-extrabold text-teal-850" : "font-medium text-slate-700"}`}>
              {formatNumber(val)}
            </span>
          );
        }
      });
    });

    // ── Group 3: Achievement QTY Columns ──
    brandHeaders.forEach(bh => {
      const isTotal = bh === "Total";
      cols.push({
        key: `ach_${bh}`,
        label: bh,
        minWidth: isTotal ? "95px" : "85px",
        render: (row) => {
          const val = row[`ach_${bh}`] || 0;
          return (
            <span className={`text-right block ${isTotal ? "font-extrabold text-blue-850" : "font-medium text-slate-700"}`}>
              {formatNumber(val)}
            </span>
          );
        }
      });
    });

    // ── Group 4: Achievement % Columns ──
    brandHeaders.forEach(bh => {
      const isTotal = bh === "Total";
      cols.push({
        key: `pct_${bh}`,
        label: bh,
        minWidth: isTotal ? "95px" : "85px",
        render: (row) => {
          const pct = row[`pct_${bh}`];
          return (
            <div className="text-right">
              <span className={getPctBadgeClass(pct)}>
                {pct !== undefined && pct !== null ? `${pct}%` : "0%"}
              </span>
            </div>
          );
        }
      });
    });

    return cols;
  }, [brandHeaders]);

  // ─── Export Excel Template ───────────────────────────────────────────────────
  const handleExportTemplate = async () => {
    setExportingTemplate(true);
    try {
      const response = await getBranches();
      const branches = response.data?.success ? (response.data.data || []) : (response.data || []);

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Target Template", {
        views: [{ showGridLines: true }]
      });

      worksheet.columns = [
        { header: "Sr. No.", key: "sr_no", width: 10 },
        { header: "Branch Name", key: "branch_name", width: 32 },
        { header: "Type", key: "type", width: 16 },
        { header: "State", key: "state", width: 20 },
        { header: "Zone", key: "zone", width: 18 },
        { header: "MF", key: "mf", width: 14 },
        { header: "Target", key: "target", width: 18 }
      ];

      let sNo = 1;
      branches.forEach(b => {
        if (!b.name) return;
        worksheet.addRow({
          sr_no: sNo++,
          branch_name: b.name || "",
          type: b.store_type ? (b.store_type.charAt(0).toUpperCase() + b.store_type.slice(1)) : "Branch",
          state: b.state_name || "",
          zone: b.branch_cls_05 || "",
          mf: "",
          target: ""
        });
      });

      const headerRow = worksheet.getRow(1);
      headerRow.height = 28;
      headerRow.eachCell(cell => {
        cell.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF4F46E5" }
        };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom: { style: "medium", color: { argb: "FF3730A3" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } }
        };
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Special_TVA_Target_Template_${(master?.title || "Campaign").replace(/\s+/g, "_")}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success("Excel template downloaded successfully!");
    } catch (err) {
      console.error("Failed to generate Excel template:", err);
      toast.error("Failed to download template. Please try again.");
    } finally {
      setExportingTemplate(false);
    }
  };

  // ─── Export Full Styled Multi-Level Excel Report (New Column Order) ───────────
  // Order: Fixed Cols -> Target -> Achievement -> Achievement %
  const handleExportFullReport = async () => {
    if (!reportData || filteredRecords.length === 0) {
      toast.error("No data available to export");
      return;
    }

    setExportingReport(true);
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Special TVA Report", {
        views: [{ showGridLines: true, state: "frozen", xSplit: 2, ySplit: 2 }]
      });

      const brandsCount = brandHeaders.length;
      const fixedColsCount = 7; // S.No., Party Name, TYPE, State, Zone, MF, 2 Month Target

      // Row 1: Super Headers
      const row1Values = [];
      for (let i = 0; i < fixedColsCount; i++) row1Values.push("");
      for (let i = 0; i < brandsCount; i++) row1Values.push(i === 0 ? "Target" : "");
      for (let i = 0; i < brandsCount; i++) row1Values.push(i === 0 ? "Achievement" : "");
      for (let i = 0; i < brandsCount; i++) row1Values.push(i === 0 ? "Achievement %" : "");

      const headerRow1 = worksheet.addRow(row1Values);
      headerRow1.height = 24;

      // Row 2: Sub-headers
      const row2Values = [
        "S.No.",
        "Party Name",
        "TYPE",
        "State",
        "Zone",
        "MF",
        "Target",
        ...brandHeaders, // Target
        ...brandHeaders, // Achievement QTY
        ...brandHeaders  // Achievement %
      ];

      const headerRow2 = worksheet.addRow(row2Values);
      headerRow2.height = 26;

      // Merge super-headers in Row 1
      // Target merge
      const tgtStartCol = fixedColsCount + 1;
      const tgtEndCol = fixedColsCount + brandsCount;
      worksheet.mergeCells(1, tgtStartCol, 1, tgtEndCol);

      // Achievement QTY merge
      const achStartCol = tgtEndCol + 1;
      const achEndCol = tgtEndCol + brandsCount;
      worksheet.mergeCells(1, achStartCol, 1, achEndCol);

      // Achievement % merge
      const achPctStartCol = achEndCol + 1;
      const achPctEndCol = achEndCol + brandsCount;
      worksheet.mergeCells(1, achPctStartCol, 1, achPctEndCol);

      // Theme Colors
      const navyColor = "FF1E293B";
      const tgtColor = "FF0F766E";         // Teal for Target
      const achievementColor = "FF1E40AF"; // Blue for Achievement QTY
      const pctColor = "FF4338CA";         // Indigo for Achievement %

      // Style Row 1
      headerRow1.getCell(tgtStartCol).value = "Target";
      headerRow1.getCell(tgtStartCol).alignment = { horizontal: "center", vertical: "middle" };
      headerRow1.getCell(tgtStartCol).font = { name: "Segoe UI", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
      headerRow1.getCell(tgtStartCol).fill = { type: "pattern", pattern: "solid", fgColor: { argb: tgtColor } };

      headerRow1.getCell(achStartCol).value = "Achievement";
      headerRow1.getCell(achStartCol).alignment = { horizontal: "center", vertical: "middle" };
      headerRow1.getCell(achStartCol).font = { name: "Segoe UI", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
      headerRow1.getCell(achStartCol).fill = { type: "pattern", pattern: "solid", fgColor: { argb: achievementColor } };

      headerRow1.getCell(achPctStartCol).value = "Achievement %";
      headerRow1.getCell(achPctStartCol).alignment = { horizontal: "center", vertical: "middle" };
      headerRow1.getCell(achPctStartCol).font = { name: "Segoe UI", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
      headerRow1.getCell(achPctStartCol).fill = { type: "pattern", pattern: "solid", fgColor: { argb: pctColor } };

      for (let c = 1; c <= fixedColsCount; c++) {
        const cell = headerRow1.getCell(c);
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: navyColor } };
      }

      // Style Row 2 (Sub-headers)
      headerRow2.eachCell((cell, colNumber) => {
        let bgColor = navyColor;
        if (colNumber >= tgtStartCol && colNumber <= tgtEndCol) bgColor = "FF0D9488";
        if (colNumber >= achStartCol && colNumber <= achEndCol) bgColor = "FF2563EB";
        if (colNumber >= achPctStartCol && colNumber <= achPctEndCol) bgColor = "FF4F46E5";

        cell.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgColor } };
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        cell.border = {
          top: { style: "thin", color: { argb: "FF94A3B8" } },
          bottom: { style: "medium", color: { argb: "FFFFFFFF" } },
          left: { style: "thin", color: { argb: "FF64748B" } },
          right: { style: "thin", color: { argb: "FF64748B" } }
        };
      });

      // Add Data Rows (Order: Fixed -> Target -> Achievement -> Achievement %)
      let sNo = 1;
      filteredRecords.forEach((row, rIdx) => {
        const rowVals = [
          sNo++,
          row.party_name || "",
          row.type || "",
          row.state || "",
          row.zone || "",
          row.mf || "",
          row.period_target || 0,
          // Group 2: Target
          ...brandHeaders.map(bh => row.brand_targets?.[bh] || 0),
          // Group 3: Achievement QTY
          ...brandHeaders.map(bh => row.achievement_qty?.[bh] || 0),
          // Group 4: Achievement %
          ...brandHeaders.map(bh => row.achievement_pct?.[bh] !== undefined ? `${row.achievement_pct[bh]}%` : "0%")
        ];

        const excelRow = worksheet.addRow(rowVals);
        excelRow.height = 20;

        const isEven = rIdx % 2 === 0;
        const rowBg = isEven ? "FFFFFFFF" : "FFF8FAFC";

        excelRow.eachCell((cell, colNumber) => {
          cell.font = { name: "Segoe UI", size: 9 };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: rowBg } };
          cell.border = {
            top: { style: "thin", color: { argb: "FFE2E8F0" } },
            bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
            left: { style: "thin", color: { argb: "FFE2E8F0" } },
            right: { style: "thin", color: { argb: "FFE2E8F0" } }
          };

          if (colNumber === 1 || colNumber === 3 || colNumber === 5 || colNumber === 6) {
            cell.alignment = { horizontal: "center", vertical: "middle" };
          } else if (colNumber === 2 || colNumber === 4) {
            cell.alignment = { horizontal: "left", vertical: "middle" };
          } else {
            cell.alignment = { horizontal: "right", vertical: "middle" };
          }
        });
      });

      // Add Grand Totals Row
      const totalsVals = [
        "",
        `Total (${filteredRecords.length})`,
        "",
        "",
        "",
        "",
        totalsRowData?.period_target || 0,
        // Target totals
        ...brandHeaders.map(bh => totalsRowData?.[`tgt_${bh}`] || 0),
        // Achievement totals
        ...brandHeaders.map(bh => totalsRowData?.[`ach_${bh}`] || 0),
        // Achievement % totals
        ...brandHeaders.map(bh => `${totalsRowData?.[`pct_${bh}`] || 0}%`)
      ];

      const totalsRow = worksheet.addRow(totalsVals);
      totalsRow.height = 24;
      totalsRow.eachCell((cell, colNumber) => {
        cell.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
        cell.border = {
          top: { style: "medium", color: { argb: "FF94A3B8" } },
          bottom: { style: "medium", color: { argb: "FF94A3B8" } },
          left: { style: "thin", color: { argb: "FF334155" } },
          right: { style: "thin", color: { argb: "FF334155" } }
        };
        if (colNumber === 2) {
          cell.alignment = { horizontal: "left", vertical: "middle" };
        } else if (colNumber > 6) {
          cell.alignment = { horizontal: "right", vertical: "middle" };
        } else {
          cell.alignment = { horizontal: "center", vertical: "middle" };
        }
      });

      // Column widths
      worksheet.columns.forEach((column, index) => {
        if (index === 0) column.width = 8;
        else if (index === 1) column.width = 30; // Party Name
        else if (index === 2) column.width = 14; // TYPE
        else if (index === 3) column.width = 18; // State
        else if (index === 4) column.width = 16; // Zone
        else if (index === 5) column.width = 10; // MF
        else if (index === 6) column.width = 16; // Target
        else column.width = 13; // Brands
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Special_TVA_Report_${(master?.title || "Report").replace(/\s+/g, "_")}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success("Excel report exported successfully!");
    } catch (err) {
      console.error("Failed to export Excel report:", err);
      toast.error("Failed to export Excel report. Please try again.");
    } finally {
      setExportingReport(false);
    }
  };

  // ─── Target Import Handler ───────────────────────────────────────────────────
  const handleImportFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const buffer = evt.target.result;
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        if (!jsonData || jsonData.length === 0) {
          toast.error("Uploaded Excel file is empty.");
          setImporting(false);
          return;
        }

        const firstRow = jsonData[0];
        const keys = Object.keys(firstRow);

        const branchNameKey = keys.find(k =>
          k.toLowerCase().includes("branch name") ||
          k.toLowerCase().includes("party name") ||
          k.toLowerCase() === "branch" ||
          k.toLowerCase() === "branch_name"
        );

        const targetKey = keys.find(k =>
          k.toLowerCase().includes("target") ||
          k.toLowerCase() === "target" ||
          k.toLowerCase().includes("2 month target")
        );

        const mfKey = keys.find(k =>
          k.toLowerCase() === "mf" ||
          k.toLowerCase().includes("mf")
        );

        if (!branchNameKey) {
          toast.error("Could not find 'Branch Name' or 'Party Name' column in sheet.");
          setImporting(false);
          return;
        }

        if (!targetKey) {
          toast.error("Could not find 'Target' column in sheet.");
          setImporting(false);
          return;
        }

        const mapped = jsonData.map(r => ({
          branch_name: String(r[branchNameKey] || "").trim(),
          target: r[targetKey] !== undefined && r[targetKey] !== "" ? Number(r[targetKey]) : 0,
          mf: mfKey && r[mfKey] !== undefined ? String(r[mfKey]).trim() : ""
        })).filter(r => r.branch_name && r.branch_name.toUpperCase() !== "TOTAL");

        if (mapped.length === 0) {
          toast.error("No valid branch rows found.");
          setImporting(false);
          return;
        }

        const res = await importSpecialTvaTargets(id, mapped);
        if (res.data?.success) {
          toast.success(res.data.message || "Targets imported successfully!");
          setIsImportModalOpen(false);
          loadReport();
        } else {
          toast.error(res.data?.message || "Import failed");
        }
      } catch (err) {
        console.error("Failed to import Excel targets:", err);
        toast.error(err.response?.data?.message || err.message || "Import error");
      } finally {
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // ─── Filter Dropdown Popover Element (toggleActions) ─────────────────────────
  const filtersElement = (
    <div className="relative" ref={filtersRef}>
      <button
        type="button"
        onClick={() => setIsFilterOpen(!isFilterOpen)}
        className="flex items-center gap-2 h-10 px-3.5 rounded-lg border border-slate-300 bg-white hover:border-slate-400 text-sm font-semibold transition-colors duration-150 cursor-pointer focus:outline-none shadow-sm"
        title="Filter by State, Zone, Store Type"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-slate-500">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" />
        </svg>
        <span className="text-slate-700">
          {totalActiveFilters === 0 ? "Filters" : `Filters (${totalActiveFilters})`}
        </span>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isFilterOpen ? "rotate-180" : ""}`}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {isFilterOpen && (
        <div className="absolute right-0 mt-2 w-[700px] max-w-[calc(100vw-32px)] rounded-2xl border border-slate-200 bg-white shadow-2xl p-5 z-[100] flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <span className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <i className="fa-solid fa-filter text-indigo-600"></i>
              Filter Options
            </span>
            {totalActiveFilters > 0 && (
              <button
                type="button"
                onClick={handleClearAllFilters}
                className="bg-transparent border-none cursor-pointer text-xs font-bold text-rose-600 hover:text-rose-700 hover:underline flex items-center gap-1"
              >
                <i className="fa-solid fa-xmark"></i>
                Clear All
              </button>
            )}
          </div>

          {/* 3-Column Checklist Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {/* Column 1: States */}
            <div className="flex flex-col border-r border-slate-100 pr-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">States</span>
                <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-semibold">
                  {selectedStates.length === 0 ? "All" : selectedStates.length}
                </span>
              </div>
              <input
                type="text"
                placeholder="Search states..."
                value={stateSearchText}
                onChange={(e) => setStateSearchText(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg outline-none bg-slate-50 mb-2"
              />
              <div className="flex justify-between text-[10px] font-bold text-indigo-600 mb-1.5 px-0.5">
                <button type="button" onClick={() => setSelectedStates(uniqueStates)} className="hover:underline bg-transparent border-none cursor-pointer">Select All</button>
                <button type="button" onClick={() => setSelectedStates([])} className="hover:underline bg-transparent border-none cursor-pointer">Deselect All</button>
              </div>
              <div className="max-h-40 overflow-y-auto space-y-0.5 border border-slate-100 rounded-lg p-1">
                {uniqueStates
                  .filter(s => s.toLowerCase().includes(stateSearchText.toLowerCase()))
                  .map(stateName => {
                    const isChecked = selectedStates.includes(stateName);
                    return (
                      <label key={stateName} className="flex items-center gap-2 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 rounded cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) setSelectedStates(selectedStates.filter(s => s !== stateName));
                            else setSelectedStates([...selectedStates, stateName]);
                          }}
                          className="accent-indigo-600 h-3.5 w-3.5"
                        />
                        <span className="truncate">{stateName}</span>
                      </label>
                    );
                  })}
              </div>
            </div>

            {/* Column 2: Zones */}
            <div className="flex flex-col border-r border-slate-100 pr-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">Zones</span>
                <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-semibold">
                  {selectedZones.length === 0 ? "All" : selectedZones.length}
                </span>
              </div>
              <input
                type="text"
                placeholder="Search zones..."
                value={zoneSearchText}
                onChange={(e) => setZoneSearchText(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg outline-none bg-slate-50 mb-2"
              />
              <div className="flex justify-between text-[10px] font-bold text-indigo-600 mb-1.5 px-0.5">
                <button type="button" onClick={() => setSelectedZones(uniqueZones)} className="hover:underline bg-transparent border-none cursor-pointer">Select All</button>
                <button type="button" onClick={() => setSelectedZones([])} className="hover:underline bg-transparent border-none cursor-pointer">Deselect All</button>
              </div>
              <div className="max-h-40 overflow-y-auto space-y-0.5 border border-slate-100 rounded-lg p-1">
                {uniqueZones
                  .filter(z => z.toLowerCase().includes(zoneSearchText.toLowerCase()))
                  .map(zoneName => {
                    const isChecked = selectedZones.includes(zoneName);
                    return (
                      <label key={zoneName} className="flex items-center gap-2 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 rounded cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) setSelectedZones(selectedZones.filter(z => z !== zoneName));
                            else setSelectedZones([...selectedZones, zoneName]);
                          }}
                          className="accent-indigo-600 h-3.5 w-3.5"
                        />
                        <span className="truncate">{zoneName}</span>
                      </label>
                    );
                  })}
              </div>
            </div>

            {/* Column 3: Store Types */}
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">Store Type</span>
                <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-semibold">
                  {selectedTypes.length === 0 ? "All" : selectedTypes.length}
                </span>
              </div>
              <div className="flex justify-between text-[10px] font-bold text-indigo-600 mb-1.5 px-0.5">
                <button type="button" onClick={() => setSelectedTypes(uniqueTypes)} className="hover:underline bg-transparent border-none cursor-pointer">Select All</button>
                <button type="button" onClick={() => setSelectedTypes([])} className="hover:underline bg-transparent border-none cursor-pointer">Deselect All</button>
              </div>
              <div className="max-h-40 overflow-y-auto space-y-0.5 border border-slate-100 rounded-lg p-1">
                {uniqueTypes.map(tName => {
                  const isChecked = selectedTypes.includes(tName);
                  return (
                    <label key={tName} className="flex items-center gap-2 px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50 rounded cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) setSelectedTypes(selectedTypes.filter(t => t !== tName));
                          else setSelectedTypes([...selectedTypes, tName]);
                        }}
                        className="accent-indigo-600 h-3.5 w-3.5"
                      />
                      <span className="capitalize">{tName}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => setIsFilterOpen(false)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow transition-colors cursor-pointer"
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // ─── Top Toolbar Action Button Slot (actionButton) ───────────────────────────
  // Contains: Refresh Button + Export/Import Dropdown
  const actionButtonElement = (
    <div className="flex items-center gap-2">
      {/* Refresh Button */}
      <button
        onClick={loadReport}
        disabled={loading}
        className="flex items-center justify-center h-10 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-sm transition-all duration-200 cursor-pointer disabled:opacity-50"
        title="Refresh Report"
      >
        <i className={`fa-solid fa-arrows-rotate text-xs ${loading ? "animate-spin" : ""}`}></i>
      </button>

      {/* Export / Import Dropdown */}
      <div className="relative inline-block text-left" ref={dropdownRef}>
        <button
          onClick={() => setShowExportImportDropdown(!showExportImportDropdown)}
          disabled={exportingReport || exportingTemplate || importing}
          className="flex items-center gap-2 h-10 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold shadow-md transition-all duration-200 cursor-pointer disabled:opacity-50 border-none focus:outline-none"
          title="Import / Export Options"
        >
          <span>Export / Import</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
            stroke="currentColor"
            className={`w-3.5 h-3.5 transition-transform duration-200 ${showExportImportDropdown ? "rotate-180" : ""}`}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </button>

        {showExportImportDropdown && (
          <div className="absolute right-0 mt-2 w-52 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-1.5 origin-top-right">
            {/* Export Full Report */}
            <button
              onClick={() => {
                setShowExportImportDropdown(false);
                handleExportFullReport();
              }}
              disabled={exportingReport || exportingTemplate || importing}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 border-none bg-transparent cursor-pointer text-sm font-medium"
            >
              <i className="fa-solid fa-file-excel text-teal-600 text-base"></i>
              <span>{exportingReport ? "Exporting..." : "E. Report"}</span>
            </button>

            {/* Export Template */}
            <button
              onClick={() => {
                setShowExportImportDropdown(false);
                handleExportTemplate();
              }}
              disabled={exportingTemplate || exportingReport || importing}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 border-none bg-transparent cursor-pointer text-sm font-medium"
            >
              <i className="fa-solid fa-file-arrow-down text-emerald-600 text-base"></i>
              <span>{exportingTemplate ? "Generating..." : "E. Template"}</span>
            </button>

            {/* Import Target */}
            {canWrite && (
              <button
                onClick={() => {
                  setShowExportImportDropdown(false);
                  setIsImportModalOpen(true);
                }}
                disabled={importing || exportingReport || exportingTemplate}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 border-none bg-transparent cursor-pointer text-sm font-medium border-t border-slate-100"
              >
                <i className="fa-solid fa-file-arrow-up text-indigo-600 text-base"></i>
                <span>Import Target</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col flex-1 bg-slate-50 font-sans min-h-screen">
      <Navbar title="ERP Admin" />

      {/* Target Upload Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/55 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-[18px] w-full max-w-[500px] mx-auto shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-br from-indigo-600 to-indigo-700">
              <div>
                <h2 className="m-0 text-base font-bold text-white">Import Targets</h2>
                <p className="mt-0.5 text-xs text-indigo-100">{master?.title}</p>
              </div>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="bg-white/15 border-none rounded-lg w-[32px] h-[32px] cursor-pointer flex items-center justify-center text-white hover:bg-white/20"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/30 rounded-xl p-6 text-center">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".xlsx, .xls"
                  onChange={handleImportFileChange}
                  className="hidden"
                />
                <div className="flex flex-col items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 mb-3 text-lg">
                    <i className="fa-solid fa-cloud-arrow-up"></i>
                  </div>
                  <p className="text-xs font-bold text-slate-800">Upload Target Spreadsheet</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 mb-3">Only the Target column needs to be provided</p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={importing}
                    className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <i className="fa-solid fa-upload"></i>
                    {importing ? "Processing..." : "Select File"}
                  </button>
                </div>
              </div>
            </div>
            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-1.5 rounded-lg border border-slate-300 text-slate-600 bg-white font-semibold text-xs cursor-pointer hover:bg-slate-100"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 flex flex-col w-full mx-auto px-4 sm:px-[30px] py-6 sm:py-8">
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg mb-5 text-sm font-medium">
            {error}
          </div>
        )}

        <DataTable
          title={master?.title || "Special TVA Report"}
          data={tableRows}
          columns={columns}
          loading={loading}
          headerGroups={headerGroups}
          toggleActions={filtersElement}
          actionButton={actionButtonElement}
          searchPlaceholder="Search branch name..."
        />
      </main>
    </div>
  );
}

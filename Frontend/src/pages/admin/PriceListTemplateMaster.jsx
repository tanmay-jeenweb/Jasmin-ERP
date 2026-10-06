import { useEffect, useState, useMemo, useRef } from "react";
import Navbar from "../../components/Navbar";
import DataTable from "../../components/DataTable";
import {
  getAllPriceListTemplates,
  createPriceListTemplate,
  updatePriceListTemplate,
  deletePriceListTemplate,
  getTemplateFilterOptions,
  getTemplateExportData
} from "../../api/priceListTemplateApi";
import { getPricingFormulas as getVariations } from "../../api/pricingFormulaApi";
import toast from "react-hot-toast";
import { usePermission } from "../../context/PermissionContext";
import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Standard fixed columns present across Price Lists
const STANDARD_PRICE_LIST_COLUMNS = [
  { key: "product_code", label: "Product Code", type: "standard" },
  { key: "brand", label: "Brand", type: "standard" },
  { key: "icat_name", label: "Product Category", type: "standard" },
  { key: "model_group_name", label: "Model Group Name", type: "standard" },
  { key: "model_name", label: "Model Name", type: "standard" }
];

export default function PriceListTemplateMaster() {
  const { hasPermission, isAdmin } = usePermission();

  const canWrite = isAdmin || hasPermission("price_list_template_master", "write") || hasPermission("variation_master", "write") || hasPermission("price_list", "write");
  const canUpdate = isAdmin || hasPermission("price_list_template_master", "update") || hasPermission("variation_master", "update") || hasPermission("price_list", "write");
  const canDelete = isAdmin || hasPermission("price_list_template_master", "delete") || hasPermission("variation_master", "delete");

  const [templates, setTemplates] = useState([]);
  const [variations, setVariations] = useState([]);
  const [loading, setLoading] = useState(false);

  // ─── Create / Edit Template Modal State ───
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [templateName, setTemplateName] = useState("");
  const [selectedVariationId, setSelectedVariationId] = useState("");
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [isColumnDropdownOpen, setIsColumnDropdownOpen] = useState(false);
  const [columnSearchText, setColumnSearchText] = useState("");
  const [saving, setSaving] = useState(false);

  // ─── Export Modal State ───
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportingTemplate, setExportingTemplate] = useState(null);
  const [exportLoadingExcel, setExportLoadingExcel] = useState(false);
  const [exportLoadingPdf, setExportLoadingPdf] = useState(false);
  const [exportFetchingFilters, setExportFetchingFilters] = useState(false);
  const [availableBrands, setAvailableBrands] = useState([]);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [availableDates, setAvailableDates] = useState([]);
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [brandSearchText, setBrandSearchText] = useState("");
  const [categorySearchText, setCategorySearchText] = useState("");
  const [isBrandFilterOpen, setIsBrandFilterOpen] = useState(false);
  const [isCategoryFilterOpen, setIsCategoryFilterOpen] = useState(false);

  // Refs for outside click closing
  const columnDropdownRef = useRef(null);
  const brandFilterRef = useRef(null);
  const categoryFilterRef = useRef(null);

  // Fetch all templates and variations
  const fetchData = async () => {
    setLoading(true);
    try {
      const [templateRes, varRes] = await Promise.all([
        getAllPriceListTemplates(),
        getVariations()
      ]);

      if (templateRes.data?.success) {
        setTemplates(templateRes.data.data || []);
      }

      if (varRes.data?.success) {
        const rawVars = varRes.data.data || [];
        setVariations(rawVars.filter(v => !v.is_deleted));
      }
    } catch (err) {
      console.error("Failed to load templates or variations:", err);
      toast.error(err.response?.data?.message || "Failed to load templates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (columnDropdownRef.current && !columnDropdownRef.current.contains(e.target)) {
        setIsColumnDropdownOpen(false);
      }
      if (brandFilterRef.current && !brandFilterRef.current.contains(e.target)) {
        setIsBrandFilterOpen(false);
      }
      if (categoryFilterRef.current && !categoryFilterRef.current.contains(e.target)) {
        setIsCategoryFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Compute available columns for the currently selected variation in the modal
  const availableColumnsForSelectedVariation = useMemo(() => {
    if (!selectedVariationId) return STANDARD_PRICE_LIST_COLUMNS;
    const variation = variations.find(v => String(v.id) === String(selectedVariationId));
    if (!variation) return STANDARD_PRICE_LIST_COLUMNS;

    let varCols = [];
    try {
      varCols = Array.isArray(variation.columns)
        ? variation.columns
        : (typeof variation.columns === "string" ? JSON.parse(variation.columns) : []);
    } catch (e) {
      varCols = [];
    }

    const customCols = varCols
      .filter(c => !c.is_deleted && c.column_name)
      .map(c => ({
        key: c.column_name,
        label: c.column_name,
        type: "custom",
        column_id: c.column_id,
        landing_types: c.landing_types || ["All"]
      }));

    return [...STANDARD_PRICE_LIST_COLUMNS, ...customCols];
  }, [selectedVariationId, variations]);

  // Filter columns by search text
  const filteredAvailableColumns = useMemo(() => {
    if (!columnSearchText.trim()) return availableColumnsForSelectedVariation;
    const q = columnSearchText.toLowerCase();
    return availableColumnsForSelectedVariation.filter(c =>
      c.label.toLowerCase().includes(q) || c.key.toLowerCase().includes(q)
    );
  }, [availableColumnsForSelectedVariation, columnSearchText]);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingTemplate(null);
    setTemplateName("");
    // Default to first variation if available
    const firstVarId = variations.length > 0 ? String(variations[0].id) : "";
    setSelectedVariationId(firstVarId);
    // Default select standard columns
    setSelectedColumns([...STANDARD_PRICE_LIST_COLUMNS]);
    setColumnSearchText("");
    setIsColumnDropdownOpen(false);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (template) => {
    setEditingTemplate(template);
    setTemplateName(template.template_name || "");
    setSelectedVariationId(String(template.variation_id || ""));
    const parsedCols = Array.isArray(template.columns) ? template.columns : [];
    setSelectedColumns(parsedCols);
    setColumnSearchText("");
    setIsColumnDropdownOpen(false);
    setIsModalOpen(true);
  };

  // Handle variation selection change
  const handleVariationChange = (e) => {
    const newVarId = e.target.value;
    setSelectedVariationId(newVarId);
    // Keep only columns that exist in the newly selected variation
    const variation = variations.find(v => String(v.id) === String(newVarId));
    let varCols = [];
    if (variation) {
      try {
        varCols = Array.isArray(variation.columns)
          ? variation.columns
          : (typeof variation.columns === "string" ? JSON.parse(variation.columns) : []);
      } catch (err) {
        varCols = [];
      }
    }
    const customNames = new Set(varCols.map(c => c.column_name));
    const preserved = selectedColumns.filter(c =>
      c.type === "standard" || customNames.has(c.key)
    );
    setSelectedColumns(preserved.length > 0 ? preserved : [...STANDARD_PRICE_LIST_COLUMNS]);
  };

  // Toggle single column selection
  const handleToggleColumn = (col) => {
    const isSelected = selectedColumns.some(c => c.key === col.key);
    if (isSelected) {
      setSelectedColumns(selectedColumns.filter(c => c.key !== col.key));
    } else {
      setSelectedColumns([...selectedColumns, col]);
    }
  };

  // Select all columns
  const handleSelectAllColumns = () => {
    setSelectedColumns([...availableColumnsForSelectedVariation]);
  };

  // Deselect all columns
  const handleDeselectAllColumns = () => {
    setSelectedColumns([]);
  };

  // Save template (Create / Update)
  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    if (!templateName.trim()) {
      toast.error("Template name is required");
      return;
    }
    if (!selectedVariationId) {
      toast.error("Please select a Price List");
      return;
    }
    if (selectedColumns.length === 0) {
      toast.error("Please select at least one column for the template");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        template_name: templateName.trim(),
        variation_id: parseInt(selectedVariationId, 10),
        columns: selectedColumns
      };

      if (editingTemplate) {
        await updatePriceListTemplate(editingTemplate.id, payload);
        toast.success("Template updated successfully");
      } else {
        await createPriceListTemplate(payload);
        toast.success("Template created successfully");
      }

      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      console.error("Save template error:", err);
      toast.error(err.response?.data?.message || "Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  // Delete template
  const handleDeleteTemplate = async (template) => {
    if (!window.confirm(`Are you sure you want to delete template "${template.template_name}"?`)) {
      return;
    }
    try {
      await deletePriceListTemplate(template.id);
      toast.success("Template deleted successfully");
      fetchData();
    } catch (err) {
      console.error("Delete template error:", err);
      toast.error(err.response?.data?.message || "Failed to delete template");
    }
  };

  // ─── Export Modal Workflow ───
  const handleOpenExportModal = async (template) => {
    setExportingTemplate(template);
    setSelectedBrands([]);
    setSelectedCategories([]);
    setSelectedDate("");
    setBrandSearchText("");
    setCategorySearchText("");
    setIsBrandFilterOpen(false);
    setIsCategoryFilterOpen(false);
    setIsExportModalOpen(true);
    setExportFetchingFilters(true);

    try {
      const res = await getTemplateFilterOptions(template.id);
      if (res.data?.success) {
        const brands = res.data.brands || [];
        const categories = res.data.categories || [];
        const dates = res.data.dates || [];
        setAvailableBrands(brands);
        setAvailableCategories(categories);
        setAvailableDates(dates);
        // Default select all brands and all categories
        setSelectedBrands([...brands]);
        setSelectedCategories([...categories]);
      }
    } catch (err) {
      console.error("Failed to fetch filter options for export:", err);
      toast.error("Could not load brands and categories filters for this template");
    } finally {
      setExportFetchingFilters(false);
    }
  };

  // Execute Excel download using DB data (live or date snapshot)
  const handleDownloadExcel = async () => {
    if (!exportingTemplate) return;

    if (availableBrands.length > 0 && selectedBrands.length === 0) {
      toast.error("Please select at least one brand");
      return;
    }

    if (availableCategories.length > 0 && selectedCategories.length === 0) {
      toast.error("Please select at least one category");
      return;
    }

    setExportLoadingExcel(true);
    const loadToastId = toast.loading("Generating Excel report from database...");

    try {
      const targetDateParam = selectedDate || null;
      const res = await getTemplateExportData(exportingTemplate.id, {
        brands: selectedBrands,
        categories: selectedCategories,
        date: targetDateParam
      });

      if (!res.data?.success) {
        toast.error(res.data?.message || "Failed to fetch export data", { id: loadToastId });
        return;
      }

      const rows = res.data.data || [];
      const exportColumns = res.data.columns || exportingTemplate.columns || [];

      if (rows.length === 0) {
        toast.error("No records found in database matching selected filters", { id: loadToastId });
        return;
      }

      if (exportColumns.length === 0) {
        toast.error("No columns configured for this template", { id: loadToastId });
        return;
      }

      // Generate ExcelJS Workbook
      const workbook = new ExcelJS.Workbook();
      const sheetName = (exportingTemplate.template_name || "Template Report").slice(0, 30);
      const worksheet = workbook.addWorksheet(sheetName, {
        views: [{ showGridLines: true }]
      });

      // Prepare worksheet columns
      worksheet.columns = exportColumns.map(col => ({
        header: col.label || col.key,
        key: col.key,
        width: Math.max(16, (col.label || col.key).length + 5)
      }));

      // Header row styling - soft light purple background
      const headerRow = worksheet.getRow(1);
      headerRow.height = 28;
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE9D5FF" } // Soft light purple
        };
        cell.font = {
          name: "Segoe UI",
          size: 11,
          bold: true,
          color: { argb: "FF3B0764" } // Deep purple text
        };
        cell.alignment = { vertical: "middle", horizontal: "center" };
      });

      // Populate data rows
      rows.forEach((rowItem) => {
        const rowData = {};
        exportColumns.forEach((col) => {
          const colKey = col.key;
          let val = rowItem[colKey];

          // If not found directly, try case-insensitive or column_name match
          if (val === undefined || val === null) {
            const matchKey = Object.keys(rowItem).find(
              (k) => k.trim().toLowerCase() === colKey.trim().toLowerCase()
            );
            if (matchKey) {
              val = rowItem[matchKey];
            } else if (col.column_name && rowItem[col.column_name] !== undefined) {
              val = rowItem[col.column_name];
            }
          }

          // Map standard field fallbacks
          if (colKey === "brand") {
            val = rowItem.brand || rowItem.brand_name || "";
          } else if (colKey === "icat_name" || colKey === "product_name") {
            val = rowItem.product_category || rowItem.product_name || rowItem.icat_name || rowItem.original_icat_name || "";
          } else if (colKey === "product_code") {
            val = rowItem.product_code || "";
          } else if (colKey === "model_group_name") {
            val = rowItem.model_group_name || "";
          } else if (colKey === "model_name") {
            val = rowItem.model_name || "";
          }

          // Format numbers if numeric and present in DB
          if (val !== undefined && val !== null && String(val).trim() !== "" && String(val).trim() !== "—" && String(val).trim() !== "-") {
            const num = Number(val);
            if (!isNaN(num) && typeof val !== "boolean") {
              rowData[colKey] = num;
            } else {
              rowData[colKey] = val;
            }
          } else {
            // When there is NO data in DB, do NOT set to 0! Leave blank for custom columns, "—" for standard
            rowData[colKey] = col.type === "custom" ? "" : "—";
          }
        });

        worksheet.addRow(rowData);
      });

      // Apply borders, alignments, and number formats
      worksheet.eachRow({ includeHeader: false }, (row) => {
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          cell.font = { name: "Segoe UI", size: 10 };
          cell.border = {
            top: { style: "thin", color: { argb: "FFE2E8F0" } },
            bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
            left: { style: "thin", color: { argb: "FFE2E8F0" } },
            right: { style: "thin", color: { argb: "FFE2E8F0" } }
          };

          const colDef = exportColumns[colNumber - 1];
          if (colDef && colDef.type === "custom") {
            if (typeof cell.value === "number") {
              cell.numFmt = "0.00";
            }
            cell.alignment = { horizontal: "right", vertical: "middle" };
          } else {
            cell.alignment = { horizontal: "left", vertical: "middle" };
          }
        });
      });

      // Download file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const cleanName = (exportingTemplate.template_name || "Template_Report").replace(/[^a-zA-Z0-9_-]/g, "_");
      const dateStr = (targetDateParam || new Date().toISOString().split("T")[0]).replace(/[^a-zA-Z0-9_-]/g, "_");
      link.download = `${cleanName}_${dateStr}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);

      toast.success("Excel report downloaded successfully!", { id: loadToastId });
      setIsExportModalOpen(false);
    } catch (err) {
      console.error("Download template report error:", err);
      toast.error("Failed to generate Excel report", { id: loadToastId });
    } finally {
      setExportLoadingExcel(false);
    }
  };

  // Execute PDF download using DB data (live or date snapshot)
  const handleDownloadPdf = async () => {
    if (!exportingTemplate) return;

    if (availableBrands.length > 0 && selectedBrands.length === 0) {
      toast.error("Please select at least one brand");
      return;
    }

    if (availableCategories.length > 0 && selectedCategories.length === 0) {
      toast.error("Please select at least one category");
      return;
    }

    setExportLoadingPdf(true);
    const loadToastId = toast.loading("Generating PDF report from database...");

    try {
      const targetDateParam = selectedDate || null;
      const res = await getTemplateExportData(exportingTemplate.id, {
        brands: selectedBrands,
        categories: selectedCategories,
        date: targetDateParam
      });

      if (!res.data?.success) {
        toast.error(res.data?.message || "Failed to fetch export data", { id: loadToastId });
        return;
      }

      const rows = res.data.data || [];
      const exportColumns = res.data.columns || exportingTemplate.columns || [];

      if (rows.length === 0) {
        toast.error("No records found in database matching selected filters", { id: loadToastId });
        return;
      }

      if (exportColumns.length === 0) {
        toast.error("No columns configured for this template", { id: loadToastId });
        return;
      }

      // Initialize landscape A4 PDF
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4"
      });

      const templateTitle = exportingTemplate.template_name || "Price List Template";
      const formatTitle = exportingTemplate.format_name || "Price List";
      const dateLabel = targetDateParam ? `Snapshot: ${targetDateParam}` : `Live Data (${new Date().toLocaleDateString("en-IN")})`;

      // Top Header Banner
      doc.setFillColor(104, 4, 161); // Jasmin purple #6804a1
      doc.rect(0, 0, 297, 16, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(templateTitle, 14, 10.5);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.text(`Format: ${formatTitle} | ${dateLabel}`, 283, 10.5, { align: "right" });

      // Summary sub-header
      doc.setTextColor(71, 85, 105);
      doc.setFontSize(8);
      const brandsSummary = selectedBrands.length === availableBrands.length ? "All Brands" : `${selectedBrands.length} Brands`;
      const catsSummary = selectedCategories.length === availableCategories.length ? "All Categories" : `${selectedCategories.length} Categories`;
      doc.text(`Filters: ${brandsSummary} | ${catsSummary} | Total Records: ${rows.length}`, 14, 21);

      // Prepare autoTable headers and body
      const tableHeaders = [exportColumns.map(col => col.label || col.key)];
      const tableData = rows.map(rowItem => {
        return exportColumns.map(col => {
          const colKey = col.key;
          let val = rowItem[colKey];

          if (val === undefined || val === null) {
            const matchKey = Object.keys(rowItem).find(
              (k) => k.trim().toLowerCase() === colKey.trim().toLowerCase()
            );
            if (matchKey) {
              val = rowItem[matchKey];
            } else if (col.column_name && rowItem[col.column_name] !== undefined) {
              val = rowItem[col.column_name];
            }
          }

          if (colKey === "brand") {
            return rowItem.brand || rowItem.brand_name || "";
          } else if (colKey === "icat_name" || colKey === "product_name") {
            return rowItem.product_category || rowItem.product_name || rowItem.icat_name || "";
          } else if (colKey === "product_code") {
            return rowItem.product_code || "";
          } else if (colKey === "model_group_name") {
            return rowItem.model_group_name || "";
          } else if (colKey === "model_name") {
            return rowItem.model_name || "";
          }

          if (val !== undefined && val !== null && String(val).trim() !== "" && String(val).trim() !== "—" && String(val).trim() !== "-") {
            const num = Number(val);
            if (!isNaN(num) && typeof val !== "boolean") {
              return num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            }
            return String(val);
          }
          return "";
        });
      });

      // Align custom price columns to the right, standard to left
      const columnStyles = {};
      exportColumns.forEach((col, idx) => {
        if (col.type === "custom") {
          columnStyles[idx] = { halign: "right" };
        } else {
          columnStyles[idx] = { halign: "left" };
        }
      });

      autoTable(doc, {
        head: tableHeaders,
        body: tableData,
        startY: 24,
        theme: "striped",
        headStyles: {
          fillColor: [104, 4, 161],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 8,
          halign: "center",
          valign: "middle"
        },
        bodyStyles: {
          fontSize: 7.5,
          textColor: [30, 41, 59],
          cellPadding: 1.8,
          valign: "middle"
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        columnStyles: columnStyles,
        margin: { left: 12, right: 12, bottom: 14 },
        didDrawPage: (data) => {
          const pageCount = doc.internal.getNumberOfPages();
          const currentPage = data.pageNumber;
          doc.setFontSize(7.5);
          doc.setTextColor(148, 163, 184);
          doc.text(
            `Generated by Jasmin ERP on ${new Date().toLocaleString("en-IN")}`,
            12,
            202
          );
          doc.text(
            `Page ${currentPage} of ${pageCount}`,
            285,
            202,
            { align: "right" }
          );
        }
      });

      const cleanName = (exportingTemplate.template_name || "Template_Report").replace(/[^a-zA-Z0-9_-]/g, "_");
      const dateStr = (targetDateParam || new Date().toISOString().split("T")[0]).replace(/[^a-zA-Z0-9_-]/g, "_");
      doc.save(`${cleanName}_${dateStr}.pdf`);

      toast.success("PDF report downloaded successfully!", { id: loadToastId });
      setIsExportModalOpen(false);
    } catch (err) {
      console.error("PDF export error:", err);
      toast.error("Failed to generate PDF report", { id: loadToastId });
    } finally {
      setExportLoadingPdf(false);
    }
  };

  // Table columns definition for DataTable
  const tableColumns = useMemo(() => [
    {
      key: "template_name",
      label: "Template Name",
      render: (row) => (
        <span className="font-bold text-slate-800 text-sm">{row.template_name}</span>
      )
    },
    {
      key: "format_name",
      label: "Price List Format",
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200/60">
            <i className="fa-solid fa-file-invoice-dollar text-[11px]"></i>
            {row.format_name || "Price List"}
          </span>
          {row.state_name && (
            <span className="text-[11px] text-slate-400 font-medium">({row.state_name})</span>
          )}
        </div>
      )
    },
    {
      key: "columns",
      label: "Selected Columns",
      render: (row) => {
        const cols = Array.isArray(row.columns) ? row.columns : [];
        return (
          <div className="flex flex-wrap items-center gap-1 max-w-md">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
              {cols.length} Column{cols.length !== 1 ? "s" : ""}
            </span>
            <div className="flex flex-wrap gap-1">
              {cols.slice(0, 4).map((c, idx) => (
                <span key={idx} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                  {c.label || c.key}
                </span>
              ))}
              {cols.length > 4 && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-200/70 text-slate-600">
                  +{cols.length - 4} more
                </span>
              )}
            </div>
          </div>
        );
      }
    },
    {
      key: "actions",
      label: "Actions",
      render: (row) => (
        <div className="flex items-center gap-2">
          {/* Export Button */}
          <button
            type="button"
            onClick={() => handleOpenExportModal(row)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-[#6804a1] hover:bg-[#530382] transition shadow-xs cursor-pointer focus:outline-none"
            title="Export Report with Brand & Category filters"
          >
            <i className="fa-solid fa-file-excel text-xs"></i>
            <span>Export</span>
          </button>

          {/* Edit Button */}
          {canUpdate && (
            <button
              type="button"
              onClick={() => handleOpenEditModal(row)}
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 transition cursor-pointer"
              title="Edit Template"
            >
              <i className="fa-solid fa-pen-to-square text-xs"></i>
            </button>
          )}

          {/* Delete Button */}
          {canDelete && (
            <button
              type="button"
              onClick={() => handleDeleteTemplate(row)}
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 border border-slate-200 transition cursor-pointer"
              title="Delete Template"
            >
              <i className="fa-solid fa-trash-can text-xs"></i>
            </button>
          )}
        </div>
      )
    }
  ], [canUpdate, canDelete]);

  return (
    <div className="flex flex-col flex-1 bg-slate-50 font-sans min-h-screen">
      <Navbar title="Price List Template Master" />

      <main className="flex-1 flex flex-col w-full mx-auto px-[30px] py-8">
        <DataTable
          tableId="price_list_template_master"
          title="Price List Template Master"
          data={templates}
          columns={tableColumns}
          loading={loading}
          searchPlaceholder="Search template name, price list, columns..."
          actionButton={
            canWrite ? (
              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="flex w-10 h-10 items-center justify-center rounded-[9px] bg-gradient-to-br from-indigo-650 to-indigo-750 text-white border-none cursor-pointer shadow-[0_2px_8px_rgba(104,4,161,0.35)] hover:opacity-95 transition-opacity"
                title="Create Template"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-[18px] h-[18px]">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>
            ) : null
          }
        />
      </main>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. CREATE / EDIT TEMPLATE MODAL (3 Fields)                    */}
      {/* ───────────────────────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/55 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-[18px] w-full max-w-[620px] mx-auto shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-br from-[#6804a1] to-[#7f0ab8] text-white shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center">
                  <i className="fa-solid fa-sliders text-sm"></i>
                </div>
                <div>
                  <h2 className="text-base font-bold leading-tight">
                    {editingTemplate ? "Edit Price List Template" : "Create Price List Template"}
                  </h2>
                  <p className="text-[11px] text-white/80 mt-0.5">
                    Configure template columns for custom Excel reports
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveTemplate} className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* FIELD 1: Name of the template */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  1. Template Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Dealer Price List, Gujarat Special MOP, Model Group Report"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-[#6804a1] focus:ring-2 focus:ring-[#6804a1]/20 outline-none transition"
                  required
                />
              </div>

              {/* FIELD 2: Pricelist Name (Dropdown for pricelist master) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  2. Pricelist Name (Master) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={selectedVariationId}
                    onChange={handleVariationChange}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-[#6804a1] focus:ring-2 focus:ring-[#6804a1]/20 outline-none transition bg-white cursor-pointer appearance-none pr-9 font-medium text-slate-800"
                    required
                  >
                    <option value="" disabled>-- Select Price List --</option>
                    {variations.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.format_name || "Price List"} {v.state_name ? `(${v.state_name})` : ""}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <i className="fa-solid fa-chevron-down text-xs"></i>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Available columns below will automatically update based on the selected Price List.
                </p>
              </div>

              {/* FIELD 3: All the columns in that selected pricelist as dropdown with multiselect and search both */}
              <div ref={columnDropdownRef} className="relative">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    3. Selected Columns <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[11px] font-semibold text-purple-700">
                    {selectedColumns.length} of {availableColumnsForSelectedVariation.length} selected
                  </span>
                </div>

                {/* Dropdown Trigger Button */}
                <button
                  type="button"
                  onClick={() => setIsColumnDropdownOpen(!isColumnDropdownOpen)}
                  className="w-full flex items-center justify-between text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white hover:border-slate-400 transition cursor-pointer text-left focus:outline-none"
                >
                  <span className={selectedColumns.length === 0 ? "text-slate-400" : "font-semibold text-slate-800"}>
                    {selectedColumns.length === 0
                      ? "Select columns to include in template..."
                      : `${selectedColumns.length} column${selectedColumns.length > 1 ? "s" : ""} selected`}
                  </span>
                  <i className={`fa-solid fa-chevron-down text-xs text-slate-400 transition-transform ${isColumnDropdownOpen ? "rotate-180" : ""}`}></i>
                </button>

                {/* Dropdown Menu Popover */}
                {isColumnDropdownOpen && (
                  <div className="absolute left-0 right-0 mt-1.5 rounded-xl border border-slate-200 bg-white shadow-xl z-50 flex flex-col max-h-72 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                    {/* Search box inside dropdown */}
                    <div className="p-2 border-b border-slate-100 flex items-center gap-2 bg-slate-50/70">
                      <i className="fa-solid fa-magnifying-glass text-xs text-slate-400 ml-1"></i>
                      <input
                        type="text"
                        placeholder="Search columns..."
                        value={columnSearchText}
                        onChange={(e) => setColumnSearchText(e.target.value)}
                        className="w-full text-xs bg-transparent border-none outline-none font-medium text-slate-700"
                        autoFocus
                      />
                      {columnSearchText && (
                        <button
                          type="button"
                          onClick={() => setColumnSearchText("")}
                          className="text-slate-400 hover:text-slate-600 p-0.5"
                        >
                          <i className="fa-solid fa-xmark text-xs"></i>
                        </button>
                      )}
                    </div>

                    {/* Quick Select All / Deselect All Bar */}
                    <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between text-[11px] bg-slate-50/40">
                      <button
                        type="button"
                        onClick={handleSelectAllColumns}
                        className="text-indigo-600 font-semibold hover:underline cursor-pointer"
                      >
                        Select All ({availableColumnsForSelectedVariation.length})
                      </button>
                      <button
                        type="button"
                        onClick={handleDeselectAllColumns}
                        className="text-slate-500 font-semibold hover:underline cursor-pointer"
                      >
                        Deselect All
                      </button>
                    </div>

                    {/* Checkbox list */}
                    <div className="overflow-y-auto p-1.5 space-y-0.5 flex-1">
                      {filteredAvailableColumns.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-4">No matching columns found</p>
                      ) : (
                        filteredAvailableColumns.map((col) => {
                          const isChecked = selectedColumns.some(c => c.key === col.key);
                          return (
                            <label
                              key={col.key}
                              className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer select-none transition ${
                                isChecked ? "bg-purple-50/70 text-purple-950 font-semibold" : "text-slate-700 hover:bg-slate-50"
                              }`}
                            >
                              <div className="flex items-center gap-2.5 truncate">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleToggleColumn(col)}
                                  className="accent-[#6804a1] h-3.5 w-3.5 rounded cursor-pointer"
                                />
                                <span className="truncate">{col.label}</span>
                              </div>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ml-2 ${
                                col.type === "standard"
                                  ? "bg-slate-100 text-slate-600"
                                  : "bg-purple-100/70 text-purple-700"
                              }`}>
                                {col.type === "standard" ? "Standard" : "Price"}
                              </span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* Selected Columns Tags Preview */}
                {selectedColumns.length > 0 && (
                  <div className="mt-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Selected Columns Order:
                    </p>
                    <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                      {selectedColumns.map((col) => (
                        <span
                          key={col.key}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-white text-slate-800 border border-slate-200 shadow-2xs group"
                        >
                          <span className="truncate max-w-[150px]">{col.label}</span>
                          <button
                            type="button"
                            onClick={() => handleToggleColumn(col)}
                            className="text-slate-400 hover:text-red-500 transition"
                            title="Remove column"
                          >
                            <i className="fa-solid fa-xmark text-[10px]"></i>
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-[#6804a1] hover:bg-[#530382] rounded-xl transition shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {saving && <i className="fa-solid fa-spinner fa-spin text-xs"></i>}
                  <span>{editingTemplate ? "Update Template" : "Save Template"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. EXPORT REPORT MODAL (Brands & Categories Filter + DB Download) */}
      {/* ───────────────────────────────────────────────────────────── */}
      {isExportModalOpen && exportingTemplate && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/55 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-[18px] w-full max-w-[560px] mx-auto shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-br from-[#6804a1] to-[#7f0ab8] text-white shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center">
                  <i className="fa-solid fa-file-excel text-sm"></i>
                </div>
                <div>
                  <h2 className="text-base font-bold leading-tight">
                    Export Template: {exportingTemplate.template_name}
                  </h2>
                  <p className="text-[11px] text-white/80 mt-0.5">
                    Filter by Brands and Categories to download fresh DB report
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* Template Info Card */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-500">Price List:</span>
                  <span className="font-bold text-slate-800">{exportingTemplate.format_name || "Price List"}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-500">Included Columns:</span>
                  <span className="font-bold text-purple-700">
                    {(exportingTemplate.columns || []).length} columns configured
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(exportingTemplate.columns || []).slice(0, 6).map((c, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-200">
                      {c.label || c.key}
                    </span>
                  ))}
                  {(exportingTemplate.columns || []).length > 6 && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-white text-slate-500 border border-slate-200">
                      +{(exportingTemplate.columns || []).length - 6} more
                    </span>
                  )}
                </div>
              </div>

              {exportFetchingFilters ? (
                <div className="flex items-center justify-center py-8 text-slate-500 gap-2">
                  <i className="fa-solid fa-circle-notch fa-spin text-purple-600"></i>
                  <span className="text-xs font-semibold">Loading available brands and categories...</span>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* FILTER 0: Date Selection Filter */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <i className="fa-regular fa-calendar text-xs text-purple-700"></i>
                        <span className="text-xs font-bold text-slate-700">Price List Date Filter</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedDate && (
                          <button
                            type="button"
                            onClick={() => setSelectedDate("")}
                            className="inline-flex items-center gap-1 text-[11px] text-purple-700 font-bold hover:text-purple-900 hover:underline cursor-pointer"
                          >
                            <i className="fa-solid fa-rotate-left text-[10px]"></i>
                            Reset to Live Data
                          </button>
                        )}
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          selectedDate ? "bg-amber-100 text-amber-800" : "bg-purple-100 text-purple-800"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${selectedDate ? "bg-amber-500" : "bg-purple-600 animate-pulse"}`}></span>
                          {selectedDate ? `Snapshot: ${selectedDate}` : "Live / Active Prices"}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                      <div className="relative flex-1">
                        <input
                          type="date"
                          value={selectedDate}
                          onChange={(e) => setSelectedDate(e.target.value)}
                          className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white font-medium text-slate-700 focus:outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600"
                        />
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium sm:w-1/2">
                        {selectedDate ? (
                          <span className="text-amber-800 font-medium">
                            <i className="fa-solid fa-clock-rotate-left mr-1 text-amber-600"></i>
                            Exports latest prices recorded on <b>{selectedDate}</b>
                          </span>
                        ) : (
                          <span>
                            <i className="fa-solid fa-bolt mr-1 text-purple-600"></i>
                            Exports current real-time prices from database
                          </span>
                        )}
                      </div>
                    </div>

                    {availableDates.length > 0 && (
                      <div className="pt-1 flex flex-wrap items-center gap-1.5 border-t border-slate-200/60 mt-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                          Recorded Dates:
                        </span>
                        {availableDates.slice(0, 6).map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setSelectedDate(selectedDate === d ? "" : d)}
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border transition cursor-pointer ${
                              selectedDate === d
                                ? "bg-purple-700 text-white border-purple-700 shadow-xs"
                                : "bg-white text-slate-600 border-slate-200 hover:border-purple-300 hover:text-purple-700"
                            }`}
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* FILTER 1: Brands Filter (Multi-select dropdown with search, select all / deselect all) */}
                  <div ref={brandFilterRef} className="relative">
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                      <span>Brand Filter</span>
                      <span className="text-[11px] font-semibold text-slate-500">
                        {selectedBrands.length === availableBrands.length && availableBrands.length > 0
                          ? "All Brands Selected"
                          : `${selectedBrands.length} of ${availableBrands.length} selected`}
                      </span>
                    </label>

                    <button
                      type="button"
                      onClick={() => {
                        setIsBrandFilterOpen(!isBrandFilterOpen);
                        setIsCategoryFilterOpen(false);
                      }}
                      className="w-full flex items-center justify-between text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white hover:border-slate-400 transition cursor-pointer text-left focus:outline-none"
                    >
                      <span className="font-semibold text-slate-800 truncate">
                        {selectedBrands.length === availableBrands.length && availableBrands.length > 0
                          ? `All Brands (${availableBrands.length})`
                          : selectedBrands.length === 0
                            ? "No brands selected"
                            : `${selectedBrands.length} Brand${selectedBrands.length > 1 ? "s" : ""} Selected`}
                      </span>
                      <i className={`fa-solid fa-chevron-down text-xs text-slate-400 transition-transform ${isBrandFilterOpen ? "rotate-180" : ""}`}></i>
                    </button>

                    {isBrandFilterOpen && (
                      <div className="absolute left-0 right-0 mt-1.5 rounded-xl border border-slate-200 bg-white shadow-xl z-50 flex flex-col max-h-64 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                        {/* Search Input */}
                        <div className="p-2 border-b border-slate-100 flex items-center gap-2 bg-slate-50/70">
                          <i className="fa-solid fa-magnifying-glass text-xs text-slate-400 ml-1"></i>
                          <input
                            type="text"
                            placeholder="Search brands..."
                            value={brandSearchText}
                            onChange={(e) => setBrandSearchText(e.target.value)}
                            className="w-full text-xs bg-transparent border-none outline-none font-medium text-slate-700"
                            autoFocus
                          />
                        </div>

                        {/* Select All / Deselect All */}
                        <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between text-[11px] bg-slate-50/40">
                          <button
                            type="button"
                            onClick={() => setSelectedBrands([...availableBrands])}
                            className="text-purple-700 font-semibold hover:underline cursor-pointer"
                          >
                            Select All ({availableBrands.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedBrands([])}
                            className="text-slate-500 font-semibold hover:underline cursor-pointer"
                          >
                            Deselect All
                          </button>
                        </div>

                        {/* Brands List */}
                        <div className="overflow-y-auto p-1.5 space-y-0.5 flex-1">
                          {availableBrands.length === 0 ? (
                            <p className="text-xs text-slate-400 text-center py-4">No brands in this price list</p>
                          ) : (
                            availableBrands
                              .filter(b => b.toLowerCase().includes(brandSearchText.toLowerCase()))
                              .map((brand) => {
                                const isChecked = selectedBrands.includes(brand);
                                return (
                                  <label
                                    key={brand}
                                    className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer select-none transition ${
                                      isChecked ? "bg-purple-50 text-purple-950 font-semibold" : "text-slate-700 hover:bg-slate-50"
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => {
                                        if (isChecked) {
                                          setSelectedBrands(selectedBrands.filter(b => b !== brand));
                                        } else {
                                          setSelectedBrands([...selectedBrands, brand]);
                                        }
                                      }}
                                      className="accent-[#6804a1] h-3.5 w-3.5 rounded cursor-pointer"
                                    />
                                    <span className="truncate">{brand}</span>
                                  </label>
                                );
                              })
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* FILTER 2: Categories Filter (Multi-select dropdown with search, select all / deselect all) */}
                  <div ref={categoryFilterRef} className="relative">
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                      <span>Product Category Filter</span>
                      <span className="text-[11px] font-semibold text-slate-500">
                        {selectedCategories.length === availableCategories.length && availableCategories.length > 0
                          ? "All Categories Selected"
                          : `${selectedCategories.length} of ${availableCategories.length} selected`}
                      </span>
                    </label>

                    <button
                      type="button"
                      onClick={() => {
                        setIsCategoryFilterOpen(!isCategoryFilterOpen);
                        setIsBrandFilterOpen(false);
                      }}
                      className="w-full flex items-center justify-between text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white hover:border-slate-400 transition cursor-pointer text-left focus:outline-none"
                    >
                      <span className="font-semibold text-slate-800 truncate">
                        {selectedCategories.length === availableCategories.length && availableCategories.length > 0
                          ? `All Categories (${availableCategories.length})`
                          : selectedCategories.length === 0
                            ? "No categories selected"
                            : `${selectedCategories.length} Categor${selectedCategories.length > 1 ? "ies" : "y"} Selected`}
                      </span>
                      <i className={`fa-solid fa-chevron-down text-xs text-slate-400 transition-transform ${isCategoryFilterOpen ? "rotate-180" : ""}`}></i>
                    </button>

                    {isCategoryFilterOpen && (
                      <div className="absolute left-0 right-0 mt-1.5 rounded-xl border border-slate-200 bg-white shadow-xl z-50 flex flex-col max-h-64 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                        {/* Search Input */}
                        <div className="p-2 border-b border-slate-100 flex items-center gap-2 bg-slate-50/70">
                          <i className="fa-solid fa-magnifying-glass text-xs text-slate-400 ml-1"></i>
                          <input
                            type="text"
                            placeholder="Search categories..."
                            value={categorySearchText}
                            onChange={(e) => setCategorySearchText(e.target.value)}
                            className="w-full text-xs bg-transparent border-none outline-none font-medium text-slate-700"
                            autoFocus
                          />
                        </div>

                        {/* Select All / Deselect All */}
                        <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between text-[11px] bg-slate-50/40">
                          <button
                            type="button"
                            onClick={() => setSelectedCategories([...availableCategories])}
                            className="text-purple-700 font-semibold hover:underline cursor-pointer"
                          >
                            Select All ({availableCategories.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedCategories([])}
                            className="text-slate-500 font-semibold hover:underline cursor-pointer"
                          >
                            Deselect All
                          </button>
                        </div>

                        {/* Categories List */}
                        <div className="overflow-y-auto p-1.5 space-y-0.5 flex-1">
                          {availableCategories.length === 0 ? (
                            <p className="text-xs text-slate-400 text-center py-4">No categories in this price list</p>
                          ) : (
                            availableCategories
                              .filter(c => c.toLowerCase().includes(categorySearchText.toLowerCase()))
                              .map((cat) => {
                                const isChecked = selectedCategories.includes(cat);
                                return (
                                  <label
                                    key={cat}
                                    className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer select-none transition ${
                                      isChecked ? "bg-purple-50 text-purple-950 font-semibold" : "text-slate-700 hover:bg-slate-50"
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => {
                                        if (isChecked) {
                                          setSelectedCategories(selectedCategories.filter(c => c !== cat));
                                        } else {
                                          setSelectedCategories([...selectedCategories, cat]);
                                        }
                                      }}
                                      className="accent-[#6804a1] h-3.5 w-3.5 rounded cursor-pointer"
                                    />
                                    <span className="truncate">{cat}</span>
                                  </label>
                                );
                              })
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-2.5 bg-slate-50 shrink-0">
              <button
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              
              {/* PDF Download Button */}
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={exportLoadingPdf || exportLoadingExcel || exportFetchingFilters}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-purple-900 bg-purple-100 hover:bg-purple-200/90 border border-purple-200/80 rounded-xl transition shadow-xs cursor-pointer disabled:opacity-50"
              >
                {exportLoadingPdf ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin text-xs"></i>
                    <span>Generating PDF...</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-file-pdf text-xs text-purple-700"></i>
                    <span>Download PDF</span>
                  </>
                )}
              </button>

              {/* Excel Download Button */}
              <button
                type="button"
                onClick={handleDownloadExcel}
                disabled={exportLoadingExcel || exportLoadingPdf || exportFetchingFilters}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-[#6804a1] hover:bg-[#530382] rounded-xl transition shadow-sm cursor-pointer disabled:opacity-50"
              >
                {exportLoadingExcel ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin text-xs"></i>
                    <span>Exporting Excel...</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-file-excel text-xs"></i>
                    <span>Download Excel</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

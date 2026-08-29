import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import DataTable from "../../components/DataTable";
import { getPriceListData, importPriceListData } from "../../api/priceListApi";
import { getPricingFormulas as getVariations } from "../../api/pricingFormulaApi";
import { getItemModels } from "../../api/itemModelApi";
import { usePermission } from "../../context/PermissionContext";
import ExcelJS from "exceljs";
import toast from "react-hot-toast";

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

const canUserViewColumn = (col, user) => {
  const allowedLandingTypes = col.landing_types && Array.isArray(col.landing_types) && col.landing_types.length > 0
    ? col.landing_types
    : ["All"];

  if (allowedLandingTypes.includes("All")) {
    return true;
  }

  let userLandingTypes = user?.landing_type;
  if (typeof userLandingTypes === "string") {
    try {
      userLandingTypes = JSON.parse(userLandingTypes);
    } catch (e) {
      userLandingTypes = [userLandingTypes];
    }
  }

  if (!userLandingTypes || !Array.isArray(userLandingTypes) || userLandingTypes.length === 0) {
    return true;
  }

  if (userLandingTypes.includes("All")) {
    return true;
  }

  return userLandingTypes.some(ult => allowedLandingTypes.includes(ult));
};

export default function PriceListData() {
  const { variationId } = useParams();
  const navigate = useNavigate();
  const { hasPermission, isAdmin } = usePermission();

  const canImportExport = isAdmin || hasPermission("price_list", "write") || hasPermission("price_list", "update");

  const [data, setData] = useState([]);
  const [dynamicColumns, setDynamicColumns] = useState([]);
  const [formatName, setFormatName] = useState("");
  const [variationBrands, setVariationBrands] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  // Brand filter state
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [brandSearchText, setBrandSearchText] = useState("");
  const [isBrandFilterOpen, setIsBrandFilterOpen] = useState(false);

  useEffect(() => {
    setSelectedBrands([]);
    setBrandSearchText("");
    setIsBrandFilterOpen(false);
  }, [variationId]);

  const uniqueBrands = useMemo(() => {
    const brands = new Set();
    data.forEach(row => {
      if (row.brand) {
        brands.add(row.brand.trim());
      }
    });
    return Array.from(brands).sort();
  }, [data]);

  const filteredData = useMemo(() => {
    return data.filter(row => {
      return selectedBrands.length === 0 || selectedBrands.includes(row.brand?.trim());
    });
  }, [data, selectedBrands]);

  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch (e) {
      return {};
    }
  }, []);

  const visibleDynamicColumns = useMemo(() => {
    return dynamicColumns.filter(col => canUserViewColumn(col, currentUser));
  }, [dynamicColumns, currentUser]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getPriceListData(variationId);
      if (res.data?.success) {
        setData(res.data.data || []);
        setFormatName(res.data.formatName || "Price List");

        // Save variation configurations
        const cols = res.data.columns || [];
        setDynamicColumns(cols);
      }
    } catch (err) {
      console.error("Failed to load price list:", err);
      const errMsg = err.response?.data?.message || "Failed to load price list data.";
      toast.error(errMsg);
      if (err.response?.status === 403) {
        navigate("/");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [variationId]);

  const columns = useMemo(() => {
    const cols = [
      {
        key: "product_code",
        label: "Product Code",
        render: (row) => <span className="font-mono font-semibold text-slate-500">{row.product_code}</span>
      },
      {
        key: "brand",
        label: "Brand",
        render: (row) => <span className="font-semibold text-slate-700">{row.brand || "—"}</span>
      },
      {
        key: "icat_name",
        label: "Product Category",
        render: (row) => <span>{row.icat_name || "—"}</span>
      },
      {
        key: "model_group_name",
        label: "Model Group Name",
        render: (row) => <span>{row.model_group_name || "—"}</span>
      },
      {
        key: "model_name",
        label: "Model Name",
        render: (row) => <span className="font-bold text-slate-900">{row.model_name || "—"}</span>
      }
    ];

    visibleDynamicColumns.forEach(c => {
      cols.push({
        key: c.column_name,
        label: c.column_name,
        render: (row) => {
          const val = row[c.column_name];
          if (val === undefined || val === null || val === '' || val === '-' || val === '—') return "0";
          return <span className="font-medium text-slate-800">{val}</span>;
        }
      });
    });

    cols.push({
      key: "updated_at",
      label: "Last Updated",
      render: (row) => {
        const rawDate = row.updated_at || row.timestamp;
        if (!rawDate) return <span className="text-slate-400 text-xs">—</span>;
        const dateObj = new Date(rawDate);
        if (isNaN(dateObj.getTime())) return <span className="text-slate-400 text-xs">—</span>;
        const formattedDate = dateObj.toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric"
        });
        const formattedTime = dateObj.toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true
        });
        return (
          <div className="flex flex-col text-xs text-slate-700 whitespace-nowrap">
            <span className="font-semibold">{formattedDate}</span>
            <span className="text-[11px] text-slate-500 font-mono">{formattedTime}</span>
          </div>
        );
      }
    });

    return cols;
  }, [visibleDynamicColumns]);

  const handleExportTemplate = async () => {
    if (!canImportExport) {
      toast.error("Access Denied. You do not have permission to export/import price lists.");
      return;
    }
    setExporting(true);
    const loadToastId = toast.loading("Generating template...");
    try {
      // 1. Fetch active variation data from endpoint to extract configured brands
      // Fetching again to ensure fresh metadata
      const varRes = await getPriceListData(variationId);
      if (!varRes.data?.success) {
        toast.error("Failed to fetch format config.", { id: loadToastId });
        return;
      }

      // Get the brands list from the model configuration
      const listRes = await getVariations();
      const currentVar = listRes.data?.data?.find(v => String(v.id) === String(variationId));

      if (!currentVar) {
        toast.error("Failed to locate variation configuration.", { id: loadToastId });
        return;
      }

      const configs = currentVar.brand_configs
        ? (typeof currentVar.brand_configs === 'string' ? JSON.parse(currentVar.brand_configs) : currentVar.brand_configs)
        : [];

      // 2. Fetch all models from Model Master
      const modelsRes = await getItemModels();
      const allModels = modelsRes.data?.data || [];

      // Filter active models (include all active product models)
      const activeModels = allModels.filter(m =>
        !m.item_status || String(m.item_status).toLowerCase() === "active"
      );

      if (activeModels.length === 0) {
        toast.error("No active product models found in database.", { id: loadToastId });
        return;
      }

      // 3. Generate the Excel workbook
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Price List");

      // 4. Columns configuration
      const fixedHeaders = [
        { header: "Product Code", key: "product_code", width: 18 },
        { header: "Brand", key: "brand", width: 15 },
        { header: "Product Category", key: "icat_name", width: 18 },
        { header: "Model Group Name", key: "model_group_name", width: 25 },
        { header: "Model Name", key: "model_name", width: 35 },
      ];

      const customHeaders = visibleDynamicColumns.map(col => ({
        header: col.column_name,
        key: col.column_name,
        width: 20
      }));

      worksheet.columns = [...fixedHeaders, ...customHeaders];

      // Style the header row
      const headerRow = worksheet.getRow(1);
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE9D5FF" }, // Light purple theme
        };
        cell.font = {
          name: "Segoe UI",
          size: 11,
          bold: true,
          color: { argb: "FF1E293B" },
        };
        cell.alignment = { vertical: "middle", horizontal: "center" };
      });
      headerRow.height = 25;

      // Filter active models to only include selected brands (if filter applied)
      const filteredActiveModels = activeModels.filter(m =>
        selectedBrands.length === 0 || selectedBrands.includes(m.brand_name?.trim())
      );

      // 5. Populate Rows for all active product models
      filteredActiveModels.forEach((m, index) => {
        const rowIndex = index + 2;
        const existingRow = data.find(r => r.product_code === m.item_code);

        const rowData = {
          product_code: m.item_code,
          brand: m.brand_name,
          icat_name: m.icat_name,
          model_group_name: m.model_group_name,
          model_name: m.model_name,
        };

        visibleDynamicColumns.forEach(col => {
          const isFormulaType = col.type === "default formulation" || col.type === "formulation";
          if (isFormulaType) {
            let formulaToUse = "";

            // Check brand configurations for specific formula override
            const matchingConfig = configs.find(cfg =>
              m.brand_name && cfg.brands && cfg.brands.map(b => String(b).trim().toUpperCase()).includes(String(m.brand_name).trim().toUpperCase())
            );
            if (matchingConfig) {
              const matchingColFormula = matchingConfig.columns?.find(c => c.column_id === col.column_id);
              if (matchingColFormula) {
                formulaToUse = matchingColFormula.formula;
              }
            }

            // Fallback to column default formula
            if (!formulaToUse) {
              formulaToUse = col.formula;
            }

            if (formulaToUse) {
              rowData[col.column_name] = {
                formula: mapFormulaForRow(formulaToUse, rowIndex)
              };
            } else {
              const existingVal = existingRow ? existingRow[col.column_name] : undefined;
              if (existingVal !== undefined && existingVal !== null && String(existingVal).trim() !== "" && String(existingVal).trim() !== "-") {
                const num = Number(existingVal);
                rowData[col.column_name] = !isNaN(num) && String(existingVal).trim() !== "" ? num : existingVal;
              } else {
                rowData[col.column_name] = 0;
              }
            }
          } else {
            // Include already filled data if present; otherwise default to '-'
            const existingVal = existingRow ? existingRow[col.column_name] : undefined;
            if (existingVal !== undefined && existingVal !== null && String(existingVal).trim() !== "" && String(existingVal).trim() !== "-") {
              const num = Number(existingVal);
              rowData[col.column_name] = !isNaN(num) && String(existingVal).trim() !== "" ? num : existingVal;
            } else {
              rowData[col.column_name] = 0;
            }
          }
        });

        worksheet.addRow(rowData);
      });

      // Add borders and formatting
      worksheet.eachRow({ includeHeader: false }, (row) => {
        row.eachCell({ includeEmpty: true }, (cell) => {
          cell.font = { name: "Segoe UI", size: 10 };
          cell.border = {
            top: { style: "thin", color: { argb: "FFE2E8F0" } },
            bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
            left: { style: "thin", color: { argb: "FFE2E8F0" } },
            right: { style: "thin", color: { argb: "FFE2E8F0" } },
          };
        });
      });

      // Trigger download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Price_List_${formatName.replace(/\s+/g, "_")}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);

      toast.success("Excel template downloaded successfully!", { id: loadToastId });
    } catch (err) {
      console.error("Export template error:", err);
      toast.error("Failed to generate Excel template.", { id: loadToastId });
    } finally {
      setExporting(false);
    }
  };

  const handleImportTemplate = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!canImportExport) {
      toast.error("Access Denied. You do not have permission to export/import price lists.");
      return;
    }

    setImporting(true);
    const loadToastId = toast.loading("Reading spreadsheet...");
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const arrayBuffer = event.target.result;
          const workbook = new ExcelJS.Workbook();
          await workbook.xlsx.load(arrayBuffer);
          const worksheet = workbook.getWorksheet(1);

          if (!worksheet) {
            toast.error("Invalid template: Worksheet not found.", { id: loadToastId });
            setImporting(false);
            return;
          }

          // 1. Parse header row
          const headerRow = worksheet.getRow(1);
          const colHeaders = [];
          const requiredFixed = ["Product Code", "Brand", "Product Category", "Model Group Name", "Model Name"];
          const maxCols = Math.max(worksheet.columnCount, requiredFixed.length + visibleDynamicColumns.length);
          for (let colNum = 1; colNum <= maxCols; colNum++) {
            const cellVal = headerRow.getCell(colNum).value;
            colHeaders[colNum] = cellVal ? String(cellVal).trim() : "";
          }

          // Verify fixed columns
          for (let i = 0; i < requiredFixed.length; i++) {
            if (colHeaders[i + 1] !== requiredFixed[i]) {
              toast.error(`Invalid format: Column ${i + 1} must be "${requiredFixed[i]}"`, { id: loadToastId });
              setImporting(false);
              return;
            }
          }

          // Verify dynamic columns
          const customColNames = visibleDynamicColumns.map(c => c.column_name.trim());
          for (let i = 0; i < customColNames.length; i++) {
            const expectedHeader = customColNames[i];
            const actualHeader = colHeaders[i + 1 + requiredFixed.length];
            if (actualHeader !== expectedHeader) {
              toast.error(`Invalid format: Column ${i + 1 + requiredFixed.length} must be "${expectedHeader}"`, { id: loadToastId });
              setImporting(false);
              return;
            }
          }

          // 2. Parse data rows
          const records = [];
          const getVal = (row, colIdx) => {
            const cell = row.getCell(colIdx);
            if (!cell) return "";
            const val = cell.value;
            if (val === null || val === undefined) {
              return "";
            }
            if (typeof val === 'object') {
              // 1. Check if it is a formula object
              if ('result' in val) {
                const res = val.result;
                if (res === null || res === undefined) {
                  return "";
                }
                if (typeof res === 'object') {
                  if ('error' in res) return "";
                  return "";
                }
                return res;
              }
              // 2. Formula object without evaluated result
              if ('formula' in val) {
                return "";
              }
              // 3. Rich text cell
              if (Array.isArray(val.richText)) {
                return val.richText.map(t => t.text || "").join("");
              }
              // 4. Error cell
              if ('error' in val) {
                return "";
              }
              return "";
            }
            return val;
          };

          worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
            if (rowNumber === 1) return; // Skip headers!

            const product_code = getVal(row, 1);
            if (!product_code) return; // skip empty rows

            const rawProductCode = String(product_code).trim();
            if (rawProductCode.toLowerCase() === "product code" || rawProductCode.toLowerCase() === "item code") {
              return; // safety
            }

            const record = {
              product_code: rawProductCode,
              brand: row.getCell(2).value ? String(row.getCell(2).value).trim() : "",
              icat_name: row.getCell(3).value ? String(row.getCell(3).value).trim() : "",
              model_group_name: row.getCell(4).value ? String(row.getCell(4).value).trim() : "",
              model_name: row.getCell(5).value ? String(row.getCell(5).value).trim() : "",
            };

            visibleDynamicColumns.forEach((col, idx) => {
              const colIdx = 1 + requiredFixed.length + idx;
              const cellVal = getVal(row, colIdx);
              const strVal = cellVal !== undefined && cellVal !== null ? String(cellVal).trim() : "";
              if (strVal === "-" || strVal === "") {
                record[col.column_name] = "";
              } else {
                record[col.column_name] = strVal;
              }
            });

            records.push(record);
          });

          if (records.length === 0) {
            toast.error("No valid data rows found in the sheet.", { id: loadToastId });
            setImporting(false);
            return;
          }

          // 3. Upload parsed records
          toast.loading(`Importing ${records.length} records...`, { id: loadToastId });
          const res = await importPriceListData(variationId, records);
          if (res.data?.success) {
            toast.success(res.data.message || `Successfully imported ${records.length} records!`, { id: loadToastId });
            await loadData();
          } else {
            toast.error(res.data?.message || "Failed to import records.", { id: loadToastId });
          }
        } catch (err) {
          console.error("Excel parse error:", err);
          toast.error("Failed to parse the Excel file.", { id: loadToastId });
        } finally {
          setImporting(false);
        }
      };

      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error("File read error:", err);
      toast.error("Failed to read the file.", { id: loadToastId });
      setImporting(false);
    } finally {
      e.target.value = "";
    }
  };

  return (
    <div className="flex flex-col flex-1 bg-slate-50 font-sans">
      <Navbar title="Price List Master" />

      <main className="flex-1 flex flex-col w-full mx-auto px-[30px] py-8">
        <DataTable
          tableId={`price_list_format_${variationId}`}
          title={`${formatName} - Price List`}
          data={filteredData}
          columns={columns}
          loading={loading}
          searchPlaceholder="Search products or prices..."
          actionButton={
            <div className="flex items-center gap-3">
              {/* Brand Multi-select Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setIsBrandFilterOpen(!isBrandFilterOpen);
                  }}
                  className="flex items-center justify-between gap-2 h-9 px-3 rounded-[9px] border border-slate-300 bg-white hover:border-slate-400 text-xs font-semibold shadow-xs transition-colors duration-150 cursor-pointer focus:outline-none"
                >
                  <span className="text-slate-700">
                    {selectedBrands.length === 0
                      ? "All Brands"
                      : `${selectedBrands.length} Brand${selectedBrands.length > 1 ? 's' : ''}`}
                  </span>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3 text-slate-400">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>

                {isBrandFilterOpen && (
                  <>
                    <div className="fixed inset-0 z-45" onClick={() => setIsBrandFilterOpen(false)}></div>
                    <div className="absolute right-0 mt-1 w-64 rounded-xl border border-slate-200 bg-white shadow-xl py-2 z-50 flex flex-col text-left">
                      <div className="px-3 py-1.5 border-b border-slate-100 flex items-center gap-1.5">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5 text-slate-400">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.602 10.602Z" />
                        </svg>
                        <input
                          type="text"
                          placeholder="Search brands..."
                          value={brandSearchText}
                          onChange={(e) => setBrandSearchText(e.target.value)}
                          className="w-full text-xs border-none outline-none bg-transparent"
                        />
                      </div>
                      <div className="px-2 py-1 border-b border-slate-100 flex items-center justify-between text-[11px] font-bold text-indigo-650">
                        <button
                          type="button"
                          onClick={() => setSelectedBrands(uniqueBrands)}
                          className="bg-transparent border-none cursor-pointer hover:underline text-indigo-600 font-semibold"
                        >
                          Select All
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedBrands([])}
                          className="bg-transparent border-none cursor-pointer hover:underline text-indigo-600 font-semibold"
                        >
                          Deselect All
                        </button>
                      </div>
                      <div className="max-h-48 overflow-y-auto px-1 py-1 space-y-0.5">
                        {uniqueBrands
                          .filter(b => b.toLowerCase().includes(brandSearchText.toLowerCase()))
                          .map(brand => {
                            const isChecked = selectedBrands.includes(brand);
                            return (
                              <label key={brand} className="flex items-center gap-2 px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50 rounded-lg cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    if (isChecked) {
                                      setSelectedBrands(selectedBrands.filter(name => name !== brand));
                                    } else {
                                      setSelectedBrands([...selectedBrands, brand]);
                                    }
                                  }}
                                  className="accent-[#6804a1] h-3.5 w-3.5 flex-shrink-0"
                                />
                                <span className="truncate">{brand}</span>
                              </label>
                            );
                          })}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {canImportExport && (
                <>
                  <button
                    onClick={handleExportTemplate}
                    disabled={exporting || loading}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-[9px] text-white border-none cursor-pointer font-semibold text-[13px] bg-gradient-to-br from-indigo-600 to-indigo-700 shadow-[0_2px_8px_rgba(104,4,161,0.35)] disabled:bg-slate-400 disabled:cursor-not-allowed disabled:shadow-none hover:opacity-95 transition-all"
                    title="Download Excel Template"
                  >
                    <i className="fa-solid fa-file-export text-xs"></i>
                    {exporting ? "Generating..." : "Export Template"}
                  </button>

                  <label
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-[9px] text-emerald-700 border border-emerald-200 cursor-pointer font-semibold text-[13px] bg-emerald-50 hover:bg-emerald-100/70 transition-all ${importing || loading ? "opacity-50 cursor-not-allowed" : ""}`}
                    title="Upload filled Excel sheet"
                  >
                    <i className="fa-solid fa-file-import text-xs"></i>
                    {importing ? "Importing..." : "Import Template"}
                    <input
                      type="file"
                      accept=".xlsx"
                      onChange={handleImportTemplate}
                      disabled={importing || loading}
                      className="hidden"
                    />
                  </label>
                </>
              )}
            </div>
          }
        />
      </main>
    </div>
  );
}

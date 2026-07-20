import { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import Navbar from "../../components/Navbar";
import DataTable from "../../components/DataTable";
import { getPriceListData, importPriceListData } from "../../api/priceListApi";
import { getPricingFormulas as getVariations } from "../../api/pricingFormulaApi";
import { getItemModels } from "../../api/itemModelApi";
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

export default function PriceListData() {
  const { variationId } = useParams();
  const [data, setData] = useState([]);
  const [dynamicColumns, setDynamicColumns] = useState([]);
  const [formatName, setFormatName] = useState("");
  const [variationBrands, setVariationBrands] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

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
      toast.error("Failed to load price list data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [variationId]);

  // Load variation details to get brand configurations for filtering during export
  useEffect(() => {
    const fetchVariationDetails = async () => {
      try {
        const res = await getPriceListData(variationId);
        if (res.data?.success) {
          // In order to get the brand list, we can fetch from backend details.
          // Since the first API returns variation metadata we can extract brands from brand_configs
          const resMeta = await getPriceListData(variationId);
          // Wait, we need the exact brand configs from variation rule. Let's do another request or parse from first res.
        }
      } catch (err) {
        console.error("Failed to fetch variation details:", err);
      }
    };
    fetchVariationDetails();
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
        label: "Icat Name",
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

    dynamicColumns.forEach(c => {
      cols.push({
        key: c.column_name,
        label: c.column_name,
        render: (row) => {
          const val = row[c.column_name];
          if (val === undefined || val === null || val === '') return "—";
          return <span className="font-medium text-slate-800">{val}</span>;
        }
      });
    });

    return cols;
  }, [dynamicColumns]);

  const handleExportTemplate = async () => {
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

      const brandsList = [];
      configs.forEach(cfg => {
        if (Array.isArray(cfg.brands)) {
          cfg.brands.forEach(b => {
            if (b && !brandsList.includes(b)) {
              brandsList.push(b);
            }
          });
        }
      });

      if (brandsList.length === 0) {
        toast.error("No brands are configured for this pricing formula master format.", { id: loadToastId });
        return;
      }

      const upperBrands = brandsList.map(b => String(b).trim().toUpperCase());

      // 2. Fetch all models from Model Master
      const modelsRes = await getItemModels();
      const allModels = modelsRes.data?.data || [];

      // 3. Filter models by configured brands
      const filteredModels = allModels.filter(m => 
        m.brand_name && upperBrands.includes(m.brand_name.trim().toUpperCase())
      );

      if (filteredModels.length === 0) {
        toast.error(`No product models found in database for brands: ${brandsList.join(", ")}`, { id: loadToastId });
        return;
      }

      // 4. Generate the Excel workbook
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Price List");

      // 5. Columns configuration
      const fixedHeaders = [
        { header: "Product Code", key: "product_code", width: 18 },
        { header: "Brand", key: "brand", width: 15 },
        { header: "Icat Name", key: "icat_name", width: 18 },
        { header: "Model Group Name", key: "model_group_name", width: 25 },
        { header: "Model Name", key: "model_name", width: 35 },
      ];

      const customHeaders = dynamicColumns.map(col => ({
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
          fgColor: { argb: "FF6804A1" }, // Purple theme
        };
        cell.font = {
          name: "Segoe UI",
          size: 11,
          bold: true,
          color: { argb: "FFFFFFFF" },
        };
        cell.alignment = { vertical: "middle", horizontal: "center" };
      });
      headerRow.height = 25;

      // 6. Populate Rows
      filteredModels.forEach((m, index) => {
        const rowIndex = index + 2;
        const existingRow = data.find(r => r.product_code === m.item_code);

        const rowData = {
          product_code: m.item_code,
          brand: m.brand_name,
          icat_name: m.icat_name,
          model_group_name: m.model_group_name,
          model_name: m.model_name,
        };

        dynamicColumns.forEach(col => {
          const isFormulaType = col.type === "default formulation" || col.type === "formulation";
          if (isFormulaType) {
            let formulaToUse = "";
            
            // Check brand configurations for specific formula
            const matchingConfig = configs.find(cfg => 
              cfg.brands && cfg.brands.map(b => b.trim().toUpperCase()).includes(m.brand_name.trim().toUpperCase())
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
              rowData[col.column_name] = "";
            }
          } else {
            // Pre-fill existing user inputs if already imported
            rowData[col.column_name] = existingRow && existingRow[col.column_name] !== undefined && existingRow[col.column_name] !== null
              ? (isNaN(Number(existingRow[col.column_name])) ? existingRow[col.column_name] : Number(existingRow[col.column_name]))
              : "";
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
          const requiredFixed = ["Product Code", "Brand", "Icat Name", "Model Group Name", "Model Name"];
          const maxCols = Math.max(worksheet.columnCount, requiredFixed.length + dynamicColumns.length);
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
          const customColNames = dynamicColumns.map(c => c.column_name.trim());
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

            dynamicColumns.forEach((col, idx) => {
              const colIdx = 1 + requiredFixed.length + idx;
              const cellVal = getVal(row, colIdx);
              record[col.column_name] = cellVal !== undefined && cellVal !== null ? String(cellVal).trim() : "";
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
          data={data}
          columns={columns}
          loading={loading}
          searchPlaceholder="Search products or prices..."
          actionButton={
            <div className="flex items-center gap-3">
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
            </div>
          }
        />
      </main>
    </div>
  );
}

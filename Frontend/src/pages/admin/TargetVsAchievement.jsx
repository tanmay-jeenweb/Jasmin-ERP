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
          searchPlaceholder="Search target or achievement..."
          actionButton={
            <div className="flex flex-wrap items-center gap-3">
              {/* Date selector for manual sync override */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-lg px-2 h-10">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Sync Date:</span>
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
                disabled={syncing || exporting || importing}
                className="flex items-center gap-2 h-10 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-md transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border-none focus:outline-none"
                title="Sync Achievements from External API"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                {syncing ? "Syncing..." : "Sync Achievements"}
              </button>

              <button
                onClick={handleExport}
                disabled={exporting || syncing || importing}
                className="flex items-center gap-2 h-10 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-md transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border-none focus:outline-none"
                title="Export Excel Template"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" className={`w-4 h-4 ${exporting ? 'animate-bounce' : ''}`}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                {exporting ? "Exporting..." : "Export"}
              </button>

              <button
                onClick={() => fileInputRef.current.click()}
                disabled={importing || exporting || syncing}
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

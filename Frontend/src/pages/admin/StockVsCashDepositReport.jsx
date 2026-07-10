import { useEffect, useState, useMemo } from "react";
import Navbar from "../../components/Navbar";
import { 
  getStockCashDepositReport, 
  importStockCashDepositReport,
  importCurrentStockReport,
  importOpeningCashAndCreditReport,
  importCashDepositReport
} from "../../api/stockCashDepositApi";
import DataTable from "../../components/DataTable";
import * as XLSX from "xlsx-js-style";
import toast from "react-hot-toast";

export default function StockVsCashDepositReport() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await getStockCashDepositReport();
      setData(response.data.data || []);
    } catch (err) {
      console.error("Failed to load Stock vs Cash Deposit data", err);
      setError("Unable to load Stock vs Cash Deposit data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Calculate totals
  const totals = useMemo(() => {
    const t = {
      stock_deposit: 0,
      support: 0,
      paid_support: 0,
      total_stock_invest: 0,
      current_stock: 0,
      opening_cash_deposit_pending: 0,
      cash_deposit: 0,
      pending_cash_deposit: 0,
      credit_debit: 0,
      available_limit: 0
    };

    data.forEach(r => {
      t.stock_deposit += Number(r.stock_deposit || 0);
      t.support += Number(r.support || 0);
      t.paid_support += Number(r.paid_support || 0);
      t.total_stock_invest += Number(r.total_stock_invest || 0);
      t.current_stock += Number(r.current_stock || 0);
      t.opening_cash_deposit_pending += Number(r.opening_cash_deposit_pending || 0);
      t.cash_deposit += Number(r.cash_deposit || 0);
      t.pending_cash_deposit += Number(r.pending_cash_deposit || 0);
      t.credit_debit += Number(r.credit_debit || 0);
      t.available_limit += Number(r.available_limit || 0);
    });

    return t;
  }, [data]);

  // Export Template for Stock/Support/Paid Support
  const handleExportTemplate = async () => {
    setExporting(true);
    try {
      if (data.length === 0) {
        toast.error("No data available to export template");
        setExporting(false);
        return;
      }

      const monthName = new Date().toLocaleString('en-US', { month: 'long' });

      const dataToExport = data.map((row) => ({
        "Month": monthName,
        "ID": row.id,
        "Branch Name": row.branch_name || "",
        "State": row.state_name || "",
        "City/Town": row.city || "",
        "ABM NAME": row.abm_name || "",
        "Store Type": row.store_type ? row.store_type.charAt(0).toUpperCase() + row.store_type.slice(1) : "",
        "Status": row.status ? row.status.charAt(0).toUpperCase() + row.status.slice(1) : "",
        "Stock Invest": row.stock_deposit || 0.00,
        "Support": row.support || 0.00,
        "Paid Support": row.paid_support || 0.00
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

      // Styles
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
        }
      }

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
      XLSX.writeFile(workbook, "Stock_vs_Cash_Deposit_Template.xlsx");

      toast.success("Excel template exported successfully!");
    } catch (err) {
      console.error("Failed to export Excel template:", err);
      toast.error("Failed to export Excel template. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  // Export Template for Current Stock
  const handleExportCurrentStockTemplate = async () => {
    setExporting(true);
    try {
      if (data.length === 0) {
        toast.error("No data available to export template");
        setExporting(false);
        return;
      }

      const monthName = new Date().toLocaleString('en-US', { month: 'long' });

      const dataToExport = data.map((row) => ({
        "Month": monthName,
        "ID": row.id,
        "Branch Name": row.branch_name || "",
        "ABM NAME": row.abm_name || "",
        "Current. Stock with Tax (GST DP)": row.current_stock || 0.00
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

      // Styles
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
        }
      }

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
      XLSX.writeFile(workbook, "Current_Stock_Template.xlsx");

      toast.success("Current Stock template exported successfully!");
    } catch (err) {
      console.error("Failed to export Current Stock template:", err);
      toast.error("Failed to export Current Stock template. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  // Export Template for Opening Cash & Credit/Debit
  const handleExportOpeningCashAndCreditTemplate = async () => {
    setExporting(true);
    try {
      if (data.length === 0) {
        toast.error("No data available to export template");
        setExporting(false);
        return;
      }

      const monthName = new Date().toLocaleString('en-US', { month: 'long' });

      const dataToExport = data.map((row) => ({
        "Month": monthName,
        "ID": row.id,
        "Branch Name": row.branch_name || "",
        "ABM NAME": row.abm_name || "",
        "Opening Cash": row.opening_cash_deposit_pending || 0.00,
        "Credit/Debit": row.credit_debit || 0.00
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

      // Styles
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
        }
      }

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
      XLSX.writeFile(workbook, "Opening_Cash_And_Credit_Template.xlsx");

      toast.success("Opening Cash & Credit template exported successfully!");
    } catch (err) {
      console.error("Failed to export template:", err);
      toast.error("Failed to export template. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  // Export Template for Cash Deposit
  const handleExportCashDepositTemplate = async () => {
    setExporting(true);
    try {
      if (data.length === 0) {
        toast.error("No data available to export template");
        setExporting(false);
        return;
      }

      const monthName = new Date().toLocaleString('en-US', { month: 'long' });

      // Match user screenshot exactly
      const dataToExport = data.map((row) => ({
        "Month": monthName,
        "ID": row.id,
        "Branch Name": row.branch_name || "",
        "ABM NAME": row.abm_name || "",
        "Cash Deposit Pending": row.cash_deposit || 0.00
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

      // Styles
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
        }
      }

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
      XLSX.writeFile(workbook, "Cash_Deposit_Template.xlsx");

      toast.success("Cash Deposit template exported successfully!");
    } catch (err) {
      console.error("Failed to export template:", err);
      toast.error("Failed to export template. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  // Export Full Report (including calculated columns and totals row)
  const handleExportFullReport = async () => {
    setExporting(true);
    try {
      if (data.length === 0) {
        toast.error("No data available to export");
        setExporting(false);
        return;
      }

      const dataToExport = data.map((row, index) => ({
        "Sr. No": index + 1,
        "Branch Name": row.branch_name || "",
        "State": row.state_name || "",
        "City": row.city || "",
        "ABM Name": row.abm_name || "",
        "Store Type": row.store_type ? row.store_type.toUpperCase() : "",
        "Status": row.status ? row.status.toUpperCase() : "",
        "Stock Deposit": row.stock_deposit,
        "Support": row.support,
        "Paid Support": row.paid_support,
        "Total Stock Invest": row.total_stock_invest,
        "Current Stock": row.current_stock,
        "Opening Cash Deposit Pending": row.opening_cash_deposit_pending,
        "Cash Deposit": row.cash_deposit,
        "Pending Cash Deposit": row.pending_cash_deposit,
        "Credit / Debit": row.credit_debit,
        "Available Limit with Cash Deposit": row.available_limit
      }));

      // Calculate totals
      const totalsRow = {
        "Sr. No": "Total",
        "Branch Name": "",
        "State": "",
        "City": "",
        "ABM Name": "",
        "Store Type": "",
        "Status": "",
        "Stock Deposit": totals.stock_deposit,
        "Support": totals.support,
        "Paid Support": totals.paid_support,
        "Total Stock Invest": totals.total_stock_invest,
        "Current Stock": totals.current_stock,
        "Opening Cash Deposit Pending": totals.opening_cash_deposit_pending,
        "Cash Deposit": totals.cash_deposit,
        "Pending Cash Deposit": totals.pending_cash_deposit,
        "Credit / Debit": totals.credit_debit,
        "Available Limit with Cash Deposit": totals.available_limit,
      };

      dataToExport.push(totalsRow);

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

      // Styles
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

          // Total row styling (last row)
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
      XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
      XLSX.writeFile(workbook, "Stock_vs_Cash_Deposit_Report.xlsx");

      toast.success("Excel report exported successfully!");
    } catch (err) {
      console.error("Failed to export Excel report:", err);
      toast.error("Failed to export Excel report. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const handleImport = (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawData = XLSX.utils.sheet_to_json(ws);

        if (rawData.length === 0) {
          toast.error("The selected sheet is empty.");
          setImporting(false);
          return;
        }

        const firstRow = rawData[0];
        const keys = Object.keys(firstRow);

        // Find ID column
        const idKey = keys.find(k => k.toLowerCase() === 'id' || k.toLowerCase().includes('branch id'));
        if (!idKey) {
          toast.error("Could not find 'ID' column in the uploaded file.");
          setImporting(false);
          return;
        }

        if (type === 'current_stock') {
          // Find Current Stock column
          const currentStockKey = keys.find(k => 
            k.toLowerCase().includes('current. stock') || 
            k.toLowerCase().includes('current stock') || 
            k.toLowerCase().includes('gst dp')
          );

          if (!currentStockKey) {
            toast.error("Could not find 'Current. Stock with Tax (GST DP)' column in the file.");
            setImporting(false);
            return;
          }

          const records = rawData
            .map(row => {
              const branchId = parseInt(row[idKey]);
              if (isNaN(branchId)) return null;

              return {
                branch_id: branchId,
                current_stock: parseFloat(row[currentStockKey]) || 0.00
              };
            })
            .filter(r => r !== null);

          if (records.length === 0) {
            toast.error("No valid branch records found in the Excel file.");
            setImporting(false);
            return;
          }

          const res = await importCurrentStockReport(records);
          if (res.data.success) {
            toast.success("Current Stock data imported successfully!");
            loadData();
          } else {
            toast.error(res.data.message || "Failed to import Current Stock data.");
          }
        } else if (type === 'opening_credit') {
          // Find columns: "Opening Cash", "Credit/Debit"
          const openingCashKey = keys.find(k => 
            k.toLowerCase().includes('opening cash') || 
            k.toLowerCase().includes('opening_cash')
          );
          const creditDebitKey = keys.find(k => 
            k.toLowerCase().includes('credit/debit') || 
            k.toLowerCase().includes('credit_debit') ||
            k.toLowerCase().includes('credit')
          );

          if (!openingCashKey && !creditDebitKey) {
            toast.error("Could not find 'Opening Cash' or 'Credit/Debit' column in the file.");
            setImporting(false);
            return;
          }

          const records = rawData
            .map(row => {
              const branchId = parseInt(row[idKey]);
              if (isNaN(branchId)) return null;

              return {
                branch_id: branchId,
                opening_cash_deposit_pending: openingCashKey ? parseFloat(row[openingCashKey]) || 0.00 : 0.00,
                credit_debit: creditDebitKey ? parseFloat(row[creditDebitKey]) || 0.00 : 0.00
              };
            })
            .filter(r => r !== null);

          if (records.length === 0) {
            toast.error("No valid branch records found in the Excel file.");
            setImporting(false);
            return;
          }

          const res = await importOpeningCashAndCreditReport(records);
          if (res.data.success) {
            toast.success("Opening Cash & Credit data imported successfully!");
            loadData();
          } else {
            toast.error(res.data.message || "Failed to import Opening Cash & Credit data.");
          }
        } else if (type === 'cash_deposit') {
          // Find columns: "Cash Deposit Pending" or "Cash Deposit"
          const cashDepositKey = keys.find(k => 
            k.toLowerCase().includes('cash deposit') || 
            k.toLowerCase().includes('cash_deposit')
          );

          if (!cashDepositKey) {
            toast.error("Could not find 'Cash Deposit Pending' column in the file.");
            setImporting(false);
            return;
          }

          const records = rawData
            .map(row => {
              const branchId = parseInt(row[idKey]);
              if (isNaN(branchId)) return null;

              return {
                branch_id: branchId,
                cash_deposit: parseFloat(row[cashDepositKey]) || 0.00
              };
            })
            .filter(r => r !== null);

          if (records.length === 0) {
            toast.error("No valid branch records found in the Excel file.");
            setImporting(false);
            return;
          }

          const res = await importCashDepositReport(records);
          if (res.data.success) {
            toast.success("Cash Deposit data imported successfully!");
            loadData();
          } else {
            toast.error(res.data.message || "Failed to import Cash Deposit data.");
          }
        } else {
          // Stock & Support
          const stockKey = keys.find(k => 
            k.toLowerCase().includes('stock invest') || 
            k.toLowerCase().includes('stock deposit') || 
            k.toLowerCase().startsWith('stock inve') ||
            k.toLowerCase().startsWith('stock depo')
          );

          const supportKey = keys.find(k => k.toLowerCase() === 'support' || k.toLowerCase().includes('support'));
          const paidSupportKey = keys.find(k => k.toLowerCase().includes('paid support'));

          const records = rawData
            .map(row => {
              const branchId = parseInt(row[idKey]);
              if (isNaN(branchId)) return null;

              return {
                branch_id: branchId,
                stock_deposit: stockKey ? parseFloat(row[stockKey]) || 0.00 : 0.00,
                support: supportKey ? parseFloat(row[supportKey]) || 0.00 : 0.00,
                paid_support: paidSupportKey ? parseFloat(row[paidSupportKey]) || 0.00 : 0.00
              };
            })
            .filter(r => r !== null);

          if (records.length === 0) {
            toast.error("No valid branch records found.");
            setImporting(false);
            return;
          }

          const res = await importStockCashDepositReport(records);
          if (res.data.success) {
            toast.success("Stock & Support data imported successfully!");
            loadData();
          } else {
            toast.error(res.data.message || "Failed to import Stock & Support data.");
          }
        }
      } catch (err) {
        console.error("Failed to parse or import Excel:", err);
        toast.error("Failed to import Excel. Make sure the format is correct.");
      } finally {
        setImporting(false);
        e.target.value = "";
      }
    };

    reader.onerror = () => {
      toast.error("Error reading the Excel file.");
      setImporting(false);
    };

    reader.readAsBinaryString(file);
  };

  const formatVal = (val) => {
    if (val === null || val === undefined) return "0.00";
    return Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Add the "Total" row directly to the formatted data array
  const formattedData = useMemo(() => {
    const base = data.map((item, index) => ({
      ...item,
      sr_no: index + 1
    }));

    if (base.length === 0) return [];

    const totalRow = {
      id: "Total",
      sr_no: "",
      branch_name: "Total",
      state_name: "",
      city: "",
      abm_name: "",
      store_type: "",
      status: "",
      stock_deposit: totals.stock_deposit,
      support: totals.support,
      paid_support: totals.paid_support,
      total_stock_invest: totals.total_stock_invest,
      current_stock: totals.current_stock,
      opening_cash_deposit_pending: totals.opening_cash_deposit_pending,
      cash_deposit: totals.cash_deposit,
      pending_cash_deposit: totals.pending_cash_deposit,
      credit_debit: totals.credit_debit,
      available_limit: totals.available_limit
    };

    return [...base, totalRow];
  }, [data, totals]);

  const columns = useMemo(() => [
    {
      key: "sr_no",
      label: "Sr. No",
      minWidth: "70px",
      render: (row) => <span className={`font-semibold ${row.id === "Total" ? "text-slate-900 font-bold" : "text-slate-500"}`}>{row.sr_no}</span>
    },
    {
      key: "branch_name",
      label: "Branch Name",
      minWidth: "150px",
      render: (row) => <span className={row.id === "Total" ? "font-bold text-slate-900" : "font-bold text-slate-800"}>{row.branch_name || "—"}</span>
    },
    {
      key: "state_name",
      label: "State",
      minWidth: "120px",
      render: (row) => <span className={row.id === "Total" ? "font-bold text-slate-900" : "font-semibold text-slate-700"}>{row.state_name || "—"}</span>
    },
    {
      key: "city",
      label: "City",
      minWidth: "120px",
      render: (row) => <span className={row.id === "Total" ? "font-bold text-slate-900" : "text-slate-700"}>{row.city || "—"}</span>
    },
    {
      key: "abm_name",
      label: "ABM Name",
      minWidth: "150px",
      render: (row) => <span className={row.id === "Total" ? "font-bold text-slate-900" : "font-semibold text-indigo-700"}>{row.abm_name || "—"}</span>
    },
    {
      key: "store_type",
      label: "Store Type",
      minWidth: "110px",
      render: (row) => {
        if (row.id === "Total") return "";
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
            row.store_type === 'branch' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-orange-50 text-orange-700 border border-orange-200'
          }`}>
            {row.store_type ? row.store_type.toUpperCase() : "—"}
          </span>
        );
      }
    },
    {
      key: "status",
      label: "Status",
      minWidth: "100px",
      render: (row) => {
        if (row.id === "Total") return "";
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
            row.status === 'active' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {row.status ? row.status.toUpperCase() : "—"}
          </span>
        );
      }
    },
    {
      key: "stock_deposit",
      label: "Stock Deposit",
      minWidth: "130px",
      render: (row) => <span className={row.id === "Total" ? "font-bold text-slate-900 text-sm" : "font-medium text-slate-700"}>{formatVal(row.stock_deposit)}</span>
    },
    {
      key: "support",
      label: "Support",
      minWidth: "120px",
      render: (row) => <span className={row.id === "Total" ? "font-bold text-slate-900 text-sm" : "font-medium text-slate-700"}>{formatVal(row.support)}</span>
    },
    {
      key: "paid_support",
      label: "Paid Support",
      minWidth: "130px",
      render: (row) => <span className={row.id === "Total" ? "font-bold text-slate-900 text-sm" : "font-medium text-slate-700"}>{formatVal(row.paid_support)}</span>
    },
    {
      key: "total_stock_invest",
      label: "Total Stock Invest",
      minWidth: "150px",
      render: (row) => <span className={row.id === "Total" ? "font-extrabold text-blue-900 text-sm" : "font-bold text-blue-700"}>{formatVal(row.total_stock_invest)}</span>
    },
    {
      key: "current_stock",
      label: "Current Stock",
      minWidth: "130px",
      render: (row) => <span className={row.id === "Total" ? "font-bold text-slate-900 text-sm" : "font-medium text-slate-700"}>{formatVal(row.current_stock)}</span>
    },
    {
      key: "opening_cash_deposit_pending",
      label: "Opening Cash Deposit Pending",
      minWidth: "220px",
      render: (row) => <span className={row.id === "Total" ? "font-bold text-slate-900 text-sm" : "font-medium text-slate-700"}>{formatVal(row.opening_cash_deposit_pending)}</span>
    },
    {
      key: "cash_deposit",
      label: "Cash Deposit",
      minWidth: "130px",
      render: (row) => <span className={row.id === "Total" ? "font-bold text-slate-900 text-sm" : "font-medium text-slate-700"}>{formatVal(row.cash_deposit)}</span>
    },
    {
      key: "pending_cash_deposit",
      label: "Pending Cash Deposit",
      minWidth: "170px",
      render: (row) => <span className={row.id === "Total" ? "font-extrabold text-amber-900 text-sm" : "font-semibold text-amber-700"}>{formatVal(row.pending_cash_deposit)}</span>
    },
    {
      key: "credit_debit",
      label: "Credit / Debit",
      minWidth: "130px",
      render: (row) => <span className={row.id === "Total" ? "font-bold text-slate-900 text-sm" : "font-medium text-slate-700"}>{formatVal(row.credit_debit)}</span>
    },
    {
      key: "available_limit",
      label: "Available Limit with Cash Deposit",
      minWidth: "240px",
      render: (row) => <span className={row.id === "Total" ? "font-extrabold text-emerald-900 text-sm" : "font-bold text-emerald-700"}>{formatVal(row.available_limit)}</span>
    }
  ], [totals]);

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, background: "#f8fafc", fontFamily: "'Inter',sans-serif" }}>
      <Navbar title="ERP Admin" />

      <main style={{ flex: 1, display: "flex", flexDirection: "column", width: "100%", margin: "0 auto", padding: "32px 30px" }}>
        {error && (
          <div style={{ background: "#fff1f2", border: "1px solid #fecdd3", color: "#be123c", padding: "12px 16px", borderRadius: 10, marginBottom: 20, fontSize: 14, fontWeight: 500 }}>
            {error}
          </div>
        )}

        <DataTable
          tableId="stock_vs_cash_deposit_report"
          title="Stock vs Cash Deposit Report"
          data={formattedData}
          columns={columns}
          loading={loading}
          searchPlaceholder="Search branch, state or city..."
          actionButton={
            <div className="relative inline-block text-left">
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-2 h-10 px-4 rounded-lg bg-[#6804a1] hover:bg-[#520380] text-white text-sm font-semibold shadow-md transition-all duration-200 cursor-pointer border-none focus:outline-none"
              >
                <i className="fa-solid fa-file-excel text-base"></i>
                Import / Export
                <i className={`fa-solid fa-chevron-down text-xs transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}></i>
              </button>

              {isDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40 cursor-default" 
                    onClick={() => setIsDropdownOpen(false)}
                  ></div>

                  <div className="absolute right-0 mt-2 w-[340px] rounded-xl border border-slate-200 bg-white shadow-xl py-3 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="px-4 py-1 text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Stock & Support</div>
                    <div className="grid grid-cols-2 gap-2 px-4 mb-3">
                      <button
                        onClick={() => {
                          setIsDropdownOpen(false);
                          handleExportTemplate();
                        }}
                        disabled={exporting}
                        className="flex items-center justify-center gap-1.5 py-1.5 text-xs text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 cursor-pointer font-semibold transition-colors duration-150 focus:outline-none disabled:opacity-50"
                      >
                        <i className="fa-solid fa-download text-emerald-600"></i>
                        Export Template
                      </button>
                      <label className="flex items-center justify-center gap-1.5 py-1.5 text-xs text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 cursor-pointer font-semibold transition-colors duration-150 disabled:opacity-50">
                        <i className="fa-solid fa-upload text-emerald-600"></i>
                        Import Excel
                        <input
                          type="file"
                          accept=".xlsx, .xls"
                          onChange={(e) => handleImport(e, 'stock')}
                          disabled={importing}
                          className="hidden"
                        />
                      </label>
                    </div>
                    
                    <div className="border-t border-slate-100 mb-2.5"></div>
                    <div className="px-4 py-1 text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Current Stock</div>
                    <div className="grid grid-cols-2 gap-2 px-4 mb-3">
                      <button
                        onClick={() => {
                          setIsDropdownOpen(false);
                          handleExportCurrentStockTemplate();
                        }}
                        disabled={exporting}
                        className="flex items-center justify-center gap-1.5 py-1.5 text-xs text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 cursor-pointer font-semibold transition-colors duration-150 focus:outline-none disabled:opacity-50"
                      >
                        <i className="fa-solid fa-download text-blue-600"></i>
                        Export Template
                      </button>
                      <label className="flex items-center justify-center gap-1.5 py-1.5 text-xs text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 cursor-pointer font-semibold transition-colors duration-150 disabled:opacity-50">
                        <i className="fa-solid fa-upload text-blue-600"></i>
                        Import Excel
                        <input
                          type="file"
                          accept=".xlsx, .xls"
                          onChange={(e) => handleImport(e, 'current_stock')}
                          disabled={importing}
                          className="hidden"
                        />
                      </label>
                    </div>

                    <div className="border-t border-slate-100 mb-2.5"></div>
                    <div className="px-4 py-1 text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Opening Cash & Credit</div>
                    <div className="grid grid-cols-2 gap-2 px-4 mb-3">
                      <button
                        onClick={() => {
                          setIsDropdownOpen(false);
                          handleExportOpeningCashAndCreditTemplate();
                        }}
                        disabled={exporting}
                        className="flex items-center justify-center gap-1.5 py-1.5 text-xs text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 cursor-pointer font-semibold transition-colors duration-150 focus:outline-none disabled:opacity-50"
                      >
                        <i className="fa-solid fa-download text-amber-600"></i>
                        Export Template
                      </button>
                      <label className="flex items-center justify-center gap-1.5 py-1.5 text-xs text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 cursor-pointer font-semibold transition-colors duration-150 disabled:opacity-50">
                        <i className="fa-solid fa-upload text-amber-600"></i>
                        Import Excel
                        <input
                          type="file"
                          accept=".xlsx, .xls"
                          onChange={(e) => handleImport(e, 'opening_credit')}
                          disabled={importing}
                          className="hidden"
                        />
                      </label>
                    </div>

                    <div className="border-t border-slate-100 mb-2.5"></div>
                    <div className="px-4 py-1 text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Cash Deposit</div>
                    <div className="grid grid-cols-2 gap-2 px-4 mb-3">
                      <button
                        onClick={() => {
                          setIsDropdownOpen(false);
                          handleExportCashDepositTemplate();
                        }}
                        disabled={exporting}
                        className="flex items-center justify-center gap-1.5 py-1.5 text-xs text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 cursor-pointer font-semibold transition-colors duration-150 focus:outline-none disabled:opacity-50"
                      >
                        <i className="fa-solid fa-download text-pink-600"></i>
                        Export Template
                      </button>
                      <label className="flex items-center justify-center gap-1.5 py-1.5 text-xs text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 cursor-pointer font-semibold transition-colors duration-150 disabled:opacity-50">
                        <i className="fa-solid fa-upload text-pink-600"></i>
                        Import Excel
                        <input
                          type="file"
                          accept=".xlsx, .xls"
                          onChange={(e) => handleImport(e, 'cash_deposit')}
                          disabled={importing}
                          className="hidden"
                        />
                      </label>
                    </div>

                    <div className="border-t border-slate-100 mb-2.5"></div>
                    <div className="px-4 py-1 text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Full Report</div>
                    <div className="px-4">
                      <button
                        onClick={() => {
                          setIsDropdownOpen(false);
                          handleExportFullReport();
                        }}
                        disabled={exporting}
                        className="w-full flex items-center justify-center gap-2 py-2 px-4 text-sm text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg border-none cursor-pointer font-semibold transition-colors duration-150 focus:outline-none"
                      >
                        <i className="fa-solid fa-file-export text-white"></i>
                        Export Full Report
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          }
        />
      </main>
    </div>
  );
}

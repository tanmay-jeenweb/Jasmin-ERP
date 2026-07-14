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
import ExcelJS from "exceljs";
import toast from "react-hot-toast";

export default function StockVsCashDepositReport() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Filter States
  const [selectedBranches, setSelectedBranches] = useState([]);
  const [selectedAbms, setSelectedAbms] = useState([]);
  const [branchSearchText, setBranchSearchText] = useState("");
  const [abmSearchText, setAbmSearchText] = useState("");
  const [isBranchFilterOpen, setIsBranchFilterOpen] = useState(false);
  const [isAbmFilterOpen, setIsAbmFilterOpen] = useState(false);

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

  // Extract unique branches
  const uniqueBranches = useMemo(() => {
    const list = data
      .map(r => ({ id: r.id, name: r.branch_name }))
      .filter(r => r.name);
    const seen = new Set();
    return list.filter(item => {
      const duplicate = seen.has(item.id);
      seen.add(item.id);
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
      const branchMatch = selectedBranches.length === 0 || selectedBranches.includes(item.id);
      const abmMatch = selectedAbms.length === 0 || selectedAbms.includes(item.abm_name);
      return branchMatch && abmMatch;
    });
  }, [data, selectedBranches, selectedAbms]);

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

    filteredData.forEach(r => {
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
  }, [filteredData]);

  // Export Template for Stock/Support/Paid Support
  const handleExportTemplate = async () => {
    setExporting(true);
    try {
      if (filteredData.length === 0) {
        toast.error("No data available to export template");
        setExporting(false);
        return;
      }

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Template");

      const monthName = new Date().toLocaleString('en-US', { month: 'long' });

      // Define columns
      sheet.columns = [
        { header: "Month", key: "month", width: 15 },
        { header: "ID", key: "id", width: 10 },
        { header: "Branch Name", key: "branch_name", width: 25 },
        { header: "State", key: "state", width: 15 },
        { header: "City/Town", key: "city", width: 15 },
        { header: "ABM NAME", key: "abm_name", width: 20 },
        { header: "Store Type", key: "store_type", width: 15 },
        { header: "Status", key: "status", width: 12 },
        { header: "Stock Invest", key: "stock_invest", width: 15 },
        { header: "Support", key: "support", width: 15 },
        { header: "Paid Support", key: "paid_support", width: 15 }
      ];

      // Add rows
      filteredData.forEach(row => {
        sheet.addRow({
          month: monthName,
          id: row.id,
          branch_name: row.branch_name || "",
          state: row.state_name || "",
          city: row.city || "",
          abm_name: row.abm_name || "",
          store_type: row.store_type ? row.store_type.charAt(0).toUpperCase() + row.store_type.slice(1) : "",
          status: row.status ? row.status.charAt(0).toUpperCase() + row.status.slice(1) : "",
          stock_invest: row.stock_deposit || 0.00,
          support: row.support || 0.00,
          paid_support: row.paid_support || 0.00
        });
      });

      // Style header row
      const headerRow = sheet.getRow(1);
      headerRow.height = 26;
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" }, name: "Segoe UI", size: 10 };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF4F46E5" }
        };
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        cell.border = {
          top: { style: "medium", color: { argb: "FF3730A3" } },
          bottom: { style: "medium", color: { argb: "FF3730A3" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } }
        };
      });

      // Style data cells & protection
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // skip header
        row.height = 20;
        const isEvenRow = (rowNumber % 2 === 0);

        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          cell.font = { name: "Segoe UI", size: 10 };
          
          if (isEvenRow) {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFF8FAFC" }
            };
          }

          if (colNumber >= 9) { // Stock Invest, Support, Paid Support (numerical)
            cell.alignment = { horizontal: "right", vertical: "middle" };
            cell.numFmt = "0.00";
            cell.protection = { locked: false }; // MUTABLE
          } else {
            if ([1, 2, 7, 8].includes(colNumber)) {
              cell.alignment = { horizontal: "center", vertical: "middle" };
            } else {
              cell.alignment = { horizontal: "left", vertical: "middle" };
            }
            cell.protection = { locked: true }; // READ-ONLY
          }

          cell.border = {
            top: { style: "thin", color: { argb: "FFE2E8F0" } },
            bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
            left: { style: "thin", color: { argb: "FFE2E8F0" } },
            right: { style: "thin", color: { argb: "FFE2E8F0" } }
          };
        });
      });

      // Enable worksheet protection
      await sheet.protect("", {
        selectLockedCells: true,
        selectUnlockedCells: true
      });

      // Save file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Stock_vs_Cash_Deposit_Template.xlsx";
      a.click();
      window.URL.revokeObjectURL(url);

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
      if (filteredData.length === 0) {
        toast.error("No data available to export template");
        setExporting(false);
        return;
      }

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Template");

      const monthName = new Date().toLocaleString('en-US', { month: 'long' });

      // Define columns
      sheet.columns = [
        { header: "Month", key: "month", width: 15 },
        { header: "ID", key: "id", width: 10 },
        { header: "Branch Name", key: "branch_name", width: 25 },
        { header: "ABM NAME", key: "abm_name", width: 20 },
        { header: "Current. Stock with Tax (GST DP)", key: "current_stock", width: 30 }
      ];

      // Add rows
      filteredData.forEach(row => {
        sheet.addRow({
          month: monthName,
          id: row.id,
          branch_name: row.branch_name || "",
          abm_name: row.abm_name || "",
          current_stock: row.current_stock || 0.00
        });
      });

      // Style header row
      const headerRow = sheet.getRow(1);
      headerRow.height = 26;
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" }, name: "Segoe UI", size: 10 };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF4F46E5" }
        };
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        cell.border = {
          top: { style: "medium", color: { argb: "FF3730A3" } },
          bottom: { style: "medium", color: { argb: "FF3730A3" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } }
        };
      });

      // Style data cells & protection
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // skip header
        row.height = 20;
        const isEvenRow = (rowNumber % 2 === 0);

        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          cell.font = { name: "Segoe UI", size: 10 };
          
          if (isEvenRow) {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFF8FAFC" }
            };
          }

          if (colNumber === 5) { // Current Stock column
            cell.alignment = { horizontal: "right", vertical: "middle" };
            cell.numFmt = "0.00";
            cell.protection = { locked: false }; // MUTABLE
          } else {
            if ([1, 2].includes(colNumber)) {
              cell.alignment = { horizontal: "center", vertical: "middle" };
            } else {
              cell.alignment = { horizontal: "left", vertical: "middle" };
            }
            cell.protection = { locked: true }; // READ-ONLY
          }

          cell.border = {
            top: { style: "thin", color: { argb: "FFE2E8F0" } },
            bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
            left: { style: "thin", color: { argb: "FFE2E8F0" } },
            right: { style: "thin", color: { argb: "FFE2E8F0" } }
          };
        });
      });

      // Enable worksheet protection
      await sheet.protect("", {
        selectLockedCells: true,
        selectUnlockedCells: true
      });

      // Save file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Current_Stock_Template.xlsx";
      a.click();
      window.URL.revokeObjectURL(url);

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
      if (filteredData.length === 0) {
        toast.error("No data available to export template");
        setExporting(false);
        return;
      }

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Template");

      const monthName = new Date().toLocaleString('en-US', { month: 'long' });

      // Define columns
      sheet.columns = [
        { header: "Month", key: "month", width: 15 },
        { header: "ID", key: "id", width: 10 },
        { header: "Branch Name", key: "branch_name", width: 25 },
        { header: "ABM NAME", key: "abm_name", width: 20 },
        { header: "Opening Cash", key: "opening_cash", width: 18 },
        { header: "Credit/Debit", key: "credit_debit", width: 18 }
      ];

      // Add rows
      filteredData.forEach(row => {
        sheet.addRow({
          month: monthName,
          id: row.id,
          branch_name: row.branch_name || "",
          abm_name: row.abm_name || "",
          opening_cash: row.opening_cash_deposit_pending || 0.00,
          credit_debit: row.credit_debit || 0.00
        });
      });

      // Style header row
      const headerRow = sheet.getRow(1);
      headerRow.height = 26;
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" }, name: "Segoe UI", size: 10 };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF4F46E5" }
        };
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        cell.border = {
          top: { style: "medium", color: { argb: "FF3730A3" } },
          bottom: { style: "medium", color: { argb: "FF3730A3" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } }
        };
      });

      // Style data cells & protection
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // skip header
        row.height = 20;
        const isEvenRow = (rowNumber % 2 === 0);

        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          cell.font = { name: "Segoe UI", size: 10 };
          
          if (isEvenRow) {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFF8FAFC" }
            };
          }

          if (colNumber >= 5) { // Opening Cash, Credit/Debit
            cell.alignment = { horizontal: "right", vertical: "middle" };
            cell.numFmt = "0.00";
            cell.protection = { locked: false }; // MUTABLE
          } else {
            if ([1, 2].includes(colNumber)) {
              cell.alignment = { horizontal: "center", vertical: "middle" };
            } else {
              cell.alignment = { horizontal: "left", vertical: "middle" };
            }
            cell.protection = { locked: true }; // READ-ONLY
          }

          cell.border = {
            top: { style: "thin", color: { argb: "FFE2E8F0" } },
            bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
            left: { style: "thin", color: { argb: "FFE2E8F0" } },
            right: { style: "thin", color: { argb: "FFE2E8F0" } }
          };
        });
      });

      // Enable worksheet protection
      await sheet.protect("", {
        selectLockedCells: true,
        selectUnlockedCells: true
      });

      // Save file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Opening_Cash_And_Credit_Template.xlsx";
      a.click();
      window.URL.revokeObjectURL(url);

      toast.success("Opening Cash & Credit template exported successfully!");
    } catch (err) {
      console.error("Failed to export Opening Cash & Credit template:", err);
      toast.error("Failed to export template. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  // Export Template for Cash Deposit
  const handleExportCashDepositTemplate = async () => {
    setExporting(true);
    try {
      if (filteredData.length === 0) {
        toast.error("No data available to export template");
        setExporting(false);
        return;
      }

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Template");

      const monthName = new Date().toLocaleString('en-US', { month: 'long' });

      // Define columns
      sheet.columns = [
        { header: "Month", key: "month", width: 15 },
        { header: "ID", key: "id", width: 10 },
        { header: "Branch Name", key: "branch_name", width: 25 },
        { header: "ABM NAME", key: "abm_name", width: 20 },
        { header: "Cash Deposit Pending", key: "cash_deposit", width: 22 }
      ];

      // Add rows
      filteredData.forEach(row => {
        sheet.addRow({
          month: monthName,
          id: row.id,
          branch_name: row.branch_name || "",
          abm_name: row.abm_name || "",
          cash_deposit: row.cash_deposit || 0.00
        });
      });

      // Style header row
      const headerRow = sheet.getRow(1);
      headerRow.height = 26;
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" }, name: "Segoe UI", size: 10 };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF4F46E5" }
        };
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        cell.border = {
          top: { style: "medium", color: { argb: "FF3730A3" } },
          bottom: { style: "medium", color: { argb: "FF3730A3" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } }
        };
      });

      // Style data cells & protection
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // skip header
        row.height = 20;
        const isEvenRow = (rowNumber % 2 === 0);

        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          cell.font = { name: "Segoe UI", size: 10 };
          
          if (isEvenRow) {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFF8FAFC" }
            };
          }

          if (colNumber === 5) { // Cash Deposit Pending
            cell.alignment = { horizontal: "right", vertical: "middle" };
            cell.numFmt = "0.00";
            cell.protection = { locked: false }; // MUTABLE
          } else {
            if ([1, 2].includes(colNumber)) {
              cell.alignment = { horizontal: "center", vertical: "middle" };
            } else {
              cell.alignment = { horizontal: "left", vertical: "middle" };
            }
            cell.protection = { locked: true }; // READ-ONLY
          }

          cell.border = {
            top: { style: "thin", color: { argb: "FFE2E8F0" } },
            bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
            left: { style: "thin", color: { argb: "FFE2E8F0" } },
            right: { style: "thin", color: { argb: "FFE2E8F0" } }
          };
        });
      });

      // Enable worksheet protection
      await sheet.protect("", {
        selectLockedCells: true,
        selectUnlockedCells: true
      });

      // Save file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Cash_Deposit_Template.xlsx";
      a.click();
      window.URL.revokeObjectURL(url);

      toast.success("Cash Deposit template exported successfully!");
    } catch (err) {
      console.error("Failed to export Cash Deposit template:", err);
      toast.error("Failed to export template. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  // Export Full Report (including calculated columns and totals row)
  const handleExportFullReport = async () => {
    setExporting(true);
    try {
      if (filteredData.length === 0) {
        toast.error("No data available to export");
        setExporting(false);
        return;
      }

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Report");

      sheet.columns = [
        { header: "Sr. No", key: "sr_no", width: 10 },
        { header: "Branch Name", key: "branch_name", width: 25 },
        { header: "State", key: "state", width: 15 },
        { header: "City", key: "city", width: 15 },
        { header: "ABM Name", key: "abm_name", width: 20 },
        { header: "Store Type", key: "store_type", width: 15 },
        { header: "Status", key: "status", width: 12 },
        { header: "Stock Deposit", key: "stock_deposit", width: 16 },
        { header: "Support", key: "support", width: 16 },
        { header: "Paid Support", key: "paid_support", width: 16 },
        { header: "Total Stock Invest", key: "total_stock_invest", width: 18 },
        { header: "Current Stock", key: "current_stock", width: 16 },
        { header: "Opening Cash Deposit Pending", key: "opening_cash_deposit_pending", width: 28 },
        { header: "Cash Deposit", key: "cash_deposit", width: 16 },
        { header: "Pending Cash Deposit", key: "pending_cash_deposit", width: 22 },
        { header: "Credit / Debit", key: "credit_debit", width: 16 },
        { header: "Available Limit with Cash Deposit", key: "available_limit", width: 30 }
      ];

      // Add data rows
      filteredData.forEach((row, index) => {
        sheet.addRow({
          sr_no: index + 1,
          branch_name: row.branch_name || "",
          state: row.state_name || "",
          city: row.city || "",
          abm_name: row.abm_name || "",
          store_type: row.store_type ? row.store_type.toUpperCase() : "",
          status: row.status ? row.status.toUpperCase() : "",
          stock_deposit: row.stock_deposit || 0,
          support: row.support || 0,
          paid_support: row.paid_support || 0,
          total_stock_invest: row.total_stock_invest || 0,
          current_stock: row.current_stock || 0,
          opening_cash_deposit_pending: row.opening_cash_deposit_pending || 0,
          cash_deposit: row.cash_deposit || 0,
          pending_cash_deposit: row.pending_cash_deposit || 0,
          credit_debit: row.credit_debit || 0,
          available_limit: row.available_limit || 0
        });
      });

      // Add total row
      sheet.addRow({
        sr_no: "Total",
        branch_name: "",
        state: "",
        city: "",
        abm_name: "",
        store_type: "",
        status: "",
        stock_deposit: totals.stock_deposit || 0,
        support: totals.support || 0,
        paid_support: totals.paid_support || 0,
        total_stock_invest: totals.total_stock_invest || 0,
        current_stock: totals.current_stock || 0,
        opening_cash_deposit_pending: totals.opening_cash_deposit_pending || 0,
        cash_deposit: totals.cash_deposit || 0,
        pending_cash_deposit: totals.pending_cash_deposit || 0,
        credit_debit: totals.credit_debit || 0,
        available_limit: totals.available_limit || 0
      });

      // Style header row
      const headerRow = sheet.getRow(1);
      headerRow.height = 26;
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" }, name: "Segoe UI", size: 10 };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF4F46E5" }
        };
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        cell.border = {
          top: { style: "medium", color: { argb: "FF3730A3" } },
          bottom: { style: "medium", color: { argb: "FF3730A3" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } }
        };
      });

      // Style rows
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // skip header
        const isTotalRow = (rowNumber === sheet.rowCount);
        row.height = isTotalRow ? 22 : 20;
        const isEvenRow = (!isTotalRow && rowNumber % 2 === 0);

        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          cell.font = {
            name: "Segoe UI",
            size: 10,
            bold: isTotalRow ? true : (colNumber === 2 || colNumber === 11 || colNumber === 15 || colNumber === 17),
            color: isTotalRow ? { argb: "FF1E293B" } : undefined
          };

          // Alternate row coloring (Zebra)
          if (isEvenRow) {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFF8FAFC" }
            };
          }

          // Alignment & format
          if (colNumber >= 8) {
            cell.alignment = { horizontal: "right", vertical: "middle" };
            cell.numFmt = "0.00";
          } else {
            if ([1, 6, 7].includes(colNumber)) {
              cell.alignment = { horizontal: "center", vertical: "middle" };
            } else {
              cell.alignment = { horizontal: "left", vertical: "middle" };
            }
          }

          // Total row styling
          if (isTotalRow) {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFF1F5F9" }
            };
            cell.border = {
              top: { style: "thin", color: { argb: "FF94A3B8" } },
              bottom: { style: "double", color: { argb: "FF1E293B" } },
              left: { style: "thin", color: { argb: "FFE2E8F0" } },
              right: { style: "thin", color: { argb: "FFE2E8F0" } }
            };
          } else {
            cell.border = {
              top: { style: "thin", color: { argb: "FFE2E8F0" } },
              bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
              left: { style: "thin", color: { argb: "FFE2E8F0" } },
              right: { style: "thin", color: { argb: "FFE2E8F0" } }
            };
          }
        });
      });

      // Save file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Stock_vs_Cash_Deposit_Report.xlsx";
      a.click();
      window.URL.revokeObjectURL(url);

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
    const base = filteredData.map((item, index) => ({
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
  }, [filteredData, totals]);

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
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${row.store_type === 'branch' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-orange-50 text-orange-700 border border-orange-200'
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
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${row.status === 'active' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
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
      label: "Support (20%)",
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
      key: `opening_cash_deposit_pending`,
      label: `(${new Date().toISOString().split('T')[0]}) Opening Cash Deposit Pending`,
      minWidth: "220px",
      render: (row) => <span className={row.id === "Total" ? "font-bold text-slate-900 text-sm" : "font-medium text-slate-700"}>{formatVal(row.opening_cash_deposit_pending)}</span>
    },
    {
      key: "cash_deposit",
      label: `(${new Date().toISOString().split('T')[0]}) Cash Deposit`,
      minWidth: "130px",
      render: (row) => <span className={row.id === "Total" ? "font-bold text-slate-900 text-sm" : "font-medium text-slate-700"}>{formatVal(row.cash_deposit)}</span>
    },
    {
      key: "pending_cash_deposit",
      label: `(${new Date().toISOString().split('T')[0]}) Pending Cash Deposit`,
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
          className="flex items-center justify-between gap-2 h-10 px-3 rounded-lg border border-slate-350 bg-white hover:border-slate-400 text-sm font-semibold transition-colors duration-150 cursor-pointer focus:outline-none"
        >
          <span className="text-slate-700">
            {selectedBranches.length === 0
              ? "All Branches"
              : `${selectedBranches.length} Branch${selectedBranches.length > 1 ? 'es' : ''}`}
          </span>
          <i className="fa-solid fa-chevron-down text-xs text-slate-400"></i>
        </button>

        {isBranchFilterOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsBranchFilterOpen(false)}></div>
            <div className="absolute left-0 mt-1 w-64 rounded-xl border border-slate-200 bg-white shadow-xl py-2 z-50 flex flex-col">
              <div className="px-3 py-1.5 border-b border-slate-100 flex items-center gap-1.5">
                <i className="fa-solid fa-magnifying-glass text-slate-400 text-xs"></i>
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
                  onClick={() => setSelectedBranches(uniqueBranches.map(b => b.id))}
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
                    const isChecked = selectedBranches.includes(branch.id);
                    return (
                      <label key={branch.id} className="flex items-center gap-2 px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50 rounded-lg cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setSelectedBranches(selectedBranches.filter(id => id !== branch.id));
                            } else {
                              setSelectedBranches([...selectedBranches, branch.id]);
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
          className="flex items-center justify-between gap-2 h-10 px-3 rounded-lg border border-slate-350 bg-white hover:border-slate-400 text-sm font-semibold transition-colors duration-150 cursor-pointer focus:outline-none"
        >
          <span className="text-slate-700">
            {selectedAbms.length === 0
              ? "All ABMs"
              : `${selectedAbms.length} ABM${selectedAbms.length > 1 ? 's' : ''}`}
          </span>
          <i className="fa-solid fa-chevron-down text-xs text-slate-400"></i>
        </button>

        {isAbmFilterOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsAbmFilterOpen(false)}></div>
            <div className="absolute left-0 mt-1 w-64 rounded-xl border border-slate-200 bg-white shadow-xl py-2 z-50 flex flex-col">
              <div className="px-3 py-1.5 border-b border-slate-100 flex items-center gap-1.5">
                <i className="fa-solid fa-magnifying-glass text-slate-400 text-xs"></i>
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
          toggleActions={filtersElement}
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

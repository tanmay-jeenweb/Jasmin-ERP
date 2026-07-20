import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import DataTable from "../../components/DataTable";
import { getPriceListReport } from "../../api/priceListApi";
import ExcelJS from "exceljs";
import toast from "react-hot-toast";

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

export default function PriceListReport() {
  const { variationId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [dynamicColumns, setDynamicColumns] = useState([]);
  const [formatName, setFormatName] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedOfferModal, setSelectedOfferModal] = useState(null);
  const [selectedStockModal, setSelectedStockModal] = useState(null);

  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch (e) {
      return {};
    }
  }, []);

  const visibleDynamicColumns = useMemo(() => {
    return dynamicColumns.filter(col => {
      if (col.not_show_in_report === true || col.not_show_in_report === "Yes" || col.not_show_in_report === "true") {
        return false;
      }
      return canUserViewColumn(col, currentUser);
    });
  }, [dynamicColumns, currentUser]);

  const loadReportData = async () => {
    setLoading(true);
    try {
      const res = await getPriceListReport(variationId);
      if (res.data?.success) {
        setData(res.data.data || []);
        setFormatName(res.data.formatName || "Price List Report");
        setDynamicColumns(res.data.columns || []);
      }
    } catch (err) {
      console.error("Failed to load price list report:", err);
      toast.error("Failed to load price list report data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReportData();
  }, [variationId]);

  const columns = useMemo(() => {
    const cols = [
      {
        key: "brand",
        label: "Brand",
        render: (row) => <span className="font-semibold text-slate-700">{row.brand || "—"}</span>
      },
      {
        key: "product_name",
        label: "Product Name",
        render: (row) => <span className="font-semibold text-slate-800">{row.product_name || row.icat_name || "—"}</span>
      },
      {
        key: "model_group_name",
        label: "Model Group",
        render: (row) => <span className="font-bold text-indigo-950">{row.model_group_name || "—"}</span>
      }
    ];

    visibleDynamicColumns.forEach(c => {
      cols.push({
        key: c.column_name,
        label: c.column_name,
        render: (row) => {
          const val = row[c.column_name];
          if (val === undefined || val === null || val === '') return "—";
          return <span className="font-semibold text-slate-900">{val}</span>;
        }
      });
    });

    // Offers Column
    cols.push({
      key: "offers",
      label: "Offers",
      render: (row) => {
        const offers = row.active_offers || [];
        if (offers.length === 0) {
          return <span className="text-slate-400 text-xs italic">No active offers</span>;
        }
        return (
          <div className="flex flex-wrap items-center gap-1.5 py-1">
            {offers.map((off, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedOfferModal(off)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200/80 hover:bg-amber-100 shadow-2xs cursor-pointer transition-all"
                title="Click to view offer details"
              >
                <i className="fa-solid fa-gift text-[10px] text-amber-600"></i>
                <span>{off.offer_type}</span>
                {off.brand_name && <span className="text-[10px] text-amber-600 font-normal">({off.brand_name})</span>}
              </button>
            ))}
          </div>
        );
      }
    });

    // Static View Stock Button
    cols.push({
      key: "view_stock",
      label: "Stock Status",
      render: (row) => (
        <button
          onClick={() => setSelectedStockModal(row)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-xs hover:from-teal-700 hover:to-emerald-700 transition-all cursor-pointer"
        >
          <i className="fa-solid fa-boxes-stacked text-[11px]"></i>
          <span>View Stock</span>
        </button>
      )
    });

    return cols;
  }, [visibleDynamicColumns]);

  const handleExportReport = async () => {
    const loadToastId = toast.loading("Generating report sheet...");
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Price List Report");

      const fixedHeaders = [
        { header: "Brand", key: "brand", width: 18 },
        { header: "Product Name", key: "product_name", width: 25 },
        { header: "Model Group", key: "model_group_name", width: 28 },
      ];

      const customHeaders = visibleDynamicColumns.map(col => ({
        header: col.column_name,
        key: col.column_name,
        width: 20
      }));

      const endHeaders = [
        { header: "Active Offers", key: "active_offers", width: 35 },
      ];

      worksheet.columns = [...fixedHeaders, ...customHeaders, ...endHeaders];

      // Style header
      const headerRow = worksheet.getRow(1);
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF4F46E5" }, // Indigo
        };
        cell.font = { name: "Segoe UI", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
        cell.alignment = { vertical: "middle", horizontal: "center" };
      });
      headerRow.height = 25;

      data.forEach(row => {
        const rowData = {
          brand: row.brand || "",
          product_name: row.product_name || row.icat_name || "",
          model_group_name: row.model_group_name,
        };

        visibleDynamicColumns.forEach(c => {
          rowData[c.column_name] = row[c.column_name] !== undefined && row[c.column_name] !== null ? row[c.column_name] : "";
        });

        const activeOffersText = (row.active_offers || [])
          .map(o => `${o.offer_type} (${new Date(o.from_date).toLocaleDateString()} - ${new Date(o.to_date).toLocaleDateString()})`)
          .join("; ");

        rowData["active_offers"] = activeOffersText || "None";

        worksheet.addRow(rowData);
      });

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

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Price_List_Report_${formatName.replace(/\s+/g, "_")}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);

      toast.success("Price List Report exported!", { id: loadToastId });
    } catch (err) {
      console.error("Export report error:", err);
      toast.error("Failed to export report.", { id: loadToastId });
    }
  };

  return (
    <div className="flex flex-col flex-1 bg-slate-50 font-sans min-h-screen">
      <Navbar title="Price List Report" />

      <main className="flex-1 flex flex-col w-full mx-auto px-[30px] py-8">
        <DataTable
          tableId={`price_list_report_${variationId}`}
          title={`${formatName} - Price List Report`}
          data={data}
          columns={columns}
          loading={loading}
          searchPlaceholder="Search Brand, Product Name, Model Group, or prices..."
          actionButton={
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(`/admin/price-list/${variationId}`)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-[9px] text-slate-700 bg-white border border-slate-300 font-semibold text-[13px] hover:bg-slate-50 transition-all cursor-pointer shadow-xs"
                title="Switch to raw Price List Table view"
              >
                <i className="fa-solid fa-table-list text-indigo-600 text-xs"></i>
                <span>Price List Data</span>
              </button>

              <button
                onClick={handleExportReport}
                disabled={loading || data.length === 0}
                className="flex items-center gap-2 px-5 py-2.5 rounded-[9px] text-white border-none cursor-pointer font-semibold text-[13px] bg-gradient-to-br from-indigo-600 to-indigo-700 shadow-[0_2px_8px_rgba(104,4,161,0.35)] disabled:bg-slate-400 disabled:cursor-not-allowed disabled:shadow-none hover:opacity-95 transition-all"
              >
                <i className="fa-solid fa-file-excel text-xs"></i>
                <span>Export Report</span>
              </button>
            </div>
          }
        />
      </main>

      {/* Offer Details Modal */}
      {selectedOfferModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                  <i className="fa-solid fa-gift"></i>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">{selectedOfferModal.offer_type}</h3>
                  <p className="text-xs text-slate-500">{selectedOfferModal.brand_name}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedOfferModal(null)}
                className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer p-1"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <div className="bg-amber-50/60 rounded-xl p-3 border border-amber-100/80 flex items-center justify-between text-xs text-amber-900">
                <span className="font-semibold">Offer Validity</span>
                <span className="font-mono font-bold">
                  {new Date(selectedOfferModal.from_date).toLocaleDateString()} &mdash; {new Date(selectedOfferModal.to_date).toLocaleDateString()}
                </span>
              </div>

              <div className="flex flex-col gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Offer Rules & Transactions</h4>
                {(selectedOfferModal.transactions || []).length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No detailed transaction rules specified.</p>
                ) : (
                  (selectedOfferModal.transactions || []).map((t, idx) => (
                    <div key={idx} className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 flex flex-col gap-1 text-xs text-slate-800">
                      <div className="flex items-center justify-between font-semibold">
                        <span className="text-indigo-700">{t.transaction_type}</span>
                        <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-mono font-bold">{t.value_type}</span>
                      </div>
                      {t.offer_type_value && <p><span className="text-slate-500">Value:</span> <strong>{t.offer_type_value}</strong></p>}
                      {t.upto_value && <p><span className="text-slate-500">Upto:</span> <strong>₹{t.upto_value}</strong></p>}
                      {t.offer_text && <p><span className="text-slate-500">Description:</span> {t.offer_text}</p>}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setSelectedOfferModal(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-semibold text-xs hover:bg-slate-200 transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Stock Static Modal */}
      {selectedStockModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 flex flex-col gap-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-xl mx-auto">
              <i className="fa-solid fa-boxes-stacked"></i>
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg">Stock Status</h3>
              <p className="text-xs text-slate-500 mt-1">
                Model Group: <strong className="text-slate-800">{selectedStockModal.model_group_name}</strong>
              </p>
              <p className="text-xs text-slate-500">
                Product Name: <strong className="text-slate-800">{selectedStockModal.product_name || selectedStockModal.icat_name}</strong>
              </p>
            </div>

            <div className="bg-teal-50/80 p-4 rounded-xl border border-teal-200/60 text-xs text-teal-900 space-y-1">
              <p className="font-bold text-sm text-teal-950">Static Stock Placeholder</p>
              <p className="text-teal-700">Live branch inventory integration is ready to be linked for this model group.</p>
            </div>

            <div className="flex justify-center pt-2">
              <button
                onClick={() => setSelectedStockModal(null)}
                className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold text-xs hover:bg-indigo-700 transition-all cursor-pointer shadow-sm"
              >
                Close Stock View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

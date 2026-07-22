import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import DataTable from "../../components/DataTable";
import { getPriceListReport, getModelGroupStockInfo } from "../../api/priceListApi";
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
  
  // Date filter state
  const [reportDate, setReportDate] = useState("");
  const [isHistoricalView, setIsHistoricalView] = useState(false);

  // Dynamic Stock Modal state
  const [stockModalData, setStockModalData] = useState(null);
  const [stockSearchQuery, setStockSearchQuery] = useState("");

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

  const loadReportData = async (targetDate = reportDate) => {
    setLoading(true);
    try {
      const res = await getPriceListReport(variationId, targetDate);
      if (res.data?.success) {
        setData(res.data.data || []);
        setFormatName(res.data.formatName || "Price List Report");
        setDynamicColumns(res.data.columns || []);
        setIsHistoricalView(Boolean(targetDate && targetDate.trim() !== ""));
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

  const handleDateChange = (e) => {
    const selected = e.target.value;
    setReportDate(selected);
    loadReportData(selected);
  };

  const handleResetDate = () => {
    setReportDate("");
    loadReportData("");
  };

  const handleOpenStockModal = async (row, forceSync = false) => {
    const modelGroup = row.model_group_name || stockModalData?.modelGroup;
    const productName = row.product_name || row.icat_name || stockModalData?.productName || "—";

    if (forceSync) {
      setStockModalData(prev => prev ? { ...prev, syncing: true } : null);
    } else {
      setStockModalData({
        isOpen: true,
        modelGroup,
        productName,
        loading: true,
        error: null,
        rawItems: [],
        isCached: false,
        updatedAt: null,
        syncing: false
      });
      setStockSearchQuery("");
    }

    try {
      const res = await getModelGroupStockInfo(modelGroup, forceSync);
      if (res.data?.success) {
        setStockModalData(prev => prev ? {
          ...prev,
          loading: false,
          syncing: false,
          rawItems: res.data.data || [],
          isCached: res.data.isCached || false,
          updatedAt: res.data.updatedAt || new Date().toISOString()
        } : null);
        if (forceSync) {
          toast.success("Live stock synced successfully!");
        }
      } else {
        setStockModalData(prev => prev ? {
          ...prev,
          loading: false,
          syncing: false,
          error: res.data?.message || "Failed to fetch stock information."
        } : null);
      }
    } catch (err) {
      console.error("Error fetching stock info:", err);
      setStockModalData(prev => prev ? {
        ...prev,
        loading: false,
        syncing: false,
        error: "Unable to connect to stock service. Please try again."
      } : null);
    }
  };

  // Group and sort stock data by Branch Name alphabetically (A to Z) with Saleable Stock >= 1
  const processedStockData = useMemo(() => {
    if (!stockModalData || !stockModalData.rawItems) {
      return { sortedBranches: [], branchGroups: {}, totalAvailableStock: 0, totalDeviceTypes: 0 };
    }

    // Filter devices where SALEABLE_STOCK >= 1 (or > 1)
    const validItems = stockModalData.rawItems.filter(item => {
      const stock = Number(item.SALEABLE_STOCK || 0);
      return stock >= 1;
    });

    // Filter by modal search query (branch name, branch code, device name, item code)
    const query = stockSearchQuery.trim().toLowerCase();
    const searchedItems = validItems.filter(item => {
      if (!query) return true;
      const bName = String(item.BRANCH_NAME || "").toLowerCase();
      const bCode = String(item.BRANCH_CODE || "").toLowerCase();
      const iName = String(item.ITEM_NAME || "").toLowerCase();
      const iCode = String(item.ITEM_CODE || "").toLowerCase();
      return bName.includes(query) || bCode.includes(query) || iName.includes(query) || iCode.includes(query);
    });

    const groups = {};
    let totalAvailableStock = 0;

    searchedItems.forEach(item => {
      const branchKey = (item.BRANCH_NAME || item.BRANCH_CODE || "Unknown Location").trim();
      if (!groups[branchKey]) {
        groups[branchKey] = {
          branchName: item.BRANCH_NAME || branchKey,
          branchCode: item.BRANCH_CODE || "",
          items: [],
          branchTotalStock: 0
        };
      }
      const itemStock = Number(item.SALEABLE_STOCK || 0);
      groups[branchKey].items.push(item);
      groups[branchKey].branchTotalStock += itemStock;
      totalAvailableStock += itemStock;
    });

    // Sort branches in alphabetical order (A to Z)
    const sortedBranches = Object.keys(groups).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    );

    return {
      sortedBranches,
      branchGroups: groups,
      totalAvailableStock,
      totalDeviceTypes: searchedItems.length
    };
  }, [stockModalData, stockSearchQuery]);

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
          if (val === undefined || val === null || val === '' || val === '-' || val === '—') return "—";
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

    // View Stock Button
    cols.push({
      key: "view_stock",
      label: "Stock Status",
      render: (row) => {
        const mgName = (row.model_group_name || "").trim();
        const mgClean = mgName.toLowerCase().replace(/^\*/, "").trim();

        if (!mgClean || mgClean === "general" || mgClean === "—") {
          return <span className="text-slate-400 text-xs italic">—</span>;
        }

        return (
          <button
            onClick={() => handleOpenStockModal(row)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-xs hover:from-teal-700 hover:to-emerald-700 transition-all cursor-pointer"
          >
            <i className="fa-solid fa-boxes-stacked text-[11px]"></i>
            <span>View Stock</span>
          </button>
        );
      }
    });

    return cols;
  }, [visibleDynamicColumns]);

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
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-[9px] px-3 py-1.5 shadow-xs">
                <i className="fa-solid fa-calendar-days text-indigo-600 text-xs"></i>
                <label htmlFor="report-date" className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                  Report Date:
                </label>
                <input
                  id="report-date"
                  type="date"
                  value={reportDate}
                  onChange={handleDateChange}
                  max={new Date().toISOString().split("T")[0]}
                  className="text-xs text-slate-800 font-semibold bg-transparent focus:outline-hidden cursor-pointer"
                />
                {reportDate && (
                  <button
                    onClick={handleResetDate}
                    className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer ml-1 p-0.5"
                    title="Reset to live data"
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                )}
              </div>

              {isHistoricalView && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[9px] text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs">
                  <i className="fa-solid fa-clock-rotate-left text-amber-600"></i>
                  <span>Historical Data ({reportDate})</span>
                </div>
              )}

              <button
                onClick={() => navigate(`/admin/price-list/${variationId}`)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-[9px] text-slate-700 bg-white border border-slate-300 font-semibold text-[13px] hover:bg-slate-50 transition-all cursor-pointer shadow-xs"
                title="Switch to raw Price List Table view"
              >
                <i className="fa-solid fa-table-list text-indigo-600 text-xs"></i>
                <span>Price List Data</span>
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

      {/* Dynamic View Stock Modal */}
      {stockModalData && stockModalData.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[85vh] p-6 shadow-2xl border border-slate-200 flex flex-col gap-4 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-lg shadow-xs">
                  <i className="fa-solid fa-boxes-stacked"></i>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 text-lg">{stockModalData.modelGroup}</h3>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                      {stockModalData.productName}
                    </span>
                    {stockModalData.updatedAt && (
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 border ${stockModalData.isCached
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-indigo-50 text-indigo-700 border-indigo-200"
                        }`}>
                        <i className={`fa-solid ${stockModalData.isCached ? "fa-database" : "fa-bolt"} text-[10px]`}></i>
                        <span>{stockModalData.isCached ? "DB Stored" : "Live Synced"}</span>
                      </span>
                    )}
                  </div>
                  {stockModalData.updatedAt && (
                    <p className="text-[11px] text-slate-400 mt-0.5 font-medium">
                      Last Synced: <strong className="text-slate-600">{new Date(stockModalData.updatedAt).toLocaleString()}</strong>
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenStockModal({ model_group_name: stockModalData.modelGroup, product_name: stockModalData.productName }, true)}
                  disabled={stockModalData.syncing || stockModalData.loading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs cursor-pointer transition-all disabled:opacity-50 border-none"
                  title="Sync latest live stock from APX API into Database"
                >
                  <i className={`fa-solid fa-rotate ${stockModalData.syncing ? 'animate-spin' : ''}`}></i>
                  <span>{stockModalData.syncing ? "Syncing APX..." : "Sync Live Stock"}</span>
                </button>

                <button
                  onClick={() => setStockModalData(null)}
                  className="text-slate-400 hover:text-slate-600 text-xl cursor-pointer p-1.5 transition-colors rounded-lg hover:bg-slate-100"
                  title="Close"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
            </div>

            {/* Modal Sub-Bar / Search & Metrics */}
            {!stockModalData.loading && !stockModalData.error && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                <div className="relative w-full sm:w-72">
                  <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                  <input
                    type="text"
                    value={stockSearchQuery}
                    onChange={(e) => setStockSearchQuery(e.target.value)}
                    placeholder="Search place, device or code..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-teal-500 focus:ring-1 focus:ring-teal-500 text-slate-800 placeholder-slate-400"
                  />
                  {stockSearchQuery && (
                    <button
                      onClick={() => setStockSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-end text-xs">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-50 text-teal-800 border border-teal-200/80 font-medium">
                    <span>Locations Available:</span>
                    <strong className="font-bold text-teal-900">{processedStockData.sortedBranches.length}</strong>
                  </div>

                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-medium shadow-2xs">
                    <span>Total Saleable Stock:</span>
                    <strong className="font-bold text-white text-sm">{processedStockData.totalAvailableStock}</strong>
                  </div>
                </div>
              </div>
            )}

            {/* Modal Body / Content */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-4 min-h-[200px]">
              {stockModalData.loading ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-3">
                  <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-xs font-semibold text-slate-600">Fetching live inventory for {stockModalData.modelGroup}...</p>
                </div>
              ) : stockModalData.error ? (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-5 text-center text-rose-800 space-y-3">
                  <div className="w-10 h-10 bg-rose-100 rounded-full flex items-center justify-center mx-auto text-rose-600">
                    <i className="fa-solid fa-triangle-exclamation"></i>
                  </div>
                  <p className="text-xs font-semibold">{stockModalData.error}</p>
                  <button
                    onClick={() => handleOpenStockModal({ model_group_name: stockModalData.modelGroup, product_name: stockModalData.productName })}
                    className="px-4 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 transition-colors"
                  >
                    Retry Fetching
                  </button>
                </div>
              ) : processedStockData.sortedBranches.length === 0 ? (
                <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-10 text-center text-slate-500 space-y-2">
                  <div className="w-12 h-12 bg-slate-200/70 rounded-full flex items-center justify-center mx-auto text-slate-400 text-xl">
                    <i className="fa-solid fa-boxes-packing"></i>
                  </div>
                  <h4 className="font-bold text-slate-700 text-sm">No Saleable Stock Available</h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    {stockSearchQuery
                      ? `No locations matching "${stockSearchQuery}" with Saleable Stock ≥ 1.`
                      : `Currently there are no devices in stock (Saleable Stock ≥ 1) for ${stockModalData.modelGroup}.`}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {processedStockData.sortedBranches.map((branchName, bIdx) => {
                    const group = processedStockData.branchGroups[branchName];
                    return (
                      <div
                        key={bIdx}
                        className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden transition-all"
                      >
                        {/* Branch Header (Alphabetically Sorted) */}
                        <div className="bg-slate-50/90 px-4 py-2.5 border-b border-slate-200/70 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                              {bIdx + 1}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <i className="fa-solid fa-location-dot text-indigo-600 text-xs"></i>
                              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wide">
                                {group.branchName}
                              </h4>
                              {group.branchCode && (
                                <span className="text-[11px] font-mono text-slate-500 font-semibold">
                                  ({group.branchCode})
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-slate-500">Available Stock:</span>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-teal-100 text-teal-800 border border-teal-200">
                              {group.branchTotalStock}
                            </span>
                          </div>
                        </div>

                        {/* Items Table for this Branch */}
                        <div className="divide-y divide-slate-100 text-xs">
                          {group.items.map((item, iIdx) => (
                            <div
                              key={iIdx}
                              className="px-4 py-2.5 flex items-center justify-between hover:bg-slate-50/50 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 text-xs">
                                  <i className="fa-solid fa-mobile-screen"></i>
                                </div>
                                <div className="flex flex-col">
                                  <span className="font-bold text-slate-800 text-xs">
                                    {item.ITEM_NAME || "Item Details"}
                                  </span>
                                  {item.ITEM_CODE && (
                                    <span className="text-[10px] font-mono text-slate-400">
                                      Code: {item.ITEM_CODE}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-3">
                                <div className="flex flex-col items-end">
                                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200/80">
                                    {item.SALEABLE_STOCK} Saleable Stock
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-between items-center pt-3 border-t border-slate-100">
              <span className="text-[11px] text-slate-400 italic">
                Source: Live APX Inventory Sync
              </span>
              <button
                onClick={() => setStockModalData(null)}
                className="px-5 py-2 bg-slate-100 text-slate-700 rounded-xl font-semibold text-xs hover:bg-slate-200 transition-all cursor-pointer"
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


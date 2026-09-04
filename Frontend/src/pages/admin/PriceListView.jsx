import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import DataTable from "../../components/DataTable";
import { getPriceListReport, getModelGroupStockInfo } from "../../api/priceListApi";
import { usePermission } from "../../context/PermissionContext";
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

const getTransactionTheme = (type) => {
  const t = String(type || "").toLowerCase();
  if (t.includes("cash")) {
    return {
      icon: "fa-solid fa-money-bill-wave",
      badgeBg: "bg-emerald-50 text-emerald-700 border-emerald-200",
      accentText: "text-emerald-700"
    };
  }
  if (t.includes("card") || t.includes("swipe")) {
    return {
      icon: "fa-solid fa-credit-card",
      badgeBg: "bg-purple-50 text-purple-700 border-purple-200",
      accentText: "text-purple-700"
    };
  }
  if (t.includes("finance")) {
    return {
      icon: "fa-solid fa-building-columns",
      badgeBg: "bg-blue-50 text-blue-700 border-blue-200",
      accentText: "text-blue-700"
    };
  }
  return {
    icon: "fa-solid fa-boxes-packing",
    badgeBg: "bg-amber-50 text-amber-700 border-amber-200",
    accentText: "text-amber-700"
  };
};

const formatPriceValue = (val) => {
  if (val === undefined || val === null || val === '' || val === '-' || val === '—') return "0";
  const num = Number(val);
  if (!isNaN(num) && typeof val !== 'boolean') {
    return Number.isInteger(num) ? String(num) : num.toFixed(2);
  }
  return val;
};

export default function PriceListView() {
  const { variationId } = useParams();
  const navigate = useNavigate();
  const { hasPermission, isAdmin } = usePermission();


  const [data, setData] = useState([]);
  const [dynamicColumns, setDynamicColumns] = useState([]);
  const [formatName, setFormatName] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedOfferModal, setSelectedOfferModal] = useState(null);

  // Dynamic Stock Modal state
  const [stockModalData, setStockModalData] = useState(null);
  const [stockSearchQuery, setStockSearchQuery] = useState("");

  // Brand & Product filter state
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [selectedProductNames, setSelectedProductNames] = useState([]);
  const [brandSearchText, setBrandSearchText] = useState("");
  const [productSearchText, setProductSearchText] = useState("");
  const [isBrandFilterOpen, setIsBrandFilterOpen] = useState(false);
  const [isProductFilterOpen, setIsProductFilterOpen] = useState(false);

  // Deduplicate modal transactions defensively to avoid repeated cards
  const uniqueModalTransactions = useMemo(() => {
    if (!selectedOfferModal?.transactions) return [];
    const seen = new Set();
    return selectedOfferModal.transactions.filter(t => {
      const key = `${t.id || ''}-${t.transaction_type}-${t.value_type}-${t.offer_type_value}-${t.upto_value}-${t.offer_text}-${t.relative_offer}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [selectedOfferModal]);

  useEffect(() => {
    setSelectedBrands([]);
    setSelectedProductNames([]);
    setBrandSearchText("");
    setProductSearchText("");
    setIsBrandFilterOpen(false);
    setIsProductFilterOpen(false);
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

  const uniqueProductNames = useMemo(() => {
    const names = new Set();
    data.forEach(row => {
      const name = row.product_name || row.icat_name;
      if (name) {
        names.add(name.trim());
      }
    });
    return Array.from(names).sort();
  }, [data]);

  const filteredData = useMemo(() => {
    return data.filter(row => {
      const brandMatch = selectedBrands.length === 0 || selectedBrands.includes(row.brand?.trim());
      const productName = row.product_name || row.icat_name;
      const productMatch = selectedProductNames.length === 0 || selectedProductNames.includes(productName?.trim());
      return brandMatch && productMatch;
    });
  }, [data, selectedBrands, selectedProductNames]);

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
      const res = await getPriceListReport(variationId, null);
      if (res.data?.success) {
        setData(res.data.data || []);
        const apiFormatName = res.data.formatName || "Price List";
        setFormatName(apiFormatName.replace(/Report/gi, "View"));
        setDynamicColumns(res.data.columns || []);
      }
    } catch (err) {
      console.error("Failed to load price list view:", err);
      const errMsg = err.response?.data?.message || "Failed to load price list view data.";
      toast.error(errMsg);
      if (err.response?.status === 403) {
        navigate("/");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReportData();
  }, [variationId]);

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
        label: "Product Category",
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
          return <span className="font-semibold text-slate-900">{formatPriceValue(val)}</span>;
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
      <Navbar title="Price List View" />

      <main className="flex-1 flex flex-col w-full mx-auto px-[30px] py-8">
        <DataTable
          tableId={`price_list_view_${variationId}`}
          title={`${formatName} - Price List View`}
          data={filteredData}
          columns={columns}
          loading={loading}
          searchPlaceholder="Search Brand, Product Category, Model Group, or prices..."
          actionButton={
            <div className="flex flex-wrap items-center gap-3">
              {/* Brand Multi-select Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setIsBrandFilterOpen(!isBrandFilterOpen);
                    setIsProductFilterOpen(false);
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
                    <div className="absolute right-0 mt-1 w-64 rounded-xl border border-slate-200 bg-white shadow-xl py-2 z-50 flex flex-col">
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

              {/* Product Category Multi-select Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setIsProductFilterOpen(!isProductFilterOpen);
                    setIsBrandFilterOpen(false);
                  }}
                  className="flex items-center justify-between gap-2 h-9 px-3 rounded-[9px] border border-slate-300 bg-white hover:border-slate-400 text-xs font-semibold shadow-xs transition-colors duration-150 cursor-pointer focus:outline-none"
                >
                  <span className="text-slate-700">
                    {selectedProductNames.length === 0
                      ? "All Categories"
                      : `${selectedProductNames.length} Categor${selectedProductNames.length > 1 ? 'ies' : 'y'}`}
                  </span>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3 text-slate-400">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>

                {isProductFilterOpen && (
                  <>
                    <div className="fixed inset-0 z-45" onClick={() => setIsProductFilterOpen(false)}></div>
                    <div className="absolute right-0 mt-1 w-64 rounded-xl border border-slate-200 bg-white shadow-xl py-2 z-50 flex flex-col">
                      <div className="px-3 py-1.5 border-b border-slate-100 flex items-center gap-1.5">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5 text-slate-400">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.602 10.602Z" />
                        </svg>
                        <input
                          type="text"
                          placeholder="Search categories..."
                          value={productSearchText}
                          onChange={(e) => setProductSearchText(e.target.value)}
                          className="w-full text-xs border-none outline-none bg-transparent"
                        />
                      </div>
                      <div className="px-2 py-1 border-b border-slate-100 flex items-center justify-between text-[11px] font-bold text-indigo-650">
                        <button
                          type="button"
                          onClick={() => setSelectedProductNames(uniqueProductNames)}
                          className="bg-transparent border-none cursor-pointer hover:underline text-indigo-600 font-semibold"
                        >
                          Select All
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedProductNames([])}
                          className="bg-transparent border-none cursor-pointer hover:underline text-indigo-600 font-semibold"
                        >
                          Deselect All
                        </button>
                      </div>
                      <div className="max-h-48 overflow-y-auto px-1 py-1 space-y-0.5">
                        {uniqueProductNames
                          .filter(p => p.toLowerCase().includes(productSearchText.toLowerCase()))
                          .map(name => {
                            const isChecked = selectedProductNames.includes(name);
                            return (
                              <label key={name} className="flex items-center gap-2 px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50 rounded-lg cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    if (isChecked) {
                                      setSelectedProductNames(selectedProductNames.filter(pName => pName !== name));
                                    } else {
                                      setSelectedProductNames([...selectedProductNames, name]);
                                    }
                                  }}
                                  className="accent-[#6804a1] h-3.5 w-3.5 flex-shrink-0"
                                />
                                <span className="truncate">{name}</span>
                              </label>
                            );
                          })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          }
        />
      </main>

      {/* Offer Details Modal */}
      {selectedOfferModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[85vh] p-6 shadow-2xl border border-slate-200 flex flex-col gap-4 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-base shadow-xs">
                  <i className="fa-solid fa-gift"></i>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                    {selectedOfferModal.offer_type}
                    <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Active
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">{selectedOfferModal.brand_name}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedOfferModal(null)}
                className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                title="Close"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Modal Body with smooth scrolling */}
            <div className="flex flex-col gap-3.5 flex-1 overflow-y-auto pr-1">
              {/* Validity Banner */}
              <div className="bg-amber-50/70 rounded-xl p-3 border border-amber-100/80 flex items-center justify-between text-xs text-amber-900">
                <span className="font-semibold flex items-center gap-1.5">
                  <i className="fa-regular fa-calendar text-amber-600"></i>
                  Offer Validity
                </span>
                <span className="font-mono font-bold">
                  {new Date(selectedOfferModal.from_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} &mdash; {new Date(selectedOfferModal.to_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </div>

              {/* Transactions list */}
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Offer Rules & Transactions
                  </h4>
                  {uniqueModalTransactions.length > 0 && (
                    <span className="text-[11px] font-semibold text-slate-400">
                      {uniqueModalTransactions.length} {uniqueModalTransactions.length === 1 ? "Rule" : "Rules"}
                    </span>
                  )}
                </div>

                {uniqueModalTransactions.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-4 text-center">No detailed transaction rules specified.</p>
                ) : (
                  uniqueModalTransactions.map((t, idx) => {
                    const theme = getTransactionTheme(t.transaction_type);
                    return (
                      <div key={idx} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition-all flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${theme.badgeBg} border`}>
                            <i className={theme.icon}></i>
                            <span>{t.transaction_type}</span>
                          </span>
                          <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                            {t.value_type}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2 flex-wrap pt-0.5">
                          {t.offer_type_value && (
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-xs text-slate-500 font-medium">Value:</span>
                              <span className="text-base font-extrabold text-slate-900 tracking-tight">
                                {t.value_type === "In Rs." && !isNaN(Number(t.offer_type_value))
                                  ? `₹${Number(t.offer_type_value).toLocaleString("en-IN")}`
                                  : t.offer_type_value}
                              </span>
                              {t.value_type === "In %" && <span className="text-xs font-bold text-slate-700">%</span>}
                            </div>
                          )}

                          {t.upto_value && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200/80">
                              <span className="text-slate-400">Upto:</span>
                              <strong className="text-slate-800 font-mono">₹{Number(t.upto_value).toLocaleString("en-IN")}</strong>
                            </span>
                          )}
                        </div>

                        {t.offer_text && (
                          <div className="flex items-start gap-2 text-xs text-slate-700 bg-slate-50/90 p-2.5 rounded-lg border border-slate-100">
                            <i className="fa-solid fa-circle-info text-indigo-500 mt-0.5 flex-shrink-0"></i>
                            <span className="leading-relaxed font-medium">{t.offer_text}</span>
                          </div>
                        )}

                        {t.relative_offer && (
                          <div className="text-[11px] text-slate-500 flex items-center gap-1 pt-0.5">
                            <i className="fa-solid fa-link text-slate-400 text-[10px]"></i>
                            <span>Linked offer: <strong className="text-slate-700">{t.relative_offer}</strong></span>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end pt-3 border-t border-slate-100">
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

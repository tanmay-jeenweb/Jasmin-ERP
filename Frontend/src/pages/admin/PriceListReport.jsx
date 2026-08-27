import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import DataTable from "../../components/DataTable";
import { getPriceListReport, getHistoryTimestamps } from "../../api/priceListApi";
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

export default function PriceListReport() {
  const { variationId } = useParams();
  const navigate = useNavigate();
  const { hasPermission, isAdmin } = usePermission();


  const [data, setData] = useState([]);
  const [dynamicColumns, setDynamicColumns] = useState([]);
  const [formatName, setFormatName] = useState("");
  const [loading, setLoading] = useState(false);
  // Date & Time filter state
  const [reportDate, setReportDate] = useState("");
  const [reportTime, setReportTime] = useState("");
  const [historyTimestamps, setHistoryTimestamps] = useState([]);
  const [isHistoricalView, setIsHistoricalView] = useState(false);

  // Brand & Product filter state
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [selectedProductNames, setSelectedProductNames] = useState([]);
  const [brandSearchText, setBrandSearchText] = useState("");
  const [productSearchText, setProductSearchText] = useState("");
  const [isBrandFilterOpen, setIsBrandFilterOpen] = useState(false);
  const [isProductFilterOpen, setIsProductFilterOpen] = useState(false);

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

  const loadReportData = async (targetDate = reportTime || reportDate) => {
    setLoading(true);
    try {
      const res = await getPriceListReport(variationId, targetDate);
      if (res.data?.success) {
        setData(res.data.data || []);
        setFormatName(res.data.formatName || "Price List Report");
        setDynamicColumns(res.data.columns || []);
        setIsHistoricalView(Boolean(targetDate && String(targetDate).trim() !== ""));
      }
    } catch (err) {
      console.error("Failed to load price list report:", err);
      const errMsg = err.response?.data?.message || "Failed to load price list report data.";
      toast.error(errMsg);
      if (err.response?.status === 403) {
        navigate("/");
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchTimestamps = async () => {
    try {
      const res = await getHistoryTimestamps(variationId);
      if (res.data?.success) {
        setHistoryTimestamps(res.data.timestamps || []);
      }
    } catch (e) {
      console.warn("Failed to fetch history timestamps:", e.message);
    }
  };

  useEffect(() => {
    fetchTimestamps();
    loadReportData();
  }, [variationId]);

  const availableTimesForDate = useMemo(() => {
    if (!reportDate) return [];
    return historyTimestamps.filter(ts => ts.date_part === reportDate);
  }, [historyTimestamps, reportDate]);

  const displayHistoricalLabel = useMemo(() => {
    if (!reportDate && !reportTime) return "";
    if (reportTime) {
      const matchingTs = historyTimestamps.find(ts => ts.full_timestamp === reportTime);
      if (matchingTs) {
        return `${matchingTs.date_part} ${matchingTs.time_part}`;
      }
      return reportTime;
    }
    return reportDate;
  }, [reportDate, reportTime, historyTimestamps]);

  const handleDateChange = (e) => {
    const selected = e.target.value;
    setReportDate(selected);
    setReportTime("");

    const timesForSelected = historyTimestamps.filter(ts => ts.date_part === selected);
    if (timesForSelected.length > 0) {
      const latestTs = timesForSelected[0].full_timestamp;
      setReportTime(latestTs);
      loadReportData(latestTs);
    } else {
      loadReportData(selected);
    }
  };

  const handleTimeChange = (e) => {
    const selectedTs = e.target.value;
    setReportTime(selectedTs);
    loadReportData(selectedTs || reportDate);
  };

  const handleResetDate = () => {
    setReportDate("");
    setReportTime("");
    loadReportData("");
  };




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
          if (val === undefined || val === null || val === '' || val === '-' || val === '—') return "0";
          return <span className="font-semibold text-slate-900">{val}</span>;
        }
      });
    });
    if (isHistoricalView) {
      cols.push({
        key: "history_timestamp",
        label: "Update Time",
        render: (row) => {
          if (!row.timestamp) return "—";
          const d = new Date(row.timestamp);
          return (
            <span className="font-mono text-xs text-indigo-700 font-semibold bg-indigo-50 px-2 py-1 rounded-md border border-indigo-100">
              {d.toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'medium' })}
            </span>
          );
        }
      });
    }

    return cols;
  }, [visibleDynamicColumns, isHistoricalView]);

  return (
    <div className="flex flex-col flex-1 bg-slate-50 font-sans min-h-screen">
      <Navbar title="Price List Report" />

      <main className="flex-1 flex flex-col w-full mx-auto px-[30px] py-8">
        <DataTable
          tableId={`price_list_report_${variationId}`}
          title={`${formatName} - Price List Report`}
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
            </div>
          }
        />
      </main>


    </div>
  );
}


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


            </div>
          }
        />
      </main>


    </div>
  );
}


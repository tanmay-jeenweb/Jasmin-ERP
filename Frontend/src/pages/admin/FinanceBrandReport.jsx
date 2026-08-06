import { useState, useEffect, useMemo, Fragment } from "react";
import Navbar from "../../components/Navbar";
import DataTable from "../../components/DataTable";
import { getFinanceBrandReport } from "../../api/branchBrandFinanceReportApi";
import toast from "react-hot-toast";

export default function FinanceBrandReport() {
  const [loading, setLoading] = useState(true);
  const [brands, setBrands] = useState([]);
  const [machines, setMachines] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  // State multiselect filter
  const [selectedStates, setSelectedStates] = useState([]);
  const [stateSearchText, setStateSearchText] = useState("");
  const [isStateFilterOpen, setIsStateFilterOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getFinanceBrandReport();
      if (res.data?.success) {
        const { brands, machines, companies, rows } = res.data.data;
        setBrands(brands || []);
        setMachines(machines || []);
        setCompanies(companies || []);
        setRows(rows || []);
      } else {
        setError(res.data?.message || "Failed to load report data.");
      }
    } catch (err) {
      console.error("Failed to load report data:", err);
      setError("Unable to load report data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const uniqueStates = useMemo(() => {
    const states = rows.map(r => r.state_name).filter(Boolean);
    return Array.from(new Set(states)).sort();
  }, [rows]);

  // Pre-process rows to flatten nested objects so that DataTable search and sort works natively
  const processedRows = useMemo(() => {
    return rows.map((row, idx) => {
      const flatBrands = {};
      brands.forEach(brand => {
        flatBrands[`brand_${brand.id}`] = row.brand_codes[brand.id] || "";
      });

      const flatMachines = {};
      machines.forEach(m => {
        const det = row.machine_details[m.id] || {};
        flatMachines[`machine_${m.id}_tid`] = det.tid || "";
        flatMachines[`machine_${m.id}_pos_id`] = det.pos_id || "";
        flatMachines[`machine_${m.id}_serial_no`] = det.serial_no || "";
      });

      const flatCompanies = {};
      companies.forEach(comp => {
        flatCompanies[`company_${comp.id}`] = row.company_codes[comp.id] || "";
      });

      return {
        ...row,
        sr_no: idx + 1,
        ...flatBrands,
        ...flatMachines,
        ...flatCompanies
      };
    });
  }, [rows, brands, machines, companies]);

  // Filter by state first
  const stateFilteredRows = useMemo(() => {
    return processedRows.filter(row => {
      if (selectedStates.length > 0 && !selectedStates.includes(row.state_name)) {
        return false;
      }
      return true;
    });
  }, [processedRows, selectedStates]);

  // Define columns for DataTable
  const columns = useMemo(() => {
    const cols = [
      {
        key: "sr_no",
        label: "Sr.No.",
        minWidth: "60px",
        sortable: true,
        render: (row) => <span className="font-semibold text-slate-500">{row.sr_no}</span>
      },
      {
        key: "branch_name",
        label: "Branch Name",
        minWidth: "200px",
        sortable: true,
        render: (row) => <span className="font-semibold text-slate-800">{row.branch_name}</span>
      }
    ];

    // Brands
    brands.forEach(brand => {
      cols.push({
        key: `brand_${brand.id}`,
        label: `${brand.mobile_brand}`,
        minWidth: "120px",
        sortable: true,
        render: (row) => {
          const code = row.brand_codes[brand.id];
          const isMapped = row.mapped_brands.includes(brand.id);
          return (
            <div
              style={isMapped ? { backgroundColor: "#008000", color: "#ffffff", margin: "-8px -12px", padding: "8px 12px", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" } : {}}
              className={`w-full h-full font-semibold text-xs text-center flex items-center justify-center ${isMapped ? "" : "text-slate-600 bg-white"}`}
            >
              {code || "—"}
            </div>
          );
        }
      });
    });

    // QR Code
    cols.push({
      key: "qr_code_id_password",
      label: "QR CODE ID & PASSWORD",
      minWidth: "220px",
      sortable: true,
      render: (row) => <span className="font-mono text-xs">{row.qr_code_id_password || "—"}</span>
    });

    // Machines
    machines.forEach(m => {
      cols.push({
        key: `machine_${m.id}_tid`,
        label: `${m.machine_name} - TID`,
        minWidth: "110px",
        sortable: true,
        render: (row) => <span className="text-xs text-slate-650">{row.machine_details[m.id]?.tid || "—"}</span>
      });
      cols.push({
        key: `machine_${m.id}_pos_id`,
        label: `${m.machine_name} - POS ID`,
        minWidth: "110px",
        sortable: true,
        render: (row) => <span className="text-xs text-slate-650">{row.machine_details[m.id]?.pos_id || "—"}</span>
      });
      cols.push({
        key: `machine_${m.id}_serial_no`,
        label: `${m.machine_name} - Serial NO`,
        minWidth: "110px",
        sortable: true,
        render: (row) => <span className="text-xs text-slate-650">{row.machine_details[m.id]?.serial_no || "—"}</span>
      });
    });

    // Finance Companies
    companies.forEach(company => {
      cols.push({
        key: `company_${company.id}`,
        label: `${company.bank_card_name}`,
        minWidth: "130px",
        sortable: true,
        render: (row) => {
          const code = row.company_codes[company.id];
          const isMapped = row.mapped_companies.includes(company.id);
          return (
            <div
              style={isMapped ? { backgroundColor: "#008000", color: "#ffffff", margin: "-8px -12px", padding: "8px 12px", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" } : {}}
              className={`w-full h-full font-semibold text-xs text-center flex items-center justify-center ${isMapped ? "" : "text-slate-600 bg-white"}`}
            >
              {code || "—"}
            </div>
          );
        }
      });
    });

    // Remarks
    cols.push({
      key: "remarks",
      label: "Remarks",
      minWidth: "250px",
      sortable: true,
      render: (row) => <span className="whitespace-pre-wrap text-xs text-slate-600">{row.remarks || "—"}</span>
    });

    return cols;
  }, [brands, machines, companies]);

  // Render State Filter Dropdown as toggleActions in DataTable
  const stateFilterDropdown = (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsStateFilterOpen(!isStateFilterOpen)}
        className="flex items-center justify-between gap-2 h-10 px-3 rounded-lg border border-slate-300 bg-white hover:border-slate-400 text-sm font-semibold transition-colors duration-150 cursor-pointer focus:outline-none"
      >
        <span className="text-slate-700">
          {selectedStates.length === 0
            ? "All States"
            : `${selectedStates.length} State${selectedStates.length > 1 ? 's' : ''}`}
        </span>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3 text-slate-400">
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {isStateFilterOpen && (
        <>
          <div className="fixed inset-0 z-45" onClick={() => setIsStateFilterOpen(false)}></div>
          <div className="absolute right-0 mt-1 w-64 rounded-xl border border-slate-200 bg-white shadow-xl py-2 z-50 flex flex-col">
            <div className="px-3 py-1.5 border-b border-slate-100 flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5 text-slate-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.602 10.602Z" />
              </svg>
              <input
                type="text"
                placeholder="Search states..."
                value={stateSearchText}
                onChange={(e) => setStateSearchText(e.target.value)}
                className="w-full text-xs border-none outline-none bg-transparent"
              />
            </div>
            <div className="px-2 py-1 border-b border-slate-100 flex items-center justify-between text-[11px] font-bold text-indigo-600">
              <button
                type="button"
                onClick={() => setSelectedStates(uniqueStates)}
                className="bg-transparent border-none cursor-pointer hover:underline text-[#6804a1] font-semibold"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={() => setSelectedStates([])}
                className="bg-transparent border-none cursor-pointer hover:underline text-[#6804a1] font-semibold"
              >
                Deselect All
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto px-1 py-1 space-y-0.5">
              {uniqueStates
                .filter(name => name.toLowerCase().includes(stateSearchText.toLowerCase()))
                .map(stateName => {
                  const isChecked = selectedStates.includes(stateName);
                  return (
                    <label key={stateName} className="flex items-center gap-2 px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50 rounded-lg cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            setSelectedStates(selectedStates.filter(name => name !== stateName));
                          } else {
                            setSelectedStates([...selectedStates, stateName]);
                          }
                        }}
                        className="accent-[#6804a1] h-3.5 w-3.5 flex-shrink-0"
                      />
                      <span className="truncate">{stateName}</span>
                    </label>
                  );
                })}
            </div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="flex flex-col flex-1 bg-slate-50 font-sans min-h-screen">
      <Navbar title="ERP Admin" />

      <main className="flex-grow w-full mx-auto py-8 px-[30px] flex flex-col">
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-750 px-4 py-3 rounded-lg mb-6 text-sm font-semibold">
            {error}
          </div>
        )}

        <div className="flex-1 flex flex-col">
          <DataTable
            tableId="finance_brand_report"
            title="Finance & Brand Report"
            data={stateFilteredRows}
            columns={columns}
            loading={loading}
            toggleActions={stateFilterDropdown}
            searchPlaceholder="Search by branch or other fields..."
          />
        </div>
      </main>
    </div>
  );
}

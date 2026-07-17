import { useState, useEffect, useMemo, Fragment } from "react";
import Navbar from "../../components/Navbar";
import { getFinanceBrandReport } from "../../api/branchBrandFinanceReportApi";
import toast from "react-hot-toast";

export default function FinanceBrandReport() {
  const [loading, setLoading] = useState(true);
  const [brands, setBrands] = useState([]);
  const [machines, setMachines] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  // Filters
  const [searchText, setSearchText] = useState("");
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

  const filteredRows = useMemo(() => {
    return rows.filter(row => {
      // State Filter
      if (selectedStates.length > 0 && !selectedStates.includes(row.state_name)) {
        return false;
      }
      // Search text filter
      if (searchText.trim()) {
        const query = searchText.toLowerCase();
        const matchName = row.branch_name.toLowerCase().includes(query);
        const matchCode = row.branch_code.toLowerCase().includes(query);
        if (!matchName && !matchCode) {
          return false;
        }
      }
      return true;
    });
  }, [rows, selectedStates, searchText]);

  return (
    <div className="flex flex-col flex-1 bg-slate-50 font-sans">
      <Navbar title="ERP Admin" />

      <main className="flex-1 flex flex-col w-full mx-auto px-[30px] py-8">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-7">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 m-0">
              Finance & Brand Report
            </h1>
          </div>


        </div>

        {/* Data Matrix Grid Table Card */}
        <div className="rounded-xl border border-slate-250 bg-white shadow-sm flex flex-col overflow-hidden mb-7">
          {/* Filter Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white border-b border-slate-200 p-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* Search Input */}
              <div className="relative w-64">
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Search by branch..."
                  className="w-full h-10 pl-9 pr-4 text-sm border border-slate-300 rounded-lg outline-none focus:border-indigo-600 transition-colors"
                />
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="absolute left-3 top-3 w-4 h-4 text-slate-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.602 10.602Z" />
                </svg>
              </div>

              {/* State Filter */}
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
                    <div className="absolute left-0 mt-1 w-64 rounded-xl border border-slate-200 bg-white shadow-xl py-2 z-50 flex flex-col">
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
            </div>

            <div className="text-slate-500 text-xs font-semibold">
              Showing {filteredRows.length} of {rows.length} branches
            </div>
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg m-4 text-sm font-medium">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center items-center py-[100px]">
              <span className="text-base text-slate-600 font-semibold animate-pulse">Loading report data...</span>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="flex justify-center items-center py-[100px] text-slate-500 text-sm font-medium">
              No matching records found
            </div>
          ) : (
            <>
              <style>{`
              .no-scrollbar::-webkit-scrollbar {
                display: none !important;
              }
              .no-scrollbar {
                -ms-overflow-style: none !important;
                scrollbar-width: none !important;
              }
            `}</style>
              <div className="overflow-x-auto max-h-[70vh] no-scrollbar">
                <table className="min-w-full border-separate border-spacing-0">
                  <thead className="sticky top-0 z-20">
                    <tr className="bg-blue-900 text-white h-9">
                      <th className="px-4 border-b border-r border-slate-800 text-left text-xs font-semibold uppercase tracking-wider sticky left-0 z-30 bg-blue-900 align-middle" rowSpan={2}>
                        Sr.No.
                      </th>
                      <th className="px-4 border-b border-r border-slate-800 text-left text-xs font-semibold uppercase tracking-wider sticky left-[55px] z-30 bg-blue-900 min-w-[200px] align-middle" rowSpan={2}>
                        Branch Name
                      </th>
                      <th className="px-4 border-b border-r border-slate-800 text-center text-xs font-semibold uppercase tracking-wider align-middle" colSpan={brands.length}>
                        Brand Code
                      </th>
                      <th className="px-4 border-b border-r border-slate-800 text-center text-xs font-semibold uppercase tracking-wider min-w-[220px] align-middle" rowSpan={2}>
                        QR CODE ID & PASSWORD
                      </th>
                      {machines.map(m => (
                        <th key={m.id} className="px-4 border-b border-r border-slate-800 text-center text-xs font-semibold uppercase tracking-wider align-middle" colSpan={3}>
                          {m.machine_name}
                        </th>
                      ))}
                      <th className="px-4 border-b border-r border-slate-800 text-center text-xs font-semibold uppercase tracking-wider align-middle" colSpan={companies.length}>
                        Finance Code
                      </th>
                      <th className="px-4 border-b border-blue-700 text-center text-xs font-semibold uppercase tracking-wider min-w-[250px] align-middle" rowSpan={2}>
                        Remarks
                      </th>
                    </tr>
                    <tr className="bg-blue-700 text-white text-[11px] h-8">
                      {/* Brand names */}
                      {brands.map((brand, bIdx) => {
                        const isLastBrand = bIdx === brands.length - 1;
                        return (
                          <th
                            key={brand.id}
                            className={`px-3 border-b text-center font-semibold min-w-[120px] bg-blue-700 align-middle ${
                              isLastBrand ? 'border-r border-slate-800' : 'border-r border-blue-700'
                            }`}
                          >
                            {brand.mobile_brand}
                          </th>
                        );
                      })}
                      {/* Machine columns */}
                      {machines.map(m => (
                        <Fragment key={m.id}>
                          <th className="px-3 border-b border-r border-blue-700 text-center font-semibold min-w-[90px] bg-blue-700 align-middle">TID</th>
                          <th className="px-3 border-b border-r border-blue-700 text-center font-semibold min-w-[90px] bg-blue-700 align-middle">POS ID</th>
                          <th className="px-3 border-b border-r border-slate-800 text-center font-semibold min-w-[90px] bg-blue-700 align-middle">Serial NO</th>
                        </Fragment>
                      ))}
                      {/* Finance Company names */}
                      {companies.map((company, cIdx) => {
                        const isLastCompany = cIdx === companies.length - 1;
                        return (
                          <th
                            key={company.id}
                            className={`px-3 border-b text-center font-semibold min-w-[130px] bg-blue-700 align-middle ${
                              isLastCompany ? 'border-r border-slate-800' : 'border-r border-blue-700'
                            }`}
                          >
                            {company.bank_card_name}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRows.map((row, idx) => (
                      <tr key={row.branch_id} className="hover:bg-slate-50/50 transition-colors duration-100">
                        <td className="px-4 py-3 border-r border-slate-400 text-slate-500 font-semibold text-center sticky left-0 z-10 bg-white">
                          {idx + 1}
                        </td>
                        <td className="px-4 py-3 border-r border-slate-400 font-semibold text-slate-800 sticky left-[55px] z-10 bg-white min-w-[200px]">
                          {row.branch_name}
                        </td>
                        {/* Brand Code values */}
                        {brands.map((brand, bIdx) => {
                          const code = row.brand_codes[brand.id];
                          const isMapped = row.mapped_brands.includes(brand.id);
                          const isLastBrand = bIdx === brands.length - 1;
                          return (
                            <td
                              key={brand.id}
                              style={isMapped ? { backgroundColor: '#008000', color: '#ffffff' } : {}}
                              className={`px-3 py-3 text-center align-middle font-semibold text-xs ${
                                isMapped ? "" : "text-slate-600 bg-white"
                              } ${
                                isLastBrand ? 'border-r border-slate-400' : 'border-r border-slate-100'
                              }`}
                            >
                              {code || "—"}
                            </td>
                          );
                        })}
                        {/* QR Code */}
                        <td className="px-4 py-3 border-r border-slate-400 text-center text-slate-700 font-mono text-xs bg-white min-w-[220px]">
                          {row.qr_code_id_password || "—"}
                        </td>
                        {/* Machine Details values */}
                        {machines.map(m => {
                          const mDet = row.machine_details[m.id] || {};
                          return (
                            <Fragment key={m.id}>
                              <td className="px-3 py-3 border-r border-slate-100 text-center text-slate-650 text-xs bg-white">{mDet.tid || "—"}</td>
                              <td className="px-3 py-3 border-r border-slate-100 text-center text-slate-650 text-xs bg-white">{mDet.pos_id || "—"}</td>
                              <td className="px-3 py-3 border-r border-slate-400 text-center text-slate-650 text-xs bg-white">{mDet.serial_no || "—"}</td>
                            </Fragment>
                          );
                        })}
                        {/* Finance Code values */}
                        {companies.map((company, cIdx) => {
                          const code = row.company_codes[company.id];
                          const isMapped = row.mapped_companies.includes(company.id);
                          const isLastCompany = cIdx === companies.length - 1;
                          return (
                            <td
                              key={company.id}
                              style={isMapped ? { backgroundColor: '#008000', color: '#ffffff' } : {}}
                              className={`px-3 py-3 text-center align-middle font-semibold text-xs ${
                                isMapped ? "" : "text-slate-600 bg-white"
                              } ${
                                isLastCompany ? 'border-r border-slate-400' : 'border-r border-slate-100'
                              }`}
                            >
                              {code || "—"}
                            </td>
                          );
                        })}
                        {/* Remarks */}
                        <td className="px-4 py-3 text-left text-slate-600 text-xs bg-white whitespace-pre-wrap min-w-[250px]">
                          {row.remarks || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

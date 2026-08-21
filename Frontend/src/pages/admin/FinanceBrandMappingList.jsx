import { useEffect, useState, useMemo } from "react";
import Navbar from "../../components/Navbar";
import { getBranches } from "../../api/branchApi";
import DataTable from "../../components/DataTable";
import { useNavigate } from "react-router-dom";

export default function FinanceBrandMappingList() {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const loadBranches = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getBranches({ assignedOnly: true });
      const rawData = res.data?.success ? (res.data.data || []) : (res.data || []);
      const mapped = rawData.map((row, idx) => ({
        ...row,
        sr_no: idx + 1
      }));
      setBranches(mapped);
    } catch (err) {
      console.error("Failed to load branches:", err);
      setError("Unable to load branches. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBranches();
  }, []);

  const columns = useMemo(() => [
    {
      key: "sr_no",
      label: "Sr. No",
      minWidth: "70px",
      render: (row) => <span className="font-semibold text-slate-500">{row.sr_no}</span>
    },
    {
      key: "name",
      label: "Branch Name",
      minWidth: "250px",
      render: (row) => <span className="font-semibold text-slate-800">{row.name}</span>
    },
    {
      key: "code",
      label: "Branch Code",
      minWidth: "150px",
      render: (row) => <span className="font-mono bg-slate-100 px-2.5 py-1 rounded text-xs font-bold text-slate-700">{row.code}</span>
    },
    {
      key: "action",
      label: "Mapping",
      minWidth: "120px",
      render: (row) => (
        <button
          onClick={() => navigate(`/admin/finance-brand-mapping/${row.id}`)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition-all duration-150 border-none cursor-pointer focus:outline-none"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
          </svg>
          <span>Mapping</span>
        </button>
      )
    }
  ], [navigate]);

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
          tableId="finance_brand_mapping_list"
          title="Finance Brand Mapping"
          data={branches}
          columns={columns}
          loading={loading}
          searchPlaceholder="Search branches..."
        />
      </main>
    </div>
  );
}

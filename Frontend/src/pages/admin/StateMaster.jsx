import { useEffect, useState, useMemo } from "react";
import Navbar from "../../components/Navbar";
import { getStates, createState, updateState, deleteState } from "../../api/stateApi";
import DataTable from "../../components/DataTable";
import toast from "react-hot-toast";
import { usePermission } from "../../context/PermissionContext";

// ─── State Modal (Handles both Create and Edit) ───────────────────────────────────
function StateModal({ isOpen, row, onClose, onSave, saving }) {
  const [name, setName] = useState("");
  const [live, setLive] = useState("Yes");

  useEffect(() => {
    if (row) {
      setName(row.name || "");
      setLive(row.live || "Yes");
    } else {
      setName("");
      setLive("Yes");
    }
  }, [row, isOpen]);

  if (!isOpen) return null;

  const isEdit = !!row;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave(isEdit ? row.id : null, name.trim(), live);
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-900/55 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-[18px] w-full max-w-[500px] mx-auto shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-7 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-br from-indigo-600 to-indigo-700">
          <div>
            <h2 className="m-0 text-lg font-bold text-white">{isEdit ? "Edit State" : "Create State"}</h2>
            <p className="mt-1 text-[13px] text-indigo-100">{isEdit ? "Update state name" : "Add a new state to the system"}</p>
          </div>
          <button onClick={onClose} className="bg-white/15 border-none rounded-lg w-[34px] h-[34px] cursor-pointer flex items-center justify-center text-white hover:bg-white/20 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-[18px] h-[18px]">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit}>
          <div className="px-7 py-6">
            <div className="mb-5">
              <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-2">
                State Name <span className="text-rose-650">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g. Maharashtra, Karnataka"
                className="w-full border-[1.5px] border-slate-300 rounded-[9px] px-3.5 py-[11px] text-[15px] outline-none text-slate-800 focus:border-indigo-650 transition-colors"
              />
            </div>

            <div className="mb-2">
              <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-2">
                Live <span className="text-rose-650">*</span>
              </label>
              <div className="flex gap-6 items-center">
                <label className="flex items-center gap-2 text-[15px] text-slate-850 cursor-pointer font-medium">
                  <input
                    type="radio"
                    name="live"
                    checked={live === "Yes"}
                    onChange={() => setLive("Yes")}
                    className="w-[18px] h-[18px] accent-indigo-650 cursor-pointer"
                  />
                  Yes
                </label>
                <label className="flex items-center gap-2 text-[15px] text-slate-850 cursor-pointer font-medium">
                  <input
                    type="radio"
                    name="live"
                    checked={live === "No"}
                    onChange={() => setLive("No")}
                    className="w-[18px] h-[18px] accent-indigo-650 cursor-pointer"
                  />
                  No
                </label>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="px-7 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
            <button type="button" onClick={onClose} disabled={saving}
              className="px-5 py-2 rounded-lg border-[1.5px] border-slate-300 text-slate-600 bg-white font-semibold text-[13px] cursor-pointer hover:bg-slate-55 transition-colors disabled:opacity-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="px-6 py-2 rounded-lg border-none text-white font-bold text-[13px] transition-all bg-gradient-to-br from-indigo-600 to-indigo-750 shadow-[0_2px_8px_rgba(104,4,161,0.35)] cursor-pointer disabled:bg-slate-400 disabled:cursor-not-allowed disabled:shadow-none hover:opacity-95">
              {saving ? "Saving…" : isEdit ? "Save Changes" : "Create State"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function StateMaster() {
  const [states, setStates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);

  const { hasPermission } = usePermission();

  const loadStates = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await getStates();
      setStates(response.data.data || []);
    } catch (err) {
      console.error("Failed to load states", err);
      setError("Unable to load states. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStates();
  }, []);

  const handleSave = async (id, name, live) => {
    setSaving(true);
    try {
      if (id) {
        // Edit Mode
        await updateState(id, { name, live });
        toast.success("State updated successfully");
      } else {
        // Create Mode
        await createState({ name, live });
        toast.success("State created successfully");
      }
      setIsModalOpen(false);
      setSelectedRow(null);
      await loadStates();
    } catch (err) {
      console.error("Failed to save state", err);
      toast.error(err?.response?.data?.message || "Unable to save state. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this state?")) return;
    setSaving(true);
    try {
      await deleteState(id);
      toast.success("State deleted successfully");
      await loadStates();
    } catch (err) {
      console.error("Failed to delete state", err);
      toast.error(err?.response?.data?.message || "Unable to delete state.");
    } finally {
      setSaving(false);
    }
  };

  const columns = useMemo(() => {
    const cols = [
      { key: "id", label: "ID", minWidth: "80px" },
      {
        key: "name", label: "State Name",
        render: (row) => <span className="font-bold text-slate-900">{row.name}</span>
      },
      {
        key: "live", label: "Live",
        render: (row) => (
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${row.live === "Yes" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
            {row.live || "Yes"}
          </span>
        )
      }
    ];

    const canUpdate = hasPermission("state_master", "update");
    const canDelete = hasPermission("state_master", "delete");

    if (canUpdate || canDelete) {
      cols.push({
        key: "actions", label: "Actions", sortable: false, minWidth: "120px",
        render: (row) => (
          <div className="flex items-center gap-2">
            {canUpdate && (
              <button
                onClick={() => {
                  setSelectedRow(row);
                  setIsModalOpen(true);
                }}
                className="flex w-8 h-8 items-center justify-center rounded-lg border border-purple-200 bg-purple-50 text-indigo-650 cursor-pointer hover:bg-purple-100 transition-colors"
                title="Edit"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-[15px] h-[15px]">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931Z" />
                </svg>
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => handleDelete(row.id)}
                className="flex w-8 h-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 cursor-pointer hover:bg-rose-100 transition-colors"
                title="Delete"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-[15px] h-[15px]">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 7.5h12m-1.5 0-.563 12.375A2.25 2.25 0 0113.693 21H10.307a2.25 2.25 0 01-2.244-2.125L7.5 7.5m3-3h3A1.5 1.5 0 0115 6v1.5H9V6a1.5 1.5 0 011.5-1.5Z" />
                </svg>
              </button>
            )}
          </div>
        )
      });
    }

    return cols;
  }, [saving, hasPermission]);

  return (
    <div className="flex flex-col flex-1 bg-slate-50 font-sans">
      <Navbar title="ERP Admin" />

      <StateModal
        isOpen={isModalOpen}
        row={selectedRow}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedRow(null);
        }}
        onSave={handleSave}
        saving={saving}
      />

      <main className="flex-1 flex flex-col w-full mx-auto px-[30px] py-8">
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg mb-5 text-sm font-medium">
            {error}
          </div>
        )}
        <DataTable
          tableId="state_master"
          title="State Master"
          data={states}
          columns={columns}
          loading={loading}
          searchPlaceholder="Search states..."
          actionButton={
            hasPermission("state_master", "write") ? (
              <button
                onClick={() => {
                  setSelectedRow(null);
                  setIsModalOpen(true);
                }}
                className="flex w-10 h-10 items-center justify-center rounded-[9px] bg-gradient-to-br from-indigo-650 to-indigo-750 text-white border-none cursor-pointer shadow-[0_2px_8px_rgba(104,4,161,0.35)] hover:opacity-95 transition-opacity"
                title="Create State"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-[18px] h-[18px]">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>
            ) : null
          }
        />
      </main>
    </div>
  );
}

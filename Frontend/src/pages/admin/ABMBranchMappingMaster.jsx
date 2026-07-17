import { useEffect, useState, useMemo } from "react";
import Navbar from "../../components/Navbar";
import {
    getEligibleAbms,
    getActiveBranches,
    getAllAbmMappings,
    getAbmMappingById,
    saveAbmBranchMapping,
    deleteAbmMapping
} from "../../api/abmBranchMappingApi";
import DataTable from "../../components/DataTable";
import toast from "react-hot-toast";
import { usePermission } from "../../context/PermissionContext";

// ─── Modal Component for Adding/Editing Mappings ─────────────────────────
function AbmBranchMappingModal({ isOpen, mapping, onClose, onSave, saving }) {
    const [abms, setAbms] = useState([]);
    const [branches, setBranches] = useState([]);
    const [selectedAbmId, setSelectedAbmId] = useState("");
    const [selectedBranchIds, setSelectedBranchIds] = useState([]);
    const [branchSearch, setBranchSearch] = useState("");
    const [selectedStates, setSelectedStates] = useState([]);
    const [selectedCities, setSelectedCities] = useState([]);
    const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
    const [isStateFilterOpen, setIsStateFilterOpen] = useState(false);
    const [isCityFilterOpen, setIsCityFilterOpen] = useState(false);

    useEffect(() => {
        if (isOpen) {
            // Load ABMs and Branches
            const fetchData = async () => {
                try {
                    const abmsRes = await getEligibleAbms();
                    setAbms(abmsRes.data?.data || []);

                    const branchesRes = await getActiveBranches();
                    setBranches(branchesRes.data?.data || []);
                } catch (err) {
                    console.error("Error loading dropdown data:", err);
                    toast.error("Failed to load ABM or Branch dropdown options.");
                }
            };
            fetchData();

            // Set initial state for edit/create
            if (mapping) {
                setSelectedAbmId(mapping.abm_user_id);
                // Load existing mapping details
                const loadMappingDetails = async () => {
                    try {
                        const detailsRes = await getAbmMappingById(mapping.abm_user_id);
                        setSelectedBranchIds(detailsRes.data?.data || []);
                    } catch (err) {
                        console.error("Error loading mapping details:", err);
                        toast.error("Failed to load current branch assignments.");
                    }
                };
                loadMappingDetails();
            } else {
                setSelectedAbmId("");
                setSelectedBranchIds([]);
            }
            setBranchSearch("");
            setSelectedStates([]);
            setSelectedCities([]);
            setIsBranchDropdownOpen(false);
            setIsStateFilterOpen(false);
            setIsCityFilterOpen(false);
        }
    }, [isOpen, mapping]);

    // Extract unique states from branches
    const uniqueStates = useMemo(() => {
        const states = branches.map(b => b.state_name).filter(Boolean);
        return Array.from(new Set(states)).sort();
    }, [branches]);

    // Extract unique cities filtered by states if states are selected
    const uniqueCities = useMemo(() => {
        const filtered = selectedStates.length > 0
            ? branches.filter(b => selectedStates.includes(b.state_name))
            : branches;
        const cities = filtered.map(b => b.city).filter(Boolean);
        return Array.from(new Set(cities)).sort();
    }, [branches, selectedStates]);

    // Filter branches by search query, states and cities
    const filteredBranches = useMemo(() => {
        return branches.filter(b => {
            const matchSearch = !branchSearch ||
                b.name.toLowerCase().includes(branchSearch.toLowerCase()) ||
                b.code.toLowerCase().includes(branchSearch.toLowerCase());
            const matchState = selectedStates.length === 0 || selectedStates.includes(b.state_name);
            const matchCity = selectedCities.length === 0 || selectedCities.includes(b.city);
            return matchSearch && matchState && matchCity;
        });
    }, [branches, branchSearch, selectedStates, selectedCities]);

    if (!isOpen) return null;

    const isEdit = !!mapping;

    const handleToggleBranch = (branchId) => {
        setSelectedBranchIds(prev =>
            prev.includes(branchId)
                ? prev.filter(id => id !== branchId)
                : [...prev, branchId]
        );
    };

    const handleSelectAllFiltered = () => {
        const filteredIds = filteredBranches.map(b => b.id);
        setSelectedBranchIds(prev => [...new Set([...prev, ...filteredIds])]);
    };

    const handleDeselectAllFiltered = () => {
        const filteredIds = filteredBranches.map(b => b.id);
        setSelectedBranchIds(prev => prev.filter(id => !filteredIds.includes(id)));
    };

    const getBranchLabel = () => {
        if (selectedBranchIds.length === 0) return "Select branches";
        if (selectedBranchIds.length === branches.length) return "All Branches Selected";
        return `${selectedBranchIds.length} branch(es) selected`;
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!selectedAbmId) {
            toast.error("Please select an ABM User");
            return;
        }
        onSave({
            abmUserId: selectedAbmId,
            branchIds: selectedBranchIds,
            oldAbmUserId: isEdit ? mapping.abm_user_id : null
        });
    };

    return (
        <div className="fixed inset-0 z-[1000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl w-full max-w-[900px] mx-auto shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
                {/* Modal Header */}
                <div className="px-6 py-5 flex items-center justify-between bg-gradient-to-r from-[#6804a1] to-[#8a0cd2] text-white rounded-t-2xl">
                    <div>
                        <h2 className="m-0 text-lg font-bold">{isEdit ? "Edit ABM Branch Mapping" : "Create ABM Branch Mapping"}</h2>
                        <p className="mt-1 text-xs text-white/80">{isEdit ? "Update branches mapped to this ABM" : "Map branches to a selected ABM"}</p>
                    </div>
                    <button onClick={onClose} className="bg-white/10 hover:bg-white/20 border-none rounded-lg w-8 h-8 cursor-pointer flex items-center justify-center text-white transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-[16px] h-[16px]">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Modal Body */}
                <form onSubmit={handleSubmit} className="divide-y divide-slate-100">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
                        {/* Left Column: Branch Dropdown Selector and Filters */}
                        <div className="flex flex-col space-y-4">
                            <div className="relative">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                    Map Branches <span className="text-rose-500">*</span>
                                </label>
                                <div
                                    className="w-full min-h-[42px] px-3.5 py-2.5 border border-slate-350 rounded-lg bg-white text-sm cursor-pointer flex justify-between items-center hover:border-slate-400 transition-colors"
                                    onClick={() => {
                                        setIsBranchDropdownOpen(!isBranchDropdownOpen);
                                        setIsStateFilterOpen(false);
                                        setIsCityFilterOpen(false);
                                    }}
                                >
                                    <span className={`truncate ${selectedBranchIds.length > 0 ? "text-slate-800 font-medium" : "text-slate-400"}`}>
                                        {getBranchLabel()}
                                    </span>
                                    <svg className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${isBranchDropdownOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>

                                {isBranchDropdownOpen && (
                                    <div className="absolute z-50 mt-1.5 w-full bg-white border border-slate-200 rounded-xl shadow-xl p-4 space-y-3 animate-in fade-in slide-in-from-top-1 duration-150">
                                        {/* Search Input */}
                                        <div className="px-0 py-0" onClick={(e) => {
                                            e.stopPropagation();
                                            setIsStateFilterOpen(false);
                                            setIsCityFilterOpen(false);
                                        }}>
                                            <input
                                                type="text"
                                                placeholder="Search by name or code..."
                                                value={branchSearch}
                                                onChange={(e) => setBranchSearch(e.target.value)}
                                                className="w-full px-3 py-1.5 text-sm border border-slate-250 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#6804a1] focus:border-[#6804a1]"
                                            />
                                        </div>

                                        {/* State and City Filters */}
                                        <div className="grid grid-cols-2 gap-2" onClick={(e) => e.stopPropagation()}>
                                            {/* Multi-select State */}
                                            <div className="relative">
                                                <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1">State</label>
                                                <div
                                                    className="w-full min-h-[32px] px-2.5 py-1.5 border border-slate-250 rounded-lg bg-white text-xs cursor-pointer flex justify-between items-center hover:border-slate-350 transition-colors"
                                                    onClick={() => {
                                                        setIsStateFilterOpen(!isStateFilterOpen);
                                                        setIsCityFilterOpen(false);
                                                    }}
                                                >
                                                    <span className="truncate text-slate-700">
                                                        {selectedStates.length === 0 ? "All States" : `${selectedStates.length} selected`}
                                                    </span>
                                                    <svg className="w-3.5 h-3.5 text-slate-555" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                </div>
                                                {isStateFilterOpen && (
                                                    <div className="absolute z-[60] mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg p-2 max-h-40 overflow-y-auto space-y-1">
                                                        {uniqueStates.length === 0 ? (
                                                            <div className="text-[11px] text-slate-400 text-center py-2">No states</div>
                                                        ) : (
                                                            uniqueStates.map(state => (
                                                                <label key={state} className="flex items-center gap-2 p-1 hover:bg-slate-55 rounded cursor-pointer text-xs">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={selectedStates.includes(state)}
                                                                        onChange={() => {
                                                                            setSelectedStates(prev =>
                                                                                prev.includes(state)
                                                                                    ? prev.filter(s => s !== state)
                                                                                    : [...prev, state]
                                                                            );
                                                                            setSelectedCities([]); // reset city selection when states change
                                                                        }}
                                                                        className="h-3.5 w-3.5 text-[#6804a1] rounded border-slate-300 focus:ring-[#6804a1]"
                                                                    />
                                                                    <span className="text-slate-700 truncate">{state}</span>
                                                                </label>
                                                            ))
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Multi-select City */}
                                            <div className="relative">
                                                <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1">City</label>
                                                <div
                                                    className="w-full min-h-[32px] px-2.5 py-1.5 border border-slate-250 rounded-lg bg-white text-xs cursor-pointer flex justify-between items-center hover:border-slate-350 transition-colors"
                                                    onClick={() => {
                                                        setIsCityFilterOpen(!isCityFilterOpen);
                                                        setIsStateFilterOpen(false);
                                                    }}
                                                >
                                                    <span className="truncate text-slate-700">
                                                        {selectedCities.length === 0 ? "All Cities" : `${selectedCities.length} selected`}
                                                    </span>
                                                    <svg className="w-3.5 h-3.5 text-slate-555" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                </div>
                                                {isCityFilterOpen && (
                                                    <div className="absolute z-[60] mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg p-2 max-h-40 overflow-y-auto space-y-1">
                                                        {uniqueCities.length === 0 ? (
                                                            <div className="text-[11px] text-slate-400 text-center py-2">No cities</div>
                                                        ) : (
                                                            uniqueCities.map(city => (
                                                                <label key={city} className="flex items-center gap-2 p-1 hover:bg-slate-55 rounded cursor-pointer text-xs">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={selectedCities.includes(city)}
                                                                        onChange={() => {
                                                                            setSelectedCities(prev =>
                                                                                prev.includes(city)
                                                                                    ? prev.filter(c => c !== city)
                                                                                    : [...prev, city]
                                                                            );
                                                                        }}
                                                                        className="h-3.5 w-3.5 text-[#6804a1] rounded border-slate-300 focus:ring-[#6804a1]"
                                                                    />
                                                                    <span className="text-slate-700 truncate">{city}</span>
                                                                </label>
                                                            ))
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Select / Deselect Filtered Buttons */}
                                        <div className="flex justify-between items-center py-1.5 border-t border-b border-slate-100" onClick={(e) => {
                                            e.stopPropagation();
                                            setIsStateFilterOpen(false);
                                            setIsCityFilterOpen(false);
                                        }}>
                                            <button
                                                type="button"
                                                onClick={handleSelectAllFiltered}
                                                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 border-none bg-transparent cursor-pointer"
                                            >
                                                Select All Filtered
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleDeselectAllFiltered}
                                                className="text-[11px] font-bold text-rose-600 hover:text-rose-800 border-none bg-transparent cursor-pointer"
                                            >
                                                Deselect All Filtered
                                            </button>
                                        </div>

                                        {/* Branch Checklist */}
                                        <div className="max-h-48 overflow-y-auto space-y-1 pr-1" onClick={(e) => {
                                            e.stopPropagation();
                                            setIsStateFilterOpen(false);
                                            setIsCityFilterOpen(false);
                                        }}>
                                            {filteredBranches.length === 0 ? (
                                                <div className="text-xs text-slate-400 p-2 text-center">No active branches match filters</div>
                                            ) : (
                                                filteredBranches.map(b => (
                                                    <label key={b.id} className="flex items-center gap-2.5 p-2 hover:bg-slate-50 rounded-lg cursor-pointer text-sm text-slate-650 transition-colors">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedBranchIds.includes(b.id)}
                                                            onChange={() => handleToggleBranch(b.id)}
                                                            className="h-4 w-4 text-[#6804a1] border-slate-350 rounded focus:ring-[#6804a1]"
                                                        />
                                                        <div className="flex flex-col">
                                                            <span className="font-medium text-slate-800">{b.name}</span>
                                                            <span className="text-[11px] text-slate-400">{b.code} {b.city ? `- ${b.city}` : ""} {b.state_name ? `(${b.state_name})` : ""}</span>
                                                        </div>
                                                    </label>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Column: ABM Selection and Tag Previews */}
                        <div className="flex flex-col space-y-6">
                            {/* ABM Selector */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                    Select ABM <span className="text-rose-500">*</span>
                                </label>
                                <select
                                    value={selectedAbmId}
                                    onChange={(e) => setSelectedAbmId(e.target.value)}
                                    required
                                    className="w-full border border-slate-350 rounded-lg px-3.5 py-2.5 text-sm outline-none text-slate-800 focus:border-[#6804a1] transition-all bg-white cursor-pointer"
                                >
                                    <option value="">-- Select ABM --</option>
                                    {abms.map((abm) => (
                                        <option key={abm.id} value={abm.id}>
                                            {abm.name} ({abm.username})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Selection Preview tags */}
                            <div className="flex-1 flex flex-col min-h-[180px]">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                    Selected Branches ({selectedBranchIds.length})
                                </label>
                                <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3.5 max-h-[220px] overflow-y-auto">
                                    {selectedBranchIds.length === 0 ? (
                                        <p className="text-sm text-slate-400 italic text-center py-8">No branches selected yet.</p>
                                    ) : (
                                        <div className="flex flex-wrap gap-1.5">
                                            {selectedBranchIds.map(id => {
                                                const b = branches.find(item => item.id === id);
                                                if (!b) return null;
                                                return (
                                                    <span key={id} className="inline-flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 text-xs px-2.5 py-1.5 rounded-lg shadow-sm font-medium">
                                                        {b.name}
                                                        <button
                                                            type="button"
                                                            onClick={() => handleToggleBranch(id)}
                                                            className="text-slate-400 hover:text-red-500 font-bold border-none bg-transparent cursor-pointer p-0 leading-none text-sm"
                                                        >
                                                            &times;
                                                        </button>
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Modal Footer */}
                    <div className="px-6 py-4 flex justify-end gap-3 bg-slate-50 rounded-b-2xl">
                        <button type="button" onClick={onClose} disabled={saving}
                            className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-600 bg-white font-semibold text-xs cursor-pointer hover:bg-slate-100 transition-colors disabled:opacity-50">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving || !selectedAbmId || selectedBranchIds.length === 0}
                            className="px-6 py-2.5 rounded-lg border-none text-white font-bold text-xs transition-all bg-gradient-to-r from-[#6804a1] to-[#8a0cd2] shadow-[0_2px_8px_rgba(104,4,161,0.35)] cursor-pointer disabled:bg-slate-350 disabled:cursor-not-allowed disabled:shadow-none hover:opacity-95">
                            {saving ? "Saving…" : isEdit ? "Update Mapping" : "Create Mapping"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────
export default function ABMBranchMappingMaster() {
    const [mappings, setMappings] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedMapping, setSelectedMapping] = useState(null);

    const { hasPermission } = usePermission();

    const loadMappings = async () => {
        setLoading(true);
        setError("");
        try {
            const response = await getAllAbmMappings();
            setMappings(response.data?.data || []);
        } catch (err) {
            console.error("Failed to load ABM mappings:", err);
            setError("Unable to load ABM-Branch mappings. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadMappings();
    }, []);

    const handleSave = async (data) => {
        setSaving(true);
        try {
            await saveAbmBranchMapping(data);
            toast.success("ABM Branch mapping saved successfully");
            setIsModalOpen(false);
            setSelectedMapping(null);
            await loadMappings();
        } catch (err) {
            console.error("Failed to save ABM mapping:", err);
            toast.error(err?.response?.data?.message || "Unable to save mapping. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (abmUserId) => {
        if (!window.confirm("Are you sure you want to delete all branch mappings for this ABM?")) return;
        setSaving(true);
        try {
            await deleteAbmMapping(abmUserId);
            toast.success("ABM Branch mapping deleted successfully");
            await loadMappings();
        } catch (err) {
            console.error("Failed to delete ABM mapping:", err);
            toast.error(err?.response?.data?.message || "Unable to delete mapping.");
        } finally {
            setSaving(false);
        }
    };

    const columns = useMemo(() => {
        const cols = [
            {
                key: "abm_name",
                label: "ABM User",
                minWidth: "150px",
                render: (row) => (
                    <div className="flex flex-col">
                        <span className="font-bold text-slate-800 text-[14px]">{row.abm_name}</span>
                        <span className="text-[11px] text-slate-400 font-mono">{row.abm_username}</span>
                    </div>
                )
            },
            {
                key: "mapped_branches",
                label: "Mapped Branches",
                minWidth: "300px",
                render: (row) => {
                    const branchesList = row.mapped_branches || [];
                    return (
                        <div className="flex flex-wrap gap-1 py-1">
                            {branchesList.map((b, idx) => (
                                <span
                                    key={idx}
                                    className="inline-flex items-center text-[10px] font-bold bg-[#6804a1]/5 text-[#6804a1] border border-[#6804a1]/15 px-2 py-0.5 rounded-full"
                                >
                                    {b.branch_name}
                                </span>
                            ))}
                        </div>
                    );
                }
            }
        ];

        const canUpdate = hasPermission("abm_branch_mapping", "update");
        const canDelete = hasPermission("abm_branch_mapping", "delete");

        if (canUpdate || canDelete) {
            cols.push({
                key: "actions",
                label: "Actions",
                sortable: false,
                minWidth: "100px",
                render: (row) => (
                    <div className="flex items-center gap-2">
                        {canUpdate && (
                            <button
                                onClick={() => {
                                    setSelectedMapping(row);
                                    setIsModalOpen(true);
                                }}
                                className="flex w-8 h-8 items-center justify-center rounded-lg border border-purple-200 bg-purple-50 text-indigo-650 cursor-pointer hover:bg-purple-100 transition-colors"
                                title="Edit Mapping"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-[15px] h-[15px]">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931Z" />
                                </svg>
                            </button>
                        )}
                        {canDelete && (
                            <button
                                onClick={() => handleDelete(row.abm_user_id)}
                                className="flex w-8 h-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 cursor-pointer hover:bg-rose-100 transition-colors"
                                title="Delete Mapping"
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
    }, [hasPermission]);

    return (
        <div className="flex flex-col flex-1 bg-slate-50 font-sans min-h-screen">
            <Navbar title="ERP Admin" />

            <AbmBranchMappingModal
                isOpen={isModalOpen}
                mapping={selectedMapping}
                onClose={() => {
                    setIsModalOpen(false);
                    setSelectedMapping(null);
                }}
                onSave={handleSave}
                saving={saving}
            />

            <main className="flex-1 flex flex-col w-full mx-auto px-6 sm:px-8 py-8">
                {error && (
                    <div className="bg-rose-50 border border-rose-200 text-rose-750 px-4 py-3 rounded-lg mb-6 text-sm font-semibold">
                        {error}
                    </div>
                )}

                <DataTable
                    tableId="abm_branch_mapping"
                    title="ABM Branch Mapping Master"
                    data={mappings}
                    columns={columns}
                    loading={loading}
                    searchPlaceholder="Search mappings by ABM name..."
                    actionButton={
                        hasPermission("abm_branch_mapping", "write") ? (
                            <button
                                onClick={() => {
                                    setSelectedMapping(null);
                                    setIsModalOpen(true);
                                }}
                                className="flex w-10 h-10 items-center justify-center rounded-[9px] bg-gradient-to-br from-[#6804a1] to-[#8a0cd2] text-white border-none cursor-pointer shadow-[0_2px_8px_rgba(104,4,161,0.35)] hover:opacity-95 transition-opacity"
                                title="Create Mapping"
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

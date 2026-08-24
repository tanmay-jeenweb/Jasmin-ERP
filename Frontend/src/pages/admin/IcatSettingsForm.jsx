import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import { getIcatSettings, saveIcatSettings } from "../../api/settingApi";
import toast from "react-hot-toast";

export default function IcatSettingsForm() {
    const navigate = useNavigate();
    const [icats, setIcats] = useState([]);
    const [checkedMap, setCheckedMap] = useState({});
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const loadSettings = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await getIcatSettings();
            if (res.data?.success) {
                setIcats(res.data.icats || []);
                setCheckedMap(res.data.settings || {});
            } else {
                setError(res.data?.message || "Failed to load ICAT settings.");
            }
        } catch (err) {
            console.error("Failed to load settings:", err);
            setError("Unable to connect to settings API. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSettings();
    }, []);

    const toggleCheckbox = (icat) => {
        setCheckedMap(prev => {
            const currentVal = prev[icat] !== false; // default to true if undefined
            return {
                ...prev,
                [icat]: !currentVal
            };
        });
    };

    const handleSelectAll = () => {
        const newMap = {};
        icats.forEach(icat => {
            newMap[icat] = true;
        });
        setCheckedMap(newMap);
        toast.success("All classifications enabled in view state");
    };

    const handleDeselectAll = () => {
        const newMap = {};
        icats.forEach(icat => {
            newMap[icat] = false;
        });
        setCheckedMap(newMap);
        toast.success("All classifications disabled in view state");
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await saveIcatSettings(checkedMap);
            if (res.data?.success) {
                toast.success("Settings saved successfully!");
            } else {
                toast.error(res.data?.message || "Failed to save settings.");
            }
        } catch (err) {
            console.error("Failed to save settings:", err);
            toast.error(err?.response?.data?.message || "An error occurred while saving.");
        } finally {
            setSaving(false);
        }
    };

    // Filter ICATs based on search input
    const filteredIcats = icats.filter(icat => 
        String(icat || "").toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex flex-col flex-1 bg-slate-50 font-sans min-h-screen">
            <Navbar title="ERP Admin" />

            <main className="flex-1 flex flex-col w-full mx-auto px-6 sm:px-8 py-7">
                {/* Header Section */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#6804a1] to-[#4c0275] flex items-center justify-center text-white shadow-[0_3px_10px_rgba(104,4,161,0.2)] shrink-0">
                            <i className="fa-solid fa-sliders text-lg"></i>
                        </div>
                        <div>
                            <h1 className="m-0 text-xl font-extrabold text-slate-900">Settings Master</h1>
                            <p className="mt-0.5 text-[13px] text-slate-500">
                                Configure which item classification types (ICAT) are displayed across all price list pages. Unchecked ICATs will be hidden.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => navigate("/admin/home")}
                        className="text-slate-500 hover:text-slate-700 font-medium text-sm flex items-center gap-1 transition-colors cursor-pointer bg-transparent border-none outline-none focus:outline-none"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                            stroke="currentColor"
                            className="w-4 h-4"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                        </svg>
                        Back to List
                    </button>
                </div>

                {error && (
                    <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3.5 rounded-xl mb-6 text-sm font-medium flex items-center gap-2">
                        <i className="fa-solid fa-circle-exclamation text-rose-500 text-base"></i>
                        {error}
                    </div>
                )}

                {/* Form Card */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_2px_12px_rgba(0,0,0,0.03)] overflow-hidden flex flex-col flex-1">
                    
                    {/* Controls Bar */}
                    <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-slate-50/60">
                        {/* Search Input */}
                        <div className="relative flex-1 max-w-md">
                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                <i className="fa-solid fa-magnifying-glass text-sm"></i>
                            </span>
                            <input
                                type="text"
                                placeholder="Filter classifications..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full border border-slate-300 bg-white rounded-xl pl-9 pr-4 py-2 text-sm outline-none text-slate-800 placeholder:text-slate-450 focus:border-[#6804a1] focus:ring-1 focus:ring-[#6804a1] transition-all"
                            />
                        </div>

                        {/* Toggles */}
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={handleSelectAll}
                                disabled={loading || icats.length === 0}
                                className="flex-1 sm:flex-initial px-4 py-2 border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white text-xs font-semibold rounded-lg transition-colors cursor-pointer select-none"
                            >
                                Enable All
                            </button>
                            <button
                                type="button"
                                onClick={handleDeselectAll}
                                disabled={loading || icats.length === 0}
                                className="flex-1 sm:flex-initial px-4 py-2 border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white text-xs font-semibold rounded-lg transition-colors cursor-pointer select-none"
                            >
                                Disable All
                            </button>
                        </div>
                    </div>

                    {/* Content Body */}
                    <div className="p-6 flex-1">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-3">
                                <div className="w-10 h-10 border-4 border-slate-200 border-t-[#6804a1] rounded-full animate-spin"></div>
                                <p className="text-slate-500 text-sm font-medium animate-pulse">Loading settings...</p>
                            </div>
                        ) : icats.length === 0 ? (
                            <div className="text-center py-20">
                                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400 text-2xl mb-4">
                                    <i className="fa-solid fa-cubes-stacked"></i>
                                </div>
                                <h3 className="text-slate-700 font-bold text-base">No Classifications Found</h3>
                                <p className="text-slate-450 text-sm mt-1 max-w-sm mx-auto">
                                    No classifications were retrieved from the Model Master. Please sync models first under the Model Master section.
                                </p>
                            </div>
                        ) : filteredIcats.length === 0 ? (
                            <div className="text-center py-20">
                                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-450 text-xl mb-4">
                                    <i className="fa-solid fa-magnifying-glass"></i>
                                </div>
                                <h3 className="text-slate-700 font-bold text-base">No matching results</h3>
                                <p className="text-slate-450 text-sm mt-1">
                                    Try adjusting your filter search keywords.
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                                {filteredIcats.map((icat) => {
                                    const isChecked = checkedMap[icat] !== false;
                                    return (
                                        <div
                                            key={icat}
                                            onClick={() => toggleCheckbox(icat)}
                                            className={`group flex items-center justify-between p-4 rounded-xl border-[1.5px] cursor-pointer transition-all duration-200 select-none ${
                                                isChecked
                                                    ? "border-[#6804a1] bg-[#6804a1]/[0.03] text-[#6804a1] shadow-[0_2px_8px_rgba(104,4,161,0.06)]"
                                                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-350 hover:bg-slate-50/50"
                                            }`}
                                        >
                                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                                <div className={`w-5 h-5 rounded flex items-center justify-center border transition-all duration-150 shrink-0 ${
                                                    isChecked
                                                        ? "bg-[#6804a1] border-[#6804a1] text-white shadow-sm"
                                                        : "border-slate-350 bg-white text-transparent group-hover:border-slate-400"
                                                }`}>
                                                    <i className="fa-solid fa-check text-[10px] stroke-[3px]"></i>
                                                </div>
                                                <span className={`text-sm font-semibold truncate ${isChecked ? "text-[#530282] font-bold" : "text-slate-700"}`}>
                                                    {icat}
                                                </span>
                                            </div>
                                            
                                            {/* Status Badge */}
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 transition-colors ${
                                                isChecked 
                                                    ? "bg-[#6804a1]/10 text-[#6804a1]" 
                                                    : "bg-slate-100 text-slate-500"
                                            }`}>
                                                {isChecked ? "Visible" : "Hidden"}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Footer Actions */}
                    <div className="px-6 py-4.5 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                        <span className="text-xs font-semibold text-slate-500">
                            {!loading && `Showing ${filteredIcats.length} of ${icats.length} classifications (${Object.values(checkedMap).filter(v => v === false).length} excluded)`}
                        </span>
                        
                        <div className="flex gap-3 w-full sm:w-auto">
                            <button
                                type="button"
                                onClick={loadSettings}
                                disabled={loading || saving}
                                className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl border border-slate-300 text-slate-600 bg-white font-semibold text-sm cursor-pointer hover:bg-slate-50 transition-colors disabled:opacity-50"
                            >
                                Reset
                            </button>
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={loading || saving || icats.length === 0}
                                className="flex-1 sm:flex-initial px-6 py-2.5 rounded-xl border-none text-white font-bold text-sm bg-gradient-to-br from-[#6804a1] to-[#4c0275] hover:opacity-95 shadow-[0_3px_10px_rgba(104,4,161,0.3)] disabled:bg-slate-400 disabled:shadow-none disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer"
                            >
                                {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                                {saving ? "Saving..." : "Save Settings"}
                            </button>
                        </div>
                    </div>

                </div>
            </main>
        </div>
    );
}

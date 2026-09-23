import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import DataTable from "../../components/DataTable";
import {
    getTickets,
    getTicketDetails,
    addTicketRemark,
    shiftTicket,
    completeTicket,
    getTicketFormOptions,
    getTicketStats
} from "../../api/ticketApi";
import toast from "react-hot-toast";

// Helper for image URLs
const getImageUrl = (imageVal) => {
    if (!imageVal) return "";
    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5005/v1/api";
    const backendOrigin = import.meta.env.VITE_BACKEND_URL || apiUrl.replace(/\/v1\/api\/?$/, "");
    const cleanBase = backendOrigin.endsWith("/") ? backendOrigin.slice(0, -1) : backendOrigin;

    if (typeof imageVal === "string" && (imageVal.startsWith("http://") || imageVal.startsWith("https://"))) {
        // If frontend is running locally (localhost) and image URL points to remote production server,
        // rewrite it to the local backend origin so locally uploaded images render correctly:
        if (typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) {
            if (imageVal.includes("interlink.jasminmobile.com/uploads/")) {
                const filename = imageVal.split("/uploads/").pop();
                return `${cleanBase}/uploads/${filename}`;
            }
        }
        return imageVal;
    }

    const cleanName = imageVal.startsWith("/") ? imageVal.slice(1) : imageVal;
    return `${cleanBase}/uploads/${cleanName}`;
};

// Format timestamps
const formatDateTime = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
};

export default function TicketList() {
    const navigate = useNavigate();

    // Data states
    const [tickets, setTickets] = useState([]);
    const [stats, setStats] = useState({
        total: 0,
        active_count: 0,
        history_count: 0,
        assigned_to_me_active: 0
    });
    const [userMeta, setUserMeta] = useState({
        currentUserId: null,
        isAdmin: false,
        hasTicketManagement: false
    });

    // Filter states
    const [activeTab, setActiveTab] = useState("active"); // 'active' or 'history'
    const [ownershipFilter, setOwnershipFilter] = useState("ALL"); // 'ALL', 'MINE', 'ASSIGNED'
    const [selectedTicketTypeFilter, setSelectedTicketTypeFilter] = useState("");
    const [formOptions, setFormOptions] = useState({ ticket_types: [], sub_ticket_types: [] });

    // Loading states
    const [loadingTickets, setLoadingTickets] = useState(false);

    // Modal states
    const [selectedTicketId, setSelectedTicketId] = useState(null);
    const [ticketDetails, setTicketDetails] = useState(null);
    const [loadingDetails, setLoadingDetails] = useState(false);

    // New remark state
    const [newRemarkText, setNewRemarkText] = useState("");
    const [submittingRemark, setSubmittingRemark] = useState(false);

    // Shift modal states
    const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
    const [shiftTicketTarget, setShiftTicketTarget] = useState(null);
    const [shiftTicketTypeId, setShiftTicketTypeId] = useState("");
    const [shiftSubTicketTypeId, setShiftSubTicketTypeId] = useState("");
    const [shiftReason, setShiftReason] = useState("");
    const [shifting, setShifting] = useState(false);

    // Complete confirmation modal states
    const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
    const [resolutionRemark, setResolutionRemark] = useState("");
    const [completing, setCompleting] = useState(false);

    // Lightbox modal state
    const [activeLightboxImage, setActiveLightboxImage] = useState(null);

    // Load Form Options & Stats
    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const [optRes, statsRes] = await Promise.all([
                    getTicketFormOptions(),
                    getTicketStats()
                ]);
                if (optRes.data?.success) {
                    setFormOptions(optRes.data.data);
                }
                if (statsRes.data?.success) {
                    setStats(statsRes.data.data);
                }
            } catch (err) {
                console.error("Failed to load initial ticket metadata:", err);
            }
        };
        loadInitialData();
    }, []);

    // Load Tickets based on activeTab
    const loadTickets = useCallback(async () => {
        setLoadingTickets(true);
        try {
            const res = await getTickets({
                tab: activeTab,
                ticket_type_id: selectedTicketTypeFilter || undefined
            });
            if (res.data?.success) {
                setTickets(res.data.data || []);
                if (res.data.userMeta) {
                    setUserMeta(res.data.userMeta);
                }
            }
            // Refresh stats
            const statsRes = await getTicketStats();
            if (statsRes.data?.success) {
                setStats(statsRes.data.data);
            }
        } catch (err) {
            console.error("Failed to load tickets:", err);
            toast.error("Failed to load tickets.");
        } finally {
            setLoadingTickets(false);
        }
    }, [activeTab, selectedTicketTypeFilter]);

    useEffect(() => {
        loadTickets();
    }, [loadTickets]);

    // Open ticket details modal
    const handleOpenTicket = async (ticketId) => {
        setSelectedTicketId(ticketId);
        setLoadingDetails(true);
        try {
            const res = await getTicketDetails(ticketId);
            if (res.data?.success) {
                setTicketDetails(res.data.data);
            } else {
                toast.error("Failed to load ticket details.");
                setSelectedTicketId(null);
            }
        } catch (err) {
            console.error("Failed to fetch ticket details:", err);
            toast.error(err.response?.data?.message || "Failed to fetch ticket details.");
            setSelectedTicketId(null);
        } finally {
            setLoadingDetails(false);
        }
    };

    // Close details modal
    const handleCloseDetails = () => {
        setSelectedTicketId(null);
        setTicketDetails(null);
        setNewRemarkText("");
        setIsShiftModalOpen(false);
        setShiftTicketTarget(null);
        setIsCompleteModalOpen(false);
    };

    // Submit a new remark
    const handleAddRemark = async (e) => {
        e.preventDefault();
        if (!newRemarkText.trim() || !selectedTicketId) return;

        setSubmittingRemark(true);
        try {
            const res = await addTicketRemark(selectedTicketId, { remark: newRemarkText.trim() });
            if (res.data?.success) {
                toast.success("Remark added successfully.");
                setNewRemarkText("");
                // Refresh remarks thread
                setTicketDetails((prev) => ({
                    ...prev,
                    remarks_thread: res.data.data,
                    remarks: newRemarkText.trim()
                }));
                loadTickets();
            }
        } catch (err) {
            console.error("Failed to add remark:", err);
            toast.error(err.response?.data?.message || "Failed to add remark.");
        } finally {
            setSubmittingRemark(false);
        }
    };

    // Direct Open Shift / Change Ownership Modal from row (does NOT open details modal)
    const handleOpenShiftModalDirect = (ticket) => {
        setShiftTicketTarget(ticket);
        setShiftTicketTypeId(String(ticket.ticket_type_id || ""));
        setShiftSubTicketTypeId("");
        setShiftReason("");
        setIsShiftModalOpen(true);
    };

    // Shift modal open from details modal
    const handleOpenShiftModal = () => {
        if (!ticketDetails) return;
        setShiftTicketTarget(ticketDetails);
        setShiftTicketTypeId(String(ticketDetails.ticket_type_id || ""));
        setShiftSubTicketTypeId("");
        setShiftReason("");
        setIsShiftModalOpen(true);
    };

    // Close Shift modal
    const handleCloseShiftModal = () => {
        setIsShiftModalOpen(false);
        setShiftTicketTarget(null);
        setShiftTicketTypeId("");
        setShiftSubTicketTypeId("");
        setShiftReason("");
    };

    // Sub ticket types for Shift dialog
    const shiftSubTickets = useMemo(() => {
        if (!shiftTicketTypeId) return [];
        return formOptions.sub_ticket_types.filter(
            (st) => String(st.ticket_type_id) === String(shiftTicketTypeId)
        );
    }, [formOptions.sub_ticket_types, shiftTicketTypeId]);

    // Submit Shift
    const handleConfirmShift = async (e) => {
        e.preventDefault();
        const targetId = shiftTicketTarget?.id || selectedTicketId;
        if (!targetId) return;

        if (!shiftTicketTypeId || !shiftSubTicketTypeId) {
            toast.error("Please select both Ticket Type and Sub Ticket Type.");
            return;
        }

        setShifting(true);
        try {
            const res = await shiftTicket(targetId, {
                new_ticket_type_id: shiftTicketTypeId,
                new_sub_ticket_type_id: shiftSubTicketTypeId,
                reason_remark: shiftReason.trim()
            });

            if (res.data?.success) {
                toast.success("Ticket ownership updated successfully.");
                handleCloseShiftModal();
                if (selectedTicketId && selectedTicketId === targetId) {
                    setTicketDetails(res.data.data);
                }
                loadTickets();
            }
        } catch (err) {
            console.error("Failed to shift ticket:", err);
            toast.error(err.response?.data?.message || "Failed to shift ticket.");
        } finally {
            setShifting(false);
        }
    };

    // Submit Complete
    const handleConfirmComplete = async () => {
        setCompleting(true);
        try {
            const res = await completeTicket(selectedTicketId, {
                resolution_remark: resolutionRemark.trim()
            });

            if (res.data?.success) {
                toast.success("Ticket marked as Completed and moved to History!");
                setIsCompleteModalOpen(false);
                handleCloseDetails();
                loadTickets();
            }
        } catch (err) {
            console.error("Failed to complete ticket:", err);
            toast.error(err.response?.data?.message || "Failed to complete ticket.");
        } finally {
            setCompleting(false);
        }
    };

    // Process and filter tickets for DataTable
    const processedTickets = useMemo(() => {
        return tickets
            .filter((t) => {
                // Ownership filter
                if (ownershipFilter === "MINE") {
                    if (String(t.created_by) !== String(userMeta.currentUserId)) return false;
                } else if (ownershipFilter === "ASSIGNED") {
                    const isAssigned = (t.assigned_to || []).some(
                        (id) => String(id) === String(userMeta.currentUserId)
                    );
                    if (!isAssigned) return false;
                }

                // Ticket Type filter
                if (selectedTicketTypeFilter && String(t.ticket_type_id) !== String(selectedTicketTypeFilter)) {
                    return false;
                }

                return true;
            })
            .map((t) => ({
                ...t,
                assigned_names: (t.assigned_users || []).map((u) => u.name).join(", "),
                created_at_formatted: formatDateTime(t.created_at)
            }));
    }, [tickets, ownershipFilter, selectedTicketTypeFilter, userMeta.currentUserId]);

    // DataTable columns definition
    const columns = useMemo(() => [
        {
            key: "ticket_no",
            label: "Ticket #",
            minWidth: "140px",
            render: (row) => (
                <div className="flex flex-col gap-1">
                    <button
                        type="button"
                        onClick={() => handleOpenTicket(row.id)}
                        className="font-mono text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded border border-indigo-200 w-fit text-left cursor-pointer transition-colors"
                    >
                        {row.ticket_no}
                    </button>
                    {row.images && row.images.length > 0 && (
                        <span className="text-[11px] text-slate-500 font-medium">
                            {row.images.length} attachment{row.images.length > 1 ? "s" : ""}
                        </span>
                    )}
                </div>
            )
        },
        {
            key: "title",
            label: "Subject & Description",
            minWidth: "240px",
            render: (row) => (
                <div
                    onClick={() => handleOpenTicket(row.id)}
                    className="cursor-pointer group"
                >
                    <div className="font-semibold text-slate-900 text-sm group-hover:text-blue-900 transition-colors line-clamp-1">
                        {row.title}
                    </div>
                    <div className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                        {row.description}
                    </div>
                </div>
            )
        },
        {
            key: "ticket_type_name",
            label: "Category & Subtype",
            minWidth: "160px",
            render: (row) => (
                <div className="flex flex-col items-start gap-1">
                    <span className="text-xs font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {row.ticket_type_name || "General"}
                    </span>
                    <span className="text-[11px] font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-100">
                        {row.sub_ticket_type_name || "General"}
                    </span>
                </div>
            )
        },
        {
            key: "creator_name",
            label: "Raised By",
            minWidth: "150px",
            render: (row) => (
                <div>
                    <div className="font-semibold text-slate-900 text-xs flex items-center gap-1.5">
                        {row.creator_name}
                        {String(row.created_by) === String(userMeta.currentUserId) && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700">
                                You
                            </span>
                        )}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                        {formatDateTime(row.created_at)}
                    </div>
                </div>
            )
        },
        {
            key: "assigned_names",
            label: "Assigned Resolvers",
            minWidth: "170px",
            sortable: false,
            render: (row) => (
                <div className="flex flex-wrap items-center gap-1">
                    {row.assigned_users && row.assigned_users.length > 0 ? (
                        row.assigned_users.map((au) => (
                            <span
                                key={au.id}
                                className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                                    String(au.id) === String(userMeta.currentUserId)
                                        ? "bg-purple-100 text-purple-800 border-purple-200"
                                        : "bg-slate-50 text-slate-700 border-slate-200"
                                }`}
                            >
                                {au.name}
                            </span>
                        ))
                    ) : (
                        <span className="text-xs text-slate-400 italic">Unassigned</span>
                    )}
                </div>
            )
        },
        {
            key: "status",
            label: "Status",
            minWidth: "110px",
            render: (row) => (
                <div>
                    {row.status === "COMPLETED" ? (
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Completed
                        </span>
                    ) : (
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            Open
                        </span>
                    )}
                </div>
            )
        },
        {
            key: "actions",
            label: "Actions",
            minWidth: "120px",
            sortable: false,
            render: (row) => {
                const isCompleted = row.status === "COMPLETED";
                const isResolver = Array.isArray(row.assigned_to) && row.assigned_to.some(aid => String(aid) === String(userMeta.currentUserId));
                const canShiftRow = !isCompleted && (userMeta.isAdmin || userMeta.hasTicketManagement || isResolver);

                return (
                    <div className="flex items-center gap-1.5">
                        {canShiftRow && (
                            <button
                                type="button"
                                onClick={() => handleOpenShiftModalDirect(row)}
                                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors cursor-pointer"
                                title="Change ticket ownership by shifting category"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-3.5 h-3.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                                </svg>
                                <span>Shift</span>
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => handleOpenTicket(row.id)}
                            className="flex w-8 h-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-purple-50 hover:text-[#6804a1] hover:border-purple-300 transition-colors cursor-pointer"
                            title="View Ticket Details"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                            </svg>
                        </button>
                    </div>
                );
            }
        }
    ], [userMeta]);

    return (
        <div className="flex flex-col flex-1 bg-slate-50 font-sans min-h-screen text-slate-800">
            <Navbar />

            <main className="flex-1 flex flex-col w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Tabs Bar: Active / History */}
                <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setActiveTab("active")}
                            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
                                activeTab === "active"
                                    ? "bg-[#6804a1] text-white shadow-sm"
                                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                            }`}
                        >
                            <span>Active Tickets</span>
                            <span className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${
                                activeTab === "active" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"
                            }`}>
                                {stats.active_count || 0}
                            </span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab("history")}
                            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
                                activeTab === "history"
                                    ? "bg-[#6804a1] text-white shadow-sm"
                                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                            }`}
                        >
                            <span>History (Completed)</span>
                            <span className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${
                                activeTab === "history" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"
                            }`}>
                                {stats.history_count || 0}
                            </span>
                        </button>
                    </div>
                </div>

                {/* Main DataTable */}
                <DataTable
                    tableId="support_tickets_table"
                    title="Support Tickets"
                    data={processedTickets}
                    columns={columns}
                    loading={loadingTickets}
                    searchPlaceholder="Search tickets..."
                    toggleActions={
                        <>
                            {/* Ticket Type Filter */}
                            <select
                                value={selectedTicketTypeFilter}
                                onChange={(e) => setSelectedTicketTypeFilter(e.target.value)}
                                className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 outline-none focus:border-[#6804a1] cursor-pointer"
                            >
                                <option value="">All Ticket Types</option>
                                {formOptions.ticket_types.map((tt) => (
                                    <option key={tt.id} value={tt.id}>
                                        {tt.name}
                                    </option>
                                ))}
                            </select>

                            {/* Ownership Segment Filter */}
                            <div className="flex items-center h-10 bg-slate-100 border border-slate-200 p-0.5 rounded-lg text-xs font-semibold">
                                <button
                                    type="button"
                                    onClick={() => setOwnershipFilter("ALL")}
                                    className={`h-full px-2.5 sm:px-3 rounded-md transition-all cursor-pointer flex items-center ${
                                        ownershipFilter === "ALL" ? "bg-white text-slate-900 font-bold shadow-xs border border-slate-200/80" : "text-slate-500 hover:text-slate-900"
                                    }`}
                                >
                                    All Visible
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setOwnershipFilter("MINE")}
                                    className={`h-full px-2.5 sm:px-3 rounded-md transition-all cursor-pointer flex items-center ${
                                        ownershipFilter === "MINE" ? "bg-white text-slate-900 font-bold shadow-xs border border-slate-200/80" : "text-slate-500 hover:text-slate-900"
                                    }`}
                                >
                                    Raised by Me
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setOwnershipFilter("ASSIGNED")}
                                    className={`h-full px-2.5 sm:px-3 rounded-md transition-all cursor-pointer flex items-center ${
                                        ownershipFilter === "ASSIGNED" ? "bg-white text-slate-900 font-bold shadow-xs border border-slate-200/80" : "text-slate-500 hover:text-slate-900"
                                    }`}
                                >
                                    Assigned to Me
                                </button>
                            </div>

                            {/* Refresh Button */}
                            <button
                                type="button"
                                onClick={loadTickets}
                                disabled={loadingTickets}
                                title="Refresh tickets"
                                className="h-10 w-10 inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer disabled:opacity-50"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className={`w-4 h-4 ${loadingTickets ? "animate-spin" : ""}`}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                                </svg>
                            </button>
                        </>
                    }
                    actionButton={
                        <button
                            type="button"
                            onClick={() => navigate("/tickets/create")}
                            className="flex w-10 h-10 items-center justify-center rounded-[9px] bg-gradient-to-br from-indigo-600 to-[#6804a1] hover:from-indigo-700 hover:to-[#570387] text-white border-none cursor-pointer shadow-[0_2px_8px_rgba(104,4,161,0.35)] hover:opacity-95 transition-opacity"
                            title="Raise New Ticket"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-[18px] h-[18px]">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                            </svg>
                        </button>
                    }
                />

                {/* ============================================================== */}
                {/* TICKET DETAILS MODAL                                          */}
                {/* ============================================================== */}
                {selectedTicketId && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
                        <div
                            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Modal Header */}
                            <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 to-[#6804a1] text-white flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-3">
                                    <span className="font-mono text-sm font-bold bg-white/20 px-2.5 py-1 rounded-lg">
                                        {ticketDetails?.ticket_no || "Ticket"}
                                    </span>
                                    {ticketDetails?.status === "COMPLETED" ? (
                                        <span className="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-bold bg-emerald-500 text-white shadow-sm">
                                            Completed
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-400 text-slate-950 shadow-sm">
                                            Open
                                        </span>
                                    )}
                                </div>

                                <button
                                    onClick={handleCloseDetails}
                                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer text-sm"
                                >
                                    ✕
                                </button>
                            </div>

                            {/* Locked Banner if Ticket is Completed */}
                            {ticketDetails?.status === "COMPLETED" && (
                                <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-2.5 text-xs text-emerald-800 font-semibold flex items-center justify-between shrink-0">
                                    <span>
                                        This ticket is completed and locked. It cannot be edited.
                                    </span>
                                    {ticketDetails?.completed_by_name && (
                                        <span className="text-emerald-700 font-normal">
                                            Resolved by: <strong>{ticketDetails.completed_by_name}</strong> on {formatDateTime(ticketDetails.completed_at)}
                                        </span>
                                    )}
                                </div>
                            )}

                            {/* Modal Content (Scrollable) */}
                            <div className="p-6 overflow-y-auto space-y-6 flex-1">
                                {loadingDetails ? (
                                    <div className="py-16 text-center text-slate-400">
                                        <p className="text-sm font-medium">Loading ticket details...</p>
                                    </div>
                                ) : ticketDetails ? (
                                    <>
                                        {/* Title & Metadata Header */}
                                        <div>
                                            <h2 className="text-xl font-bold text-slate-900 leading-snug">
                                                {ticketDetails.title}
                                            </h2>
                                            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-2">
                                                <span>
                                                    Raised by: <strong className="text-slate-800">{ticketDetails.creator_name}</strong>
                                                </span>
                                                <span>•</span>
                                                <span>
                                                    {formatDateTime(ticketDetails.created_at)}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Category & Assignees Banner */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                                            <div>
                                                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                                    Category & Subtype
                                                </span>
                                                <p className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                                    <span className="text-indigo-600">{ticketDetails.ticket_type_name}</span>
                                                    <span className="text-slate-400 font-normal">/</span>
                                                    <span className="text-purple-700">{ticketDetails.sub_ticket_type_name}</span>
                                                </p>
                                            </div>

                                            <div>
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                                                        Assigned Resolvers (Owners)
                                                    </span>
                                                    {ticketDetails.permissions?.canShift && (
                                                        <button
                                                            type="button"
                                                            onClick={handleOpenShiftModal}
                                                            className="text-[11px] font-bold text-purple-700 hover:text-purple-900 bg-purple-100/70 hover:bg-purple-200 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                                                        >
                                                            Change Ownership
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {ticketDetails.assigned_users && ticketDetails.assigned_users.length > 0 ? (
                                                        ticketDetails.assigned_users.map((au) => (
                                                            <span
                                                                key={au.id}
                                                                className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-xs font-semibold text-slate-700 shadow-xs"
                                                            >
                                                                {au.name}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="text-xs text-slate-400 italic">No assigned resolvers</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Issue Description */}
                                        <div>
                                            <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                                                Description of Issue
                                            </h3>
                                            <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200 text-sm text-slate-800 leading-relaxed whitespace-pre-wrap font-normal">
                                                {ticketDetails.description}
                                            </div>
                                        </div>

                                        {/* Attached Images */}
                                        {ticketDetails.images && ticketDetails.images.length > 0 && (
                                            <div>
                                                <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center justify-between">
                                                    <span>Attached Images ({ticketDetails.images.length})</span>
                                                    <span className="text-[11px] text-indigo-600 font-normal">Click image to enlarge</span>
                                                </h3>
                                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                                                    {ticketDetails.images.map((imgName, idx) => {
                                                        const rawVal = (ticketDetails.image_urls && ticketDetails.image_urls[idx]) || imgName;
                                                        const imgUrl = getImageUrl(rawVal);
                                                        return (
                                                            <div
                                                                key={idx}
                                                                onClick={() => setActiveLightboxImage(imgUrl)}
                                                                className="group relative aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shadow-xs cursor-pointer hover:border-indigo-400 transition-all"
                                                            >
                                                                <img
                                                                    src={imgUrl}
                                                                    alt={`Attachment ${idx + 1}`}
                                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                                                    onError={(e) => {
                                                                        if (!e.currentTarget.dataset.triedLocal) {
                                                                            e.currentTarget.dataset.triedLocal = "true";
                                                                            const filename = imgName || (imgUrl.includes("/uploads/") ? imgUrl.split("/uploads/").pop() : imgUrl);
                                                                            const backendOrigin = import.meta.env.VITE_BACKEND_URL || "http://localhost:5005";
                                                                            e.currentTarget.src = `${backendOrigin.replace(/\/$/, "")}/uploads/${filename}`;
                                                                        }
                                                                    }}
                                                                />
                                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold">
                                                                    View
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {/* Remarks & History Activity Section */}
                                        <div>
                                            <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">
                                                Remarks & Activity Log
                                            </h3>

                                            {/* Remarks Timeline */}
                                            <div className="space-y-3">
                                                {ticketDetails.remarks_thread && ticketDetails.remarks_thread.length > 0 ? (
                                                    ticketDetails.remarks_thread.map((rm) => {
                                                        const isSenderCreator = String(rm.user_id) === String(ticketDetails.created_by);
                                                        const isSenderResolver = ticketDetails.assigned_to && ticketDetails.assigned_to.some(aid => String(aid) === String(rm.user_id));
                                                        const isMe = userMeta.currentUserId && String(rm.user_id) === String(userMeta.currentUserId);

                                                        return (
                                                            <div
                                                                key={rm.id}
                                                                className={`p-3.5 rounded-xl border text-xs leading-relaxed transition-all ${
                                                                    rm.action_type === "COMPLETED"
                                                                        ? "bg-emerald-50/70 border-emerald-200"
                                                                        : rm.action_type === "SHIFT"
                                                                        ? "bg-purple-50/70 border-purple-200"
                                                                        : isSenderCreator
                                                                        ? "bg-indigo-50/50 border-indigo-200/80"
                                                                        : isSenderResolver
                                                                        ? "bg-teal-50/50 border-teal-200/80"
                                                                        : "bg-slate-50 border-slate-200"
                                                                }`}
                                                            >
                                                                <div className="flex items-center justify-between mb-1.5">
                                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                                        <strong className="text-slate-900 font-semibold">{rm.user_name}</strong>
                                                                        {isMe && (
                                                                            <span className="text-[10px] text-indigo-600 font-bold bg-indigo-100/80 px-1.5 py-0.2 rounded-full">
                                                                                You
                                                                            </span>
                                                                        )}
                                                                        <span className="text-[10px] text-slate-400">({rm.user_role})</span>

                                                                        {/* Role & Action Badges */}
                                                                        {rm.action_type === "SHIFT" ? (
                                                                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-purple-100 text-purple-700">
                                                                                Shifted
                                                                            </span>
                                                                        ) : rm.action_type === "COMPLETED" ? (
                                                                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">
                                                                                Completed
                                                                            </span>
                                                                        ) : isSenderCreator ? (
                                                                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700">
                                                                                Requester
                                                                            </span>
                                                                        ) : isSenderResolver ? (
                                                                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-teal-100 text-teal-700">
                                                                                Resolver
                                                                            </span>
                                                                        ) : null}
                                                                    </div>
                                                                    <span className="text-[11px] text-slate-400 shrink-0">
                                                                        {formatDateTime(rm.created_at)}
                                                                    </span>
                                                                </div>
                                                                <p className="text-slate-800 whitespace-pre-wrap leading-relaxed">{rm.remark}</p>
                                                            </div>
                                                        );
                                                    })
                                                ) : (
                                                    <p className="text-xs text-slate-400 italic py-2">No remarks logged yet.</p>
                                                )}
                                            </div>

                                            {/* Add Remark Form (Available for Creator, Resolver, and Admin when ticket is not completed) */}
                                            {ticketDetails.permissions?.canAddRemark ? (
                                                <form onSubmit={handleAddRemark} className="mt-4 pt-3 border-t border-slate-100">
                                                    <div className="flex items-center justify-between mb-1.5">
                                                        <label className="block text-xs font-bold text-slate-700">
                                                            Reply / Add Message
                                                        </label>
                                                        <span className="text-[11px] text-slate-400">
                                                            Visible to requester and resolving team
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col sm:flex-row gap-2">
                                                        <textarea
                                                            value={newRemarkText}
                                                            onChange={(e) => setNewRemarkText(e.target.value)}
                                                            rows={2}
                                                            placeholder="Type your message, query, or update here..."
                                                            className="flex-1 p-2.5 border border-slate-300 rounded-xl text-xs outline-none text-slate-800 bg-white focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 leading-relaxed"
                                                        />
                                                        <button
                                                            type="submit"
                                                            disabled={submittingRemark || !newRemarkText.trim()}
                                                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer disabled:bg-slate-300 disabled:cursor-not-allowed shrink-0 h-fit"
                                                        >
                                                            {submittingRemark ? "Sending..." : "Send Message"}
                                                        </button>
                                                    </div>
                                                </form>
                                            ) : ticketDetails.status === "COMPLETED" ? (
                                                <div className="mt-4 p-3 rounded-xl bg-slate-100 border border-slate-200 text-slate-500 text-xs text-center font-medium flex items-center justify-center gap-2">
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-slate-400">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                                                    </svg>
                                                    <span>This ticket has been completed. The conversation is closed.</span>
                                                </div>
                                            ) : null}
                                        </div>
                                    </>
                                ) : null}
                            </div>

                            {/* Modal Footer / Actions Bar */}
                            {ticketDetails && ticketDetails.status !== "COMPLETED" && (
                                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
                                    <div className="flex items-center gap-2">
                                        {/* Shift / Change Ownership Button (Only for ticket management permission holders) */}
                                        {ticketDetails.permissions?.canShift && (
                                            <button
                                                type="button"
                                                onClick={handleOpenShiftModal}
                                                className="px-4 py-2 rounded-xl border border-purple-300 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs transition-all shadow-xs cursor-pointer"
                                            >
                                                Change Ownership / Shift Ticket
                                            </button>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {/* Mark as Completed Button */}
                                        {ticketDetails.permissions?.canComplete && (
                                            <button
                                                type="button"
                                                onClick={() => setIsCompleteModalOpen(true)}
                                                className="px-5 py-2 rounded-xl bg-[#6804a1] hover:bg-[#52037e] text-white font-bold text-xs shadow-md shadow-purple-900/20 transition-all cursor-pointer"
                                            >
                                                Mark as Completed
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={handleCloseDetails}
                                            className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
                                        >
                                            Close
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ============================================================== */}
                {/* SHIFT TICKET MODAL                                            */}
                {/* ============================================================== */}
                {isShiftModalOpen && (
                    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
                        <div
                            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="px-5 py-4 bg-[#6804a1] text-white flex items-center justify-between">
                                <h3 className="text-base font-bold">
                                    Change Ticket Ownership {shiftTicketTarget?.ticket_no ? `(${shiftTicketTarget.ticket_no})` : ""}
                                </h3>
                                <button
                                    onClick={handleCloseShiftModal}
                                    className="text-white/80 hover:text-white cursor-pointer"
                                >
                                    ✕
                                </button>
                            </div>

                            <form onSubmit={handleConfirmShift} className="p-5 space-y-4">
                                <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-900 leading-relaxed">
                                    <strong>How Ownership Works:</strong> Reassign this ticket to a new resolver team by selecting a new Ticket Type and Subticket Type. Ownership will automatically transfer to the team members configured for the selected subticket.
                                </div>

                                {/* Select New Ticket Type */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                        New Ticket Type <span className="text-rose-600">*</span>
                                    </label>
                                    <select
                                        value={shiftTicketTypeId}
                                        onChange={(e) => {
                                            setShiftTicketTypeId(e.target.value);
                                            setShiftSubTicketTypeId("");
                                        }}
                                        required
                                        className="w-full p-2.5 border border-slate-300 rounded-xl text-sm outline-none text-slate-800 bg-white focus:border-purple-600 cursor-pointer"
                                    >
                                        <option value="">-- Select Ticket Type --</option>
                                        {formOptions.ticket_types.map((tt) => (
                                            <option key={tt.id} value={tt.id}>
                                                {tt.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Select New Sub Ticket Type */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                        New Subticket Type <span className="text-rose-600">*</span>
                                    </label>
                                    <select
                                        value={shiftSubTicketTypeId}
                                        onChange={(e) => setShiftSubTicketTypeId(e.target.value)}
                                        required
                                        disabled={!shiftTicketTypeId}
                                        className="w-full p-2.5 border border-slate-300 rounded-xl text-sm outline-none text-slate-800 bg-white focus:border-purple-600 cursor-pointer disabled:bg-slate-100"
                                    >
                                        <option value="">-- Select Subticket Type --</option>
                                        {shiftSubTickets.map((st) => (
                                            <option key={st.id} value={st.id}>
                                                {st.name} {st.assigned_names ? `(${st.assigned_names})` : ""}
                                            </option>
                                        ))}
                                    </select>
                                    {(() => {
                                        const subMeta = shiftSubTickets.find((st) => String(st.id) === String(shiftSubTicketTypeId));
                                        if (!subMeta?.remark) return null;
                                        return (
                                            <div className="mt-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-amber-600 shrink-0 mt-0.5">
                                                    <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clipRule="evenodd" />
                                                </svg>
                                                <div className="flex-1">
                                                    <span className="font-bold text-amber-900 block text-[11px]">Subticket Instructions:</span>
                                                    <p className="text-amber-800 text-[11px] font-medium whitespace-pre-wrap mt-0.5">{subMeta.remark}</p>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>

                                {/* Shift Reason / Note */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                        Reason for Shifting <span className="text-slate-400 font-normal">(Optional)</span>
                                    </label>
                                    <textarea
                                        value={shiftReason}
                                        onChange={(e) => setShiftReason(e.target.value)}
                                        rows={2}
                                        placeholder="e.g. Issue pertains to Billing department, not Technical Support..."
                                        className="w-full p-2.5 border border-slate-300 rounded-xl text-xs outline-none text-slate-800 bg-white focus:border-purple-600"
                                    />
                                </div>

                                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                                    <button
                                        type="button"
                                        onClick={handleCloseShiftModal}
                                        className="px-4 py-2 border border-slate-300 rounded-xl text-slate-600 font-semibold text-xs hover:bg-slate-100 transition-colors cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={shifting || !shiftTicketTypeId || !shiftSubTicketTypeId}
                                        className="px-5 py-2 bg-[#6804a1] hover:bg-[#52037e] text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
                                    >
                                        {shifting ? "Updating Ownership..." : "Confirm & Change Ownership"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* ============================================================== */}
                {/* COMPLETE CONFIRMATION MODAL                                    */}
                {/* ============================================================== */}
                {isCompleteModalOpen && (
                    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
                        <div
                            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="px-5 py-4 bg-[#6804a1] text-white flex items-center justify-between">
                                <h3 className="text-base font-bold">
                                    Complete Support Ticket
                                </h3>
                                <button
                                    onClick={() => setIsCompleteModalOpen(false)}
                                    className="text-white/80 hover:text-white cursor-pointer"
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="p-5 space-y-4">
                                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs leading-relaxed">
                                    <span>
                                        Once marked as <strong>Completed</strong>, this ticket will move to the <strong>History</strong> tab and <strong>cannot be edited or reopened</strong> later.
                                    </span>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                        Resolution Remarks <span className="text-slate-400 font-normal">(Optional)</span>
                                    </label>
                                    <textarea
                                        value={resolutionRemark}
                                        onChange={(e) => setResolutionRemark(e.target.value)}
                                        rows={3}
                                        placeholder="Summary of how the issue was resolved..."
                                        className="w-full p-2.5 border border-slate-300 rounded-xl text-xs outline-none text-slate-800 bg-white focus:border-[#6804a1]"
                                    />
                                </div>

                                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                                    <button
                                        type="button"
                                        onClick={() => setIsCompleteModalOpen(false)}
                                        className="px-4 py-2 border border-slate-300 rounded-xl text-slate-600 font-semibold text-xs hover:bg-slate-100 transition-colors cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleConfirmComplete}
                                        disabled={completing}
                                        className="px-5 py-2 bg-[#6804a1] hover:bg-[#52037e] text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
                                    >
                                        {completing ? "Completing..." : "Yes, Complete Ticket"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ============================================================== */}
                {/* LIGHTBOX MODAL FOR IMAGES                                     */}
                {/* ============================================================== */}
                {activeLightboxImage && (
                    <div
                        className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200"
                        onClick={() => setActiveLightboxImage(null)}
                    >
                        <div
                            className="relative max-w-5xl max-h-[90vh] flex flex-col items-center justify-center"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <img
                                src={getImageUrl(activeLightboxImage)}
                                alt="Full preview"
                                className="max-w-full max-h-[82vh] object-contain rounded-xl shadow-2xl"
                                onError={(e) => {
                                    if (!e.currentTarget.dataset.triedLocal) {
                                        e.currentTarget.dataset.triedLocal = "true";
                                        const filename = activeLightboxImage.includes("/uploads/") ? activeLightboxImage.split("/uploads/").pop() : activeLightboxImage;
                                        const backendOrigin = import.meta.env.VITE_BACKEND_URL || "http://localhost:5005";
                                        e.currentTarget.src = `${backendOrigin.replace(/\/$/, "")}/uploads/${filename}`;
                                    }
                                }}
                            />
                            <div className="mt-3 flex items-center gap-3">
                                <a
                                    href={getImageUrl(activeLightboxImage)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-4 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-semibold backdrop-blur-xs transition-colors"
                                >
                                    Open Original
                                </a>
                                <button
                                    onClick={() => setActiveLightboxImage(null)}
                                    className="px-4 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-semibold backdrop-blur-xs transition-colors cursor-pointer"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

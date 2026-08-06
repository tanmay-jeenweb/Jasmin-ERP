import { useEffect, useState, useMemo } from "react";
import toast from "react-hot-toast";
import {
    getAllUsers,
    getPendingDevices,
    approveDevice,
    revokeDevice,
    fetchAuditLogs,
    toggleUserActive
} from "../../api/authApi";
import Navbar from "../../components/Navbar";
import DataTable from "../../components/DataTable";
import { useNavigate } from "react-router-dom";
import { usePermission } from "../../context/PermissionContext";

export default function AdminDashboard() {
    const navigate = useNavigate();
    const { hasPermission, loading: permissionLoading } = usePermission();
    const canReadUsers = hasPermission("user_master", "read");
    const canReadDevices = hasPermission("device_approval", "read");
    const user = useMemo(() => JSON.parse(localStorage.getItem("user") || "{}"), []);

    const [activeTab, setActiveTab] = useState("users");
    const [users, setUsers] = useState([]);
    const [pendingDevices, setPendingDevices] = useState([]);
    const [auditLogs, setAuditLogs] = useState([]);

    // Filter/Search states
    const [auditUserFilter, setAuditUserFilter] = useState("all");

    const [showInactive, setShowInactive] = useState(false);
    const [saving, setSaving] = useState(false);

    const fetchData = async () => {
        if (permissionLoading) return;
        try {
            const promises = [];
            if (canReadUsers) {
                promises.push(
                    getAllUsers(showInactive)
                        .then(res => ({ type: "users", data: res.data.users }))
                        .catch(err => { console.error("Error fetching users:", err); return null; })
                );
            }
            if (canReadDevices) {
                promises.push(
                    getPendingDevices()
                        .then(res => ({ type: "pending", data: res.data.devices }))
                        .catch(err => { console.error("Error fetching pending devices:", err); return null; })
                );
                promises.push(
                    fetchAuditLogs()
                        .then(res => ({ type: "audit", data: res.data.logs }))
                        .catch(err => { console.error("Error fetching audit logs:", err); return null; })
                );
            }

            const results = await Promise.all(promises);
            results.forEach(res => {
                if (!res) return;
                if (res.type === "users") setUsers(res.data);
                if (res.type === "pending") setPendingDevices(res.data);
                if (res.type === "audit") setAuditLogs(res.data);
            });
        } catch (error) {
            console.error("Error fetching data:", error);
            toast.error("Failed to load dashboard data");
        }
    };

    useEffect(() => {
        if (!permissionLoading) {
            if (canReadUsers) {
                setActiveTab("users");
            } else if (canReadDevices) {
                setActiveTab("pending");
            }
        }
    }, [permissionLoading, canReadUsers, canReadDevices]);

    useEffect(() => {
        fetchData();
    }, [showInactive, permissionLoading, canReadUsers, canReadDevices]);

    // Handlers
    const handleRevokeDevice = async (userId) => {
        if (!window.confirm("Are you sure you want to revoke this user's active device?")) return;
        try {
            await revokeDevice(userId);
            toast.success("Device revoked successfully");
            fetchData();
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to revoke device");
        }
    };

    const handleToggleUserActive = async (id, currentActive) => {
        const newState = !currentActive;
        const label = newState ? "activate" : "deactivate";
        if (!window.confirm(`Are you sure you want to ${label} this user?`)) return;
        setSaving(true);
        try {
            await toggleUserActive(id, newState);
            toast.success(`User ${newState ? "activated" : "deactivated"}`);
            await fetchData();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || "Failed to update user status");
        } finally {
            setSaving(false);
        }
    };

    const handleApproveDevice = async (deviceRowId) => {
        try {
            await approveDevice(deviceRowId);
            toast.success("Device approved successfully");
            fetchData();
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to approve device");
        }
    };




    const userColumns = useMemo(() => [
        // {
        //     key: 'user',
        //     label: 'User',
        //     render: (row) => (
        //         <div className="flex flex-col">
        //             <div className="flex items-center gap-1.5">
        //                 <span className="text-sm font-medium text-slate-900">{row.name}</span>
        //                 {row.username && <span className="text-xs text-slate-400 font-mono">({row.username})</span>}
        //             </div>
        //             <span className="text-sm text-slate-500">{row.email}</span>
        //         </div>
        //     )
        // },
        {
            key: 'name', label: 'Full Name', render: (row) => (
                <span className="text-sm text-slate-600">
                    {row.name || '—'}
                </span>
            )
        },
        {
            key: 'username', label: 'Username', render: (row) => (
                <span className="text-sm text-slate-600 font-mono">
                    {row.username || '—'}
                </span>
            )
        },
        {
            key: 'type_name', label: 'Type Name', render: (row) => (
                <span className="text-sm text-slate-600">
                    {row.type_name || '—'}
                </span>
            )
        },
        {
            key: 'role', label: 'User Group', render: (row) => (
                <span className="text-sm font-semibold text-slate-700 capitalize">
                    {row.role || '—'}
                </span>
            )
        },
        {
            key: 'mob_no',
            label: 'Mobile',
            render: (row) => <span className="text-sm text-slate-600">{row.mob_no || '—'}</span>
        },
        {
            key: 'state',
            label: 'State',
            render: (row) => {
                if (!row.state) return '—';
                try {
                    const arr = typeof row.state === 'string' ? JSON.parse(row.state) : row.state;
                    if (Array.isArray(arr)) {
                        if (arr.includes('All')) return 'All';
                        return arr.join(', ');
                    }
                    return String(row.state);
                } catch (e) {
                    return String(row.state);
                }
            }
        },
        {
            key: 'city',
            label: 'City',
            render: (row) => <span className="text-sm text-slate-600">{row.city || '—'}</span>
        },
        {
            key: 'branch',
            label: 'Branch',
            render: (row) => {
                if (!row.branch) return '—';
                try {
                    const arr = typeof row.branch === 'string' ? JSON.parse(row.branch) : row.branch;
                    if (Array.isArray(arr)) {
                        if (arr.includes('All')) return 'All';
                        return arr.join(', ');
                    }
                    return String(row.branch);
                } catch (e) {
                    return String(row.branch);
                }
            }
        },
        {
            key: 'product_type',
            label: 'Product Type',
            render: (row) => {
                if (!row.product_type) return '—';
                try {
                    const arr = typeof row.product_type === 'string' ? JSON.parse(row.product_type) : row.product_type;
                    if (Array.isArray(arr)) {
                        if (arr.includes('All')) return 'All';
                        return arr.join(', ');
                    }
                    return String(row.product_type);
                } catch (e) {
                    return String(row.product_type);
                }
            }
        },
        {
            key: 'landing_type',
            label: 'Landing Type',
            render: (row) => {
                if (!row.landing_type) return '—';
                try {
                    const arr = typeof row.landing_type === 'string' ? JSON.parse(row.landing_type) : row.landing_type;
                    if (Array.isArray(arr)) {
                        if (arr.includes('All')) return 'All';
                        return arr.join(', ');
                    }
                    return String(row.landing_type);
                } catch (e) {
                    return String(row.landing_type);
                }
            }
        },
        {
            key: 'brand',
            label: 'Brand',
            render: (row) => {
                if (!row.brand) return '—';
                try {
                    const arr = typeof row.brand === 'string' ? JSON.parse(row.brand) : row.brand;
                    if (Array.isArray(arr)) {
                        if (arr.includes('All')) return 'All';
                        return arr.join(', ');
                    }
                    return String(row.brand);
                } catch (e) {
                    return String(row.brand);
                }
            }
        },
        {
            key: "active",
            label: "Status",
            render: (row) => row.active ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active
                </span>
            ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Deactivated
                </span>
            )
        },
        {
            key: 'device_status',
            label: 'Device Status',
            render: (row) => (
                <div className="flex flex-col items-start gap-1">
                    {row.device_status === 'approved' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Approved </span>
                    ) : row.device_status === 'pending' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">Pending ⏳</span>
                    ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">No Device —</span>
                    )}
                    {row.device_id && <div className="text-xs text-slate-400 font-mono max-w-[120px] truncate" title={row.device_id}>{row.device_id}</div>}
                </div>
            )
        },
        {
            key: 'actions',
            label: 'Actions',
            sortable: false,
            render: (row) => {
                const canRevoke = hasPermission("device_approval", "write") || user.role === "admin";
                const canToggle = hasPermission("user_master", "update") || user.role === "admin";
                const canMap = hasPermission("user_branch_mapping", "read") || user.role === "admin";
                return (
                    <div className="flex items-center gap-3">
                        {canRevoke && (
                            <button
                                onClick={() => handleRevokeDevice(row.id)}
                                disabled={!row.device_status}
                                className="text-red-600 hover:text-red-900 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-medium"
                            >
                                Revoke Device
                            </button>
                        )}
                        {canMap && (
                            <button
                                onClick={() => navigate(`/admin/user-branch-mapping?userId=${row.id}`)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-purple-200 bg-purple-50 text-indigo-650 hover:bg-purple-100 transition-colors"
                                title="User Branch Mapping"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth={1.8}
                                    stroke="currentColor"
                                    className="h-4 w-4"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"
                                    />
                                </svg>
                            </button>
                        )}
                        {canToggle && (
                            <button
                                onClick={() => handleToggleUserActive(row.id, !!row.active)}
                                disabled={saving}
                                className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${row.active
                                    ? "border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100"
                                    : "border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                                    }`}
                                title={row.active ? "Deactivate" : "Activate"}
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth={1.8}
                                    stroke="currentColor"
                                    className="h-4 w-4"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M5.636 5.636a9 9 0 1012.728 0M12 3v9"
                                    />
                                </svg>
                            </button>
                        )}
                    </div>
                );
            }
        },
        {
            key: 'device_verification_required',
            label: 'Device Verification',
            render: (row) => (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${row.device_verification_required ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                    {row.device_verification_required ? 'Required' : 'Not Required'}
                </span>
            )
        }
    ], [users, saving, user, hasPermission]);

    const pendingColumns = useMemo(() => [
        {
            key: 'user',
            label: 'User',
            render: (row) => (
                <div className="flex flex-col">
                    <span className="text-sm font-medium text-slate-900">{row.user_name}</span>
                    <span className="text-sm text-slate-500">{row.user_email}</span>
                </div>
            )
        },
        {
            key: 'device_id',
            label: 'Device ID',
            render: (row) => <span className="font-mono text-sm text-slate-600">{row.device_id}</span>
        },
        {
            key: 'submitted_at',
            label: 'Submitted At',
            render: (row) => <span className="text-sm text-slate-500">{new Date(row.submitted_at).toLocaleString()}</span>
        },
        {
            key: 'actions',
            label: 'Actions',
            sortable: false,
            render: (row) => {
                const canApprove = hasPermission("device_approval", "write") || user.role === "admin";
                if (!canApprove) return <span className="text-xs text-slate-400">—</span>;
                return (
                    <div className="flex justify-end">
                        <button
                            onClick={() => handleApproveDevice(row.id)}
                            className="inline-flex justify-center rounded-md px-4 py-2 text-sm font-semibold text-white bg-[#6804a1] hover:bg-[#52037e] shadow-sm"
                        >
                            Approve
                        </button>
                    </div>
                );
            }
        }
    ], [hasPermission, user]);

    const historyColumns = useMemo(() => [
        {
            key: 'user',
            label: 'User',
            render: (row) => <span className="text-sm font-medium text-slate-900">{row.user_name}</span>
        },
        {
            key: 'device_id',
            label: 'Device ID',
            render: (row) => (
                <span className="font-mono text-xs text-slate-600 max-w-[150px] truncate block" title={row.device_id}>
                    {row.device_id}
                </span>
            )
        },
        {
            key: 'status',
            label: 'Status',
            render: (row) => (
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${row.status === 'approved' ? 'bg-green-100 text-green-800' :
                    row.status === 'pending' ? 'bg-orange-100 text-orange-800' :
                        'bg-red-100 text-red-800'
                    }`}>
                    {row.status.toUpperCase()}
                </span>
            )
        },
        {
            key: 'submitted_at',
            label: 'Submitted',
            render: (row) => <span className="text-xs text-slate-500">{new Date(row.submitted_at).toLocaleString()}</span>
        },
        {
            key: 'approved_by',
            label: 'Approved By',
            render: (row) => <span className="text-xs text-slate-500">{row.approved_by_name ? `${row.approved_by_name} on ${new Date(row.approved_at).toLocaleString()}` : '—'}</span>
        },
        {
            key: 'closed_by',
            label: 'Closed By',
            render: (row) => <span className="text-xs text-slate-500">{row.closed_by_name ? `${row.closed_by_name} on ${new Date(row.closed_at).toLocaleString()}` : '—'}</span>
        }
    ], []);

    const filteredAuditLogs = auditUserFilter === "all"
        ? auditLogs
        : auditLogs.filter(log => log.user_id.toString() === auditUserFilter);

    return (
        <div className="flex-1 flex flex-col bg-slate-50 font-sans text-slate-900">
            <Navbar title="ERP Admin" />

            <main className="flex-1 flex flex-col w-full mx-auto py-8 px-4 sm:px-6 lg:px-8">


                {/* Tabs */}
                <div className="border-b border-slate-200 mb-6">
                    <nav className="-mb-px flex space-x-8">
                        {(() => {
                            const tabs = [];
                            if (canReadUsers) tabs.push("users");
                            if (canReadDevices) {
                                tabs.push("pending");
                                tabs.push("history");
                            }
                            return tabs.map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors
                                        ${activeTab === tab
                                            ? 'border-[#6804a1] text-[#6804a1]'
                                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                                        }`}
                                >
                                    {tab === 'users' && 'Users'}
                                    {tab === 'pending' && (
                                        <span className="flex items-center gap-2">
                                            Pending Device Approvals
                                            {pendingDevices.length > 0 && (
                                                <span className="bg-orange-100 text-orange-600 py-0.5 px-2 rounded-full text-xs">
                                                    {pendingDevices.length}
                                                </span>
                                            )}
                                        </span>
                                    )}
                                    {tab === 'history' && 'Device History'}
                                </button>
                            ));
                        })()}
                    </nav>
                </div>

                {/* Tab Content: Users */}
                {activeTab === 'users' && canReadUsers && (
                    <div className="flex-1 flex flex-col mb-8">
                        <DataTable
                            tableId="admin_user_master"
                            title="User Master"
                            data={users}
                            columns={userColumns}
                            searchPlaceholder="Search users by name or email..."
                            toggleActions={
                                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-600 select-none">
                                    <div
                                        onClick={() => setShowInactive((v) => !v)}
                                        className={`relative w-9 h-5 rounded-full transition-colors duration-200 cursor-pointer ${showInactive ? "bg-amber-400" : "bg-slate-200"
                                            }`}
                                    >
                                        <span
                                            className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${showInactive ? "translate-x-4" : ""
                                                }`}
                                        />
                                    </div>
                                    Show Deactivated
                                </label>
                            }
                            actionButton={
                                (hasPermission("user_master", "write") || user.role === "admin") && (
                                    <button
                                        onClick={() => navigate('/admin/users/create')}
                                        className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#6804a1] text-white hover:bg-[#52037e] transition-colors cursor-pointer shadow-sm hover:shadow"
                                        title="Create User"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                        </svg>
                                    </button>
                                )
                            }
                        />
                    </div>
                )}

                {/* Tab Content: Pending Approvals */}
                {activeTab === 'pending' && canReadDevices && (
                    <div className="flex-1 flex flex-col mb-8">
                        <DataTable
                            tableId="admin_pending_approvals"
                            title="Pending Device Approvals"
                            data={pendingDevices}
                            columns={pendingColumns}
                            searchPlaceholder="Search pending devices..."
                        />
                    </div>
                )}

                {/* Tab Content: Device History */}
                {activeTab === 'history' && canReadDevices && (
                    <div className="flex-1 flex flex-col mb-8">
                        {/* <div className="mb-4 p-4 border border-slate-200 bg-white shadow-sm rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <span className="text-sm font-medium text-slate-700">Filter History by User:</span>
                            <select
                                value={auditUserFilter}
                                onChange={(e) => setAuditUserFilter(e.target.value)}
                                className="block w-full sm:w-64 pl-3 pr-10 py-2 text-base border border-slate-300 focus:outline-none focus:ring-[#6804a1] focus:border-[#6804a1] sm:text-sm rounded-lg"
                            >
                                <option value="all">All Users</option>
                                {users.map(u => (
                                    <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                                ))}
                            </select>
                        </div> */}
                        <DataTable
                            tableId="admin_device_history"
                            title="Device History"
                            data={filteredAuditLogs}
                            columns={historyColumns}

                            searchPlaceholder="Search history logs..."
                        />
                    </div>
                )}
            </main>

        </div>
    );
}

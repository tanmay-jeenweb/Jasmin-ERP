import { useEffect, useState, useMemo } from "react";
import toast from "react-hot-toast";
import {
    getAllUsers,
    getPendingDevices,
    approveDevice,
    revokeDevice,
    fetchAuditLogs,
    toggleUserActive,
    fetchUserActiveDevices,
    revokeSpecificDevice,
    getSuperAdminUsers,
    updateUserBySuperAdmin
} from "../../api/authApi";
import { getUserTypes } from "../../api/userTypeMasterApi";
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

    // Super admin panel state
    const [superAdminUsers, setSuperAdminUsers] = useState([]);
    const [userTypes, setUserTypes] = useState([]);
    const [isSuperAdminModalOpen, setIsSuperAdminModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [visiblePasswords, setVisiblePasswords] = useState({});
    const [editForm, setEditForm] = useState({
        name: "",
        username: "",
        email: "",
        mobNo: "",
        role: "user",
        userTypeId: "",
        password: "",
        confirmPassword: "",
        deviceVerificationRequired: true,
        active: true
    });

    // Filter/Search states
    const [auditUserFilter, setAuditUserFilter] = useState("all");

    const [showInactive, setShowInactive] = useState(false);
    const [saving, setSaving] = useState(false);

    // Manage devices modal state
    const [manageUser, setManageUser] = useState(null);
    const [userDevices, setUserDevices] = useState([]);
    const [loadingDevices, setLoadingDevices] = useState(false);

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
            if (user.role === "super admin") {
                promises.push(
                    getSuperAdminUsers()
                        .then(res => ({ type: "superAdminUsers", data: res.data.users }))
                        .catch(err => { console.error("Error fetching super admin users:", err); return null; })
                );
            }

            const results = await Promise.all(promises);
            results.forEach(res => {
                if (!res) return;
                if (res.type === "users") setUsers(res.data);
                if (res.type === "pending") setPendingDevices(res.data);
                if (res.type === "audit") setAuditLogs(res.data);
                if (res.type === "superAdminUsers") setSuperAdminUsers(res.data);
            });
        } catch (error) {
            console.error("Error fetching data:", error);
            toast.error("Failed to load dashboard data");
        }
    };

    useEffect(() => {
        if (user.role === "super admin") {
            getUserTypes()
                .then(res => setUserTypes(res.data.data || []))
                .catch(err => console.error("Error loading user types:", err));
        }
    }, [user.role]);

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

    const handleOpenSuperAdminModal = (userRow) => {
        setSelectedUser(userRow);
        setEditForm({
            name: userRow.name || "",
            username: userRow.username || "",
            email: userRow.email || "",
            mobNo: userRow.mob_no || "",
            role: userRow.role || "user",
            userTypeId: userRow.user_type_id || "",
            password: "",
            confirmPassword: "",
            deviceVerificationRequired: !!userRow.device_verification_required,
            active: !!userRow.active
        });
        setIsSuperAdminModalOpen(true);
    };

    const handleUpdateUserBySuperAdmin = async (e) => {
        e.preventDefault();
        if (editForm.password !== editForm.confirmPassword) {
            toast.error("New Password and Confirm Password do not match.");
            return;
        }
        setSaving(true);
        try {
            await updateUserBySuperAdmin(selectedUser.id, {
                name: editForm.name,
                username: editForm.username,
                email: editForm.email,
                mobNo: editForm.mobNo || null,
                role: editForm.role,
                userTypeId: editForm.userTypeId || null,
                password: editForm.password || undefined,
                deviceVerificationRequired: editForm.deviceVerificationRequired,
                active: editForm.active
            });
            toast.success("User updated successfully");
            setIsSuperAdminModalOpen(false);
            fetchData();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || "Failed to update user");
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

    const handleOpenManageDevicesModal = async (userRow) => {
        setManageUser(userRow);
        setLoadingDevices(true);
        try {
            const res = await fetchUserActiveDevices(userRow.id);
            setUserDevices(res.data.devices || []);
        } catch (error) {
            toast.error("Failed to load user devices");
        } finally {
            setLoadingDevices(false);
        }
    };

    const handleRevokeSpecificDevice = async (deviceRowId) => {
        if (!window.confirm("Are you sure you want to revoke this specific device?")) return;
        try {
            await revokeSpecificDevice(deviceRowId);
            toast.success("Device revoked successfully");
            if (manageUser) {
                const res = await fetchUserActiveDevices(manageUser.id);
                setUserDevices(res.data.devices || []);
            }
            fetchData();
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to revoke device");
        }
    };

    const handleBulkRevokeDevices = async () => {
        if (!manageUser) return;
        if (!window.confirm("Are you sure you want to revoke ALL active devices for this user?")) return;
        try {
            await revokeDevice(manageUser.id);
            toast.success("All devices revoked successfully");
            setManageUser(null);
            fetchData();
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to revoke devices");
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
            render: (row) => {
                const approvedCount = row.approved_devices_count || 0;
                const pendingCount = row.pending_devices_count || 0;
                return (
                    <div className="flex flex-col items-start gap-1">
                        {approvedCount > 0 && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5" />{approvedCount} Approved
                            </span>
                        )}
                        {pendingCount > 0 && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200 animate-pulse">
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 mr-1.5" />{pendingCount} Pending ⏳
                            </span>
                        )}
                        {approvedCount === 0 && pendingCount === 0 && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-50 text-slate-655 border border-slate-200">
                                No Device —
                            </span>
                        )}
                    </div>
                );
            }
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
                                onClick={() => handleOpenManageDevicesModal(row)}
                                disabled={(row.approved_devices_count || 0) === 0 && (row.pending_devices_count || 0) === 0}
                                className="text-[#6804a1] hover:text-[#52037e] disabled:opacity-30 disabled:cursor-not-allowed text-xs font-semibold"
                            >
                                Manage Devices
                            </button>
                        )}
                        {canMap && (
                            <button
                                onClick={() => navigate(`/admin/user-branch-mapping?userId=${row.id}`)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
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

    const superAdminColumns = useMemo(() => [
        {
            key: 'name',
            label: 'Name',
            render: (row) => (
                <div className="flex flex-col">
                    <span className="text-sm font-semibold text-slate-900">{row.name}</span>
                    <span className="text-xs text-slate-500">{row.email}</span>
                </div>
            )
        },
        {
            key: 'username',
            label: 'Username',
            render: (row) => <span className="font-mono text-xs">{row.username}</span>
        },
        {
            key: 'role',
            label: 'Role',
            render: (row) => (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {row.role}
                </span>
            )
        },
        {
            key: 'mob_no',
            label: 'Mobile No',
            render: (row) => row.mob_no || '—'
        },
        {
            key: 'active',
            label: 'Status',
            render: (row) => row.active ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Active
                </span>
            ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                    Deactivated
                </span>
            )
        },
        {
            key: 'device_verification_required',
            label: 'Device Verification',
            render: (row) => (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${row.device_verification_required ? 'bg-green-150 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {row.device_verification_required ? 'Required' : 'Bypassed'}
                </span>
            )
        },
        {
            key: 'actions',
            label: 'Actions',
            sortable: false,
            render: (row) => (
                <button
                    onClick={() => handleOpenSuperAdminModal(row)}
                    className="text-[#6804a1] hover:text-[#52037e] text-xs font-semibold"
                >
                    Edit User
                </button>
            )
        }
    ], []);

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
            key: 'replaced_device_id',
            label: 'Action / Replaces',
            render: (row) => row.replaced_device_id ? (
                <div className="flex flex-col">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 w-max">
                        REPLACEMENT
                    </span>
                    <span className="font-mono text-xs text-slate-400 mt-1 truncate max-w-[150px] block" title={row.replaced_device_id}>
                        Replaces: {row.replaced_device_id}
                    </span>
                </div>
            ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-green-150 text-green-800 w-max">
                    NEW DEVICE
                </span>
            )
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
                            if (user.role === "super admin") {
                                tabs.push("super_admin");
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
                                    {tab === 'super_admin' && 'Super Admin Panel'}
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

                {/* Tab Content: Super Admin Panel */}
                {activeTab === 'super_admin' && user.role === 'super admin' && (
                    <div className="flex-1 flex flex-col mb-8">
                        <DataTable
                            tableId="super_admin_user_management"
                            title="Super Admin - User & Password Management"
                            data={superAdminUsers}
                            columns={superAdminColumns}
                            searchPlaceholder="Search users by name, username, or email..."
                        />
                    </div>
                )}
            </main>

            {/* Manage Devices Modal */}
            {manageUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center overflow-x-hidden overflow-y-auto outline-none focus:outline-none">
                    {/* Backdrop */}
                    <div 
                        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity animate-fade-in"
                        onClick={() => setManageUser(null)}
                    />
                    
                    {/* Modal Box */}
                    <div className="relative w-full max-w-lg mx-auto my-6 z-50 px-4">
                        <div className="relative flex flex-col w-full bg-white border border-slate-200 rounded-2xl shadow-xl outline-none focus:outline-none overflow-hidden">
                            {/* Header */}
                            <div className="flex items-center justify-between p-5 border-b border-slate-100">
                                <h3 className="text-lg font-bold text-slate-900">
                                    Manage Devices for {manageUser.name || manageUser.username}
                                </h3>
                                <button
                                    onClick={() => setManageUser(null)}
                                    className="text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                            
                            {/* Body */}
                            <div className="relative p-6 flex-auto max-h-[400px] overflow-y-auto">
                                {loadingDevices ? (
                                    <div className="flex flex-col items-center justify-center py-12 gap-3">
                                        <div className="animate-spin h-8 w-8 border-3 border-[#6804a1] rounded-full border-t-transparent"></div>
                                        <p className="text-sm text-slate-500 font-medium">Loading devices...</p>
                                    </div>
                                ) : userDevices.length === 0 ? (
                                    <p className="text-center text-sm text-slate-500 py-8">
                                        No active devices found for this user.
                                    </p>
                                ) : (
                                    <div className="space-y-4">
                                        {userDevices.map((dev, index) => (
                                            <div key={dev.id} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-150 rounded-xl">
                                                <div className="flex-1 min-w-0 pr-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                                            Device {index + 1}
                                                        </span>
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold leading-4 ${
                                                            dev.status === "approved" 
                                                                ? "bg-green-150 text-green-800" 
                                                                : "bg-orange-100 text-orange-850"
                                                        }`}>
                                                            {dev.status}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm font-semibold text-slate-800 font-mono mt-1 truncate" title={dev.device_id}>
                                                        {dev.device_id}
                                                    </p>
                                                    <p className="text-[10px] text-slate-400 mt-1">
                                                        Registered: {new Date(dev.submitted_at).toLocaleString()}
                                                    </p>
                                                </div>
                                                
                                                <button
                                                    onClick={() => handleRevokeSpecificDevice(dev.id)}
                                                    className="inline-flex items-center justify-center px-3 py-1.5 border border-red-200 text-xs font-semibold rounded-lg text-red-650 bg-red-50/50 hover:bg-red-50 hover:text-red-700 transition-colors shadow-sm"
                                                >
                                                    Revoke
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            
                            {/* Footer */}
                            <div className="flex items-center justify-between p-5 border-t border-slate-100 bg-slate-50/50">
                                <button
                                    onClick={handleBulkRevokeDevices}
                                    disabled={userDevices.length === 0}
                                    className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-semibold rounded-lg text-white bg-red-650 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Revoke All Devices
                                </button>
                                <button
                                    onClick={() => setManageUser(null)}
                                    className="inline-flex items-center justify-center px-4 py-2 border border-slate-300 text-sm font-semibold rounded-lg text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#6804a1] transition-colors shadow-sm"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Super Admin Edit User Modal */}
            {isSuperAdminModalOpen && selectedUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center overflow-x-hidden overflow-y-auto outline-none focus:outline-none">
                    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity" onClick={() => setIsSuperAdminModalOpen(false)} />
                    <div className="relative w-full max-w-4xl mx-auto my-6 z-50 px-4">
                        <div className="relative flex flex-col w-full bg-white border border-slate-200 rounded-2xl shadow-xl outline-none focus:outline-none overflow-hidden">
                            {/* Header */}
                            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-[#6804a1]/5">
                                <h3 className="text-lg font-bold text-[#6804a1]">
                                    Super Admin settings for {selectedUser.name} ({selectedUser.username})
                                </h3>
                                <button onClick={() => setIsSuperAdminModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                            {/* Form Body */}
                            <form onSubmit={handleUpdateUserBySuperAdmin}>
                                <div className="p-6 space-y-4 max-h-[400px] overflow-y-auto">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Full Name</label>
                                            <input
                                                type="text"
                                                required
                                                value={editForm.name}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                                                className="w-full h-10 px-3 border border-slate-300 rounded-lg text-sm focus:border-[#6804a1] outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Username</label>
                                            <input
                                                type="text"
                                                required
                                                value={editForm.username}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, username: e.target.value }))}
                                                className="w-full h-10 px-3 border border-slate-300 rounded-lg text-sm focus:border-[#6804a1] outline-none"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Email Address</label>
                                            <input
                                                type="email"
                                                required
                                                value={editForm.email}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                                                className="w-full h-10 px-3 border border-slate-300 rounded-lg text-sm focus:border-[#6804a1] outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Mobile Number</label>
                                            <input
                                                type="text"
                                                value={editForm.mobNo}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, mobNo: e.target.value }))}
                                                className="w-full h-10 px-3 border border-slate-300 rounded-lg text-sm focus:border-[#6804a1] outline-none"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">User Role</label>
                                            <select
                                                value={editForm.role}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, role: e.target.value }))}
                                                className="w-full h-10 px-3 border border-slate-300 rounded-lg text-sm focus:border-[#6804a1] outline-none bg-white"
                                            >
                                                <option value="user">User</option>
                                                <option value="admin">Admin</option>
                                                <option value="super admin">Super Admin</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">User Type Group</label>
                                            <select
                                                value={editForm.userTypeId}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, userTypeId: e.target.value }))}
                                                className="w-full h-10 px-3 border border-slate-300 rounded-lg text-sm focus:border-[#6804a1] outline-none bg-white"
                                            >
                                                <option value="">None (No Permissions Group)</option>
                                                {userTypes.map(t => (
                                                    <option key={t.id} value={t.id}>{t.type_name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">New Password</label>
                                            <input
                                                type="password"
                                                placeholder="New password (leave empty to keep current)"
                                                value={editForm.password}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, password: e.target.value }))}
                                                className="w-full h-10 px-3 border border-slate-300 rounded-lg text-sm focus:border-[#6804a1] outline-none font-mono"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Confirm Password</label>
                                            <input
                                                type="password"
                                                placeholder="Confirm password"
                                                value={editForm.confirmPassword}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                                className="w-full h-10 px-3 border border-slate-300 rounded-lg text-sm focus:border-[#6804a1] outline-none font-mono"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                                        <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700 select-none">
                                            <input
                                                type="checkbox"
                                                checked={editForm.deviceVerificationRequired}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, deviceVerificationRequired: e.target.checked }))}
                                                className="accent-[#6804a1] h-4 w-4"
                                            />
                                            Device Verification Required
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700 select-none">
                                            <input
                                                type="checkbox"
                                                checked={editForm.active}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, active: e.target.checked }))}
                                                className="accent-[#6804a1] h-4 w-4"
                                            />
                                            Account Active
                                        </label>
                                    </div>
                                </div>
                                {/* Footer */}
                                <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-100 bg-slate-50/50">
                                    <button
                                        type="button"
                                        onClick={() => setIsSuperAdminModalOpen(false)}
                                        className="inline-flex items-center justify-center px-4 py-2 border border-slate-300 text-sm font-semibold rounded-lg text-slate-700 bg-white hover:bg-slate-50 focus:outline-none transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-semibold rounded-lg text-white bg-[#6804a1] hover:bg-[#52037e] focus:outline-none transition-colors shadow-sm disabled:opacity-50"
                                    >
                                        {saving ? "Saving..." : "Save Changes"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

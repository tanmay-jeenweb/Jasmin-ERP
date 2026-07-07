import { useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { logoutUser } from "../api/authApi";
import { usePermission } from "../context/PermissionContext";

const logo = "/Jasmin-Logo.png";

export default function Navbar() {
    const navigate = useNavigate();
    const location = useLocation();
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const [isOpen, setIsOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const { hasPermission } = usePermission();

    useEffect(() => {
        const handleOutsideClick = (e) => {
            if (isOpen && !e.target.closest("#custom-nav-dropdown")) {
                setIsOpen(false);
            }
            if (isProfileOpen && !e.target.closest("#profile-dropdown")) {
                setIsProfileOpen(false);
            }
        };
        document.addEventListener("click", handleOutsideClick);
        return () => document.removeEventListener("click", handleOutsideClick);
    }, [isOpen, isProfileOpen]);

    const handleLogout = async () => {
        try {
            await logoutUser();
        } catch (error) {
            console.error("Logout failed", error);
        }
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        sessionStorage.removeItem("loginTime");
        window.dispatchEvent(new Event("auth-change"));
        navigate("/");
    };

    const userModules = user.modules || [];
    const isAdmin = user.role === "admin" || user.role === "super admin";

    const allMasters = [
        {
            name: "User Master",
            path: "/admin/dashboard",
            masterKeys: ["user_master", "device_approval"],
            icon: "fa-solid fa-users-gear",
            color: "bg-emerald-50 text-emerald-600 border border-emerald-100/50",
            activeColor: "bg-emerald-100 text-emerald-700",
            desc: "Manage user profiles & account statuses"
        },
        {
            name: "User Types Master",
            path: "/admin/user-types",
            masterKey: "user_type",
            icon: "fa-solid fa-user-shield",
            color: "bg-violet-50 text-violet-600 border border-violet-100/50",
            activeColor: "bg-violet-100 text-violet-700",
            desc: "Configure access roles & permissions"
        },
        {
            name: "Brand Master",
            path: "/admin/mobile-brands",
            masterKey: "mobile_brand_master",
            icon: "fa-solid fa-mobile-screen-button",
            color: "bg-teal-50 text-teal-600 border border-teal-100/50",
            activeColor: "bg-teal-100 text-teal-700",
            desc: "Manage brands"
        },
        {
            name: "Finance Company Master",
            path: "/admin/banks",
            masterKey: "bank_master",
            icon: "fa-solid fa-building-columns",
            color: "bg-rose-50 text-rose-600 border border-rose-100/50",
            activeColor: "bg-rose-100 text-rose-700",
            desc: "Manage finance companies"
        },
        {
            name: "Finance Machine Master",
            path: "/admin/finance-machines",
            masterKey: "finance_machine_master",
            icon: "fa-solid fa-calculator",
            color: "bg-violet-50 text-violet-600 border border-violet-100/50",
            activeColor: "bg-violet-100 text-violet-700",
            desc: "Manage finance machines"
        },
        {
            name: "State Master",
            path: "/admin/states",
            masterKey: "state_master",
            icon: "fa-solid fa-map-location-dot",
            color: "bg-blue-50 text-blue-600 border border-blue-100/50",
            activeColor: "bg-blue-100 text-blue-700",
            desc: "Manage geographic states"
        },
        {
            name: "Product Type Master",
            path: "/admin/product-types",
            masterKey: "product_type_master",
            icon: "fa-solid fa-tags",
            color: "bg-emerald-50 text-emerald-600 border border-emerald-100/50",
            activeColor: "bg-emerald-100 text-emerald-700",
            desc: "Manage product type tags"
        },
        {
            name: "Model Master",
            path: "/admin/item-models",
            masterKey: "item_model_master",
            icon: "fa-solid fa-layer-group",
            color: "bg-blue-50 text-blue-600 border border-blue-100/50",
            activeColor: "bg-blue-100 text-blue-700",
            desc: "Fetch and manage item models"
        },
        {
            name: "Model Group Master",
            path: "/admin/model-groups",
            masterKey: "model_group_master",
            icon: "fa-solid fa-folder-open",
            color: "bg-teal-50 text-teal-600 border border-teal-100/50",
            activeColor: "bg-teal-100 text-teal-700",
            desc: "Fetch and manage model groups"
        },
        {
            name: "Branch Master",
            path: "/admin/branches",
            masterKey: "branch_master",
            icon: "fa-solid fa-store",
            color: "bg-emerald-50 text-emerald-600 border border-emerald-100/50",
            activeColor: "bg-emerald-100 text-emerald-700",
            desc: "Manage branches & franchise stores"
        }
    ];

    const availableMasters = allMasters.filter(m => {
        if (m.adminOnly) return isAdmin;
        if (m.masterKey) return hasPermission(m.masterKey, "read");
        if (m.masterKeys) return m.masterKeys.some(key => hasPermission(key, "read"));
        if (m.module) return isAdmin || userModules.includes(m.module);
        return true;
    });



    return (
        <nav className="bg-white shadow-sm border-b border-slate-200 flex flex-col relative z-50">
            {/* First Row */}
            <div className="px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between relative z-40">
                <div className="flex items-center gap-3">
                    <img src={logo} alt="Jasmin Logo" className="h-12 w-auto" />
                </div>

                <div className="flex items-center gap-6">


                    {/* Profile Dropdown */}
                    <div className="relative" id="profile-dropdown">
                        <button
                            onClick={() => setIsProfileOpen(!isProfileOpen)}
                            className="flex items-center gap-2.5 px-3 py-1.5 rounded-full hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all duration-200 cursor-pointer focus:outline-none"
                            title="User menu"
                        >
                            {/* Profile Avatar Icon */}
                            <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm shadow-sm">
                                {user.name ? user.name[0].toUpperCase() : "U"}
                            </div>
                            <span className="hidden sm:inline text-sm font-semibold text-slate-700">{user.name || "User"}</span>
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth={2.5}
                                stroke="currentColor"
                                className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isProfileOpen ? "rotate-180" : ""}`}
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                            </svg>
                        </button>

                        {isProfileOpen && (
                            <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-lg py-2 z-50 origin-top-right animate-in fade-in slide-in-from-top-2 duration-150">
                                {/* User Info Header */}
                                <div className="px-4 py-2.5 border-b border-slate-100">
                                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Signed in as</p>
                                    <p className="text-sm font-bold text-slate-800 truncate mt-0.5">{user.name || "User"}</p>
                                    {user.email && (
                                        <p className="text-xs text-slate-500 truncate mt-0.5">{user.email}</p>
                                    )}
                                </div>

                                {/* Menu Items */}
                                <div className="px-1.5 py-1">
                                    <button
                                        onClick={() => {
                                            navigate("/profile");
                                            setIsProfileOpen(false);
                                        }}
                                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-50 text-sm font-semibold transition-all duration-150 cursor-pointer text-left"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4 text-slate-400">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                                        </svg>
                                        Your Profile
                                    </button>
                                </div>

                                <div className="border-t border-slate-100 my-1"></div>

                                <div className="px-1.5 py-1">
                                    <button
                                        onClick={() => {
                                            setIsProfileOpen(false);
                                            handleLogout();
                                        }}
                                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 text-sm font-semibold transition-all duration-150 cursor-pointer text-left"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4 text-red-500">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 6.75 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
                                        </svg>
                                        Sign out
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Second Row: Custom Navigation & Master Dropdown */}
            {user.role && (
                <div className="bg-[#6804a1] border-t border-slate-200 px-4 sm:px-6 lg:px-8 py-0 flex flex-wrap items-center gap-4">
                    <div className="flex items-center relative z-30" id="custom-nav-dropdown">
                        {/* User Dashboard Tab */}
                        <div className="relative">
                            <button
                                onClick={() => {
                                    navigate("/user/home");
                                }}
                                className={`flex items-center justify-between w-40 px-4 py-2.5 text-sm border-r border-l border-white/10 rounded-none focus:outline-none transition-all duration-200 font-semibold text-white cursor-pointer ${
                                    location.pathname === "/user/home" ? "bg-white/15" : "bg-[#6804a1] hover:bg-white/5"
                                }`}
                            >
                                <span className="flex items-center gap-2.5 truncate mx-auto">
                                    <span className="font-semibold text-white truncate">User Dashboard</span>
                                </span>
                            </button>
                        </div>

                        {/* Masters Dropdown */}
                        {availableMasters.length > 0 && (
                            <div className="relative">
                                <button
                                    onClick={() => setIsOpen(!isOpen)}
                                    className={`flex items-center justify-between w-40 px-4 py-2.5 text-sm border-r border-white/10 rounded-none focus:outline-none transition-all duration-200 font-semibold text-white cursor-pointer ${
                                        isOpen ? "bg-white/15" : "bg-[#6804a1] hover:bg-white/5"
                                    }`}
                                >
                                    <span className="flex items-center gap-2.5 truncate mx-auto">
                                        <span className="font-semibold text-white truncate">Masters</span>
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            strokeWidth={2.5}
                                            stroke="currentColor"
                                            className={`w-3.5 h-3.5 text-slate-300 transition-transform duration-200 ${isOpen ? "rotate-180 text-white" : ""}`}
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                                        </svg>
                                    </span>
                                </button>

                                {isOpen && (
                                    <div className="absolute left-0 top-full mt-1.5 w-140 bg-white border border-slate-200 rounded-2xl shadow-xl p-3.5 z-50 origin-top animate-in fade-in slide-in-from-top-2 duration-200">
                                        <div className="grid grid-cols-2 gap-1.5">
                                            {availableMasters.map((m, idx) => {
                                                const isActive = location.pathname === m.path;
                                                return (
                                                    <button
                                                        key={idx}
                                                        onClick={() => {
                                                            navigate(m.path);
                                                            setIsOpen(false);
                                                        }}
                                                        className={`relative group flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all cursor-pointer text-left border border-transparent ${isActive
                                                            ? "bg-indigo-50/70 text-indigo-700 font-semibold border-indigo-100/50"
                                                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-100"
                                                            }`}
                                                    >
                                                        {/* Side Highlight Bar */}
                                                        <span className={`absolute left-0 top-2 bottom-2 w-1 rounded-r-md transition-all duration-200 ${isActive ? "bg-indigo-600 scale-y-100" : "bg-transparent scale-y-0 group-hover:scale-y-50 group-hover:bg-slate-300"
                                                            }`} />

                                                        <div className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all shadow-sm shrink-0 ${isActive ? "bg-indigo-100/80 text-indigo-700" : "bg-slate-100/80 text-slate-500 group-hover:scale-105"
                                                            }`}>
                                                            <i className={`${m.icon || "fa-solid fa-folder"} text-xs`}></i>
                                                        </div>

                                                        <div className="flex-1">
                                                            <p className={`text-sm font-semibold leading-snug py-0.5 transition-colors whitespace-normal break-words ${isActive ? "text-indigo-900 font-bold" : "text-slate-800 group-hover:text-slate-950"
                                                                }`}>
                                                                {m.name}
                                                            </p>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Offers Tab */}
                        {isAdmin && (
                            <div className="relative">
                                <button
                                    onClick={() => {
                                        navigate("/admin/offers");
                                    }}
                                    className={`flex items-center justify-between w-40 px-4 py-2.5 text-sm border-r border-white/10 rounded-none focus:outline-none transition-all duration-200 font-semibold text-white cursor-pointer ${
                                        location.pathname.startsWith("/admin/offers") ? "bg-white/15" : "bg-[#6804a1] hover:bg-white/5"
                                    }`}
                                >
                                    <span className="flex items-center gap-2.5 truncate mx-auto">
                                        <span className="font-semibold text-white truncate">Offers</span>
                                    </span>
                                </button>
                            </div>
                        )}

                        {/* Report Tab */}
                        {isAdmin && (
                            <div className="relative">
                                <button
                                    onClick={() => {
                                        navigate("/admin/report");
                                    }}
                                    className={`flex items-center justify-between w-40 px-4 py-2.5 text-sm border-r border-white/10 rounded-none focus:outline-none transition-all duration-200 font-semibold text-white cursor-pointer ${
                                        location.pathname.startsWith("/admin/report") ? "bg-white/15" : "bg-[#6804a1] hover:bg-white/5"
                                    }`}
                                >
                                    <span className="flex items-center gap-2.5 truncate mx-auto">
                                        <span className="font-semibold text-white truncate">Report</span>
                                    </span>
                                </button>
                            </div>
                        )}

                    </div>
                </div>
            )}
        </nav>
    );
}

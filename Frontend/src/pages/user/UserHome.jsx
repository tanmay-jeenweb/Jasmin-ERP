import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import { usePermission } from "../../context/PermissionContext";

export default function UserHome() {
    const navigate = useNavigate();
    const user = useMemo(() => JSON.parse(localStorage.getItem("user") || "{}"), []);
    const { hasPermission, loading: permissionLoading } = usePermission();
    const isAdmin = user.role === "admin" || user.role === "super admin";

    const allCards = [
        {
            name: "User Master",
            path: "/admin/dashboard",
            masterKeys: ["user_master", "device_approval"],
            icon: "fa-solid fa-users-gear",
            color: "text-emerald-600 bg-emerald-50 border-emerald-100",
            desc: "Manage user profiles, accounts, and device approvals."
        },
        {
            name: "User Types Master",
            path: "/admin/user-types",
            masterKey: "user_type",
            icon: "fa-solid fa-user-shield",
            color: "text-violet-600 bg-violet-50 border-violet-100",
            desc: "Configure access roles, permissions, and group policies."
        },
        {
            name: "Brand Master",
            path: "/admin/mobile-brands",
            masterKey: "mobile_brand_master",
            icon: "fa-solid fa-mobile-screen-button",
            color: "text-teal-600 bg-teal-50 border-teal-100",
            desc: "Manage mobile brands and brand configurations."
        },
        {
            name: "Finance Company Master",
            path: "/admin/banks",
            masterKey: "bank_master",
            icon: "fa-solid fa-building-columns",
            color: "text-rose-600 bg-rose-50 border-rose-100",
            desc: "Manage partner finance companies and bank records."
        },
        {
            name: "Finance Machine Master",
            path: "/admin/finance-machines",
            masterKey: "finance_machine_master",
            icon: "fa-solid fa-calculator",
            color: "text-indigo-600 bg-indigo-50 border-indigo-100",
            desc: "Configure swipe machines and payment finance options."
        },
        {
            name: "Activity Report",
            path: "/admin/report",
            adminOnly: true,
            icon: "fa-solid fa-chart-line",
            color: "text-amber-600 bg-amber-50 border-amber-100",
            desc: "View audit logs, user actions, and system activity logs."
        }
    ];

    const availableCards = allCards.filter(c => {
        if (c.adminOnly) return isAdmin;
        if (c.masterKey) return hasPermission(c.masterKey, "read");
        if (c.masterKeys) return c.masterKeys.some(key => hasPermission(key, "read"));
        return true;
    });

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 font-sans text-slate-900">
            <Navbar title="CRM Dashboard" />

            <main className="flex-grow w-full max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
                {/* Welcome Banner */}
                <div className="relative overflow-hidden bg-gradient-to-r from-[#6804a1] to-[#45026c] rounded-3xl p-8 sm:p-10 shadow-lg text-white mb-10 transition-all hover:shadow-xl duration-300">
                    <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />
                    
                    <div className="relative z-10 max-w-2xl">
                        <span className="inline-block px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-semibold uppercase tracking-wider mb-4 border border-white/10">
                            Jasmin CRM
                        </span>
                        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-2">
                            Welcome back, {user.name || "User"}!
                        </h1>
                        <p className="text-purple-100 text-sm leading-relaxed max-w-md">
                            Select one of the master configuration modules below or use the navigation menu to manage CRM assets.
                        </p>
                    </div>
                </div>

                {/* Grid of Sections */}
                {permissionLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-44 bg-white border border-slate-200/80 rounded-2xl animate-pulse" />
                        ))}
                    </div>
                ) : availableCards.length > 0 ? (
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2.5">
                            <span className="w-2.5 h-6 bg-[#6804a1] rounded-full inline-block" />
                            Quick Access Master Settings
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {availableCards.map((card, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => navigate(card.path)}
                                    className="group relative flex flex-col justify-between p-6 rounded-2xl border border-slate-200 bg-white hover:border-purple-200 hover:shadow-lg hover:shadow-purple-500/5 transition-all duration-300 cursor-pointer hover:-translate-y-1 overflow-hidden"
                                >
                                    <div className="absolute top-0 left-0 w-full h-1 bg-transparent group-hover:bg-gradient-to-r group-hover:from-purple-500 group-hover:to-indigo-500 transition-all duration-300" />
                                    
                                    <div>
                                        <div className="flex items-center gap-3.5 mb-4">
                                            <div className={`flex items-center justify-center w-11 h-11 rounded-xl shadow-sm border transition-all duration-300 group-hover:scale-110 ${card.color}`}>
                                                <i className={`${card.icon} text-lg`} />
                                            </div>
                                            <h3 className="text-base font-bold text-slate-800 group-hover:text-purple-700 transition-colors">
                                                {card.name}
                                            </h3>
                                        </div>
                                        <p className="text-slate-500 text-xs leading-relaxed">
                                            {card.desc}
                                        </p>
                                    </div>

                                    <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                                        <span>Click to open</span>
                                        <span className="text-purple-600 font-bold group-hover:translate-x-1 transition-transform flex items-center gap-1">
                                            Manage
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                                            </svg>
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-16 border border-dashed border-slate-200 rounded-3xl bg-white shadow-sm max-w-lg mx-auto">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 mx-auto mb-4 text-slate-300">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                        </svg>
                        <h3 className="text-base font-bold text-slate-700 mb-1">No Access Permissions</h3>
                        <p className="text-xs text-slate-400 px-6">
                            You do not have read access to any configuration modules. Please contact an administrator to request permissions.
                        </p>
                    </div>
                )}
            </main>
        </div>
    );
}

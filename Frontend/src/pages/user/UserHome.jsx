import { useMemo } from "react";
import Navbar from "../../components/Navbar";

export default function UserHome() {
    const user = useMemo(() => JSON.parse(localStorage.getItem("user") || "{}"), []);

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 font-sans text-slate-900">
            <Navbar title="ERP Dashboard" />

            <main className="flex-grow w-full max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-slate-900">User Home</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Welcome back, {user.name || "User"}. Here's what's happening today.
                    </p>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h2 className="text-base font-bold text-slate-800 mb-4">Your Dashboard</h2>
                    <div className="border border-dashed border-slate-200 rounded-lg py-24 min-h-[220px] flex items-center justify-center bg-slate-200/50">
                        <span className="text-sm text-slate-400 font-medium">
                            No modules assigned yet.
                        </span>
                    </div>
                </div>
            </main>
        </div>
    );
}


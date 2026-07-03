import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getDeviceId } from "../utils/device";

export default function PendingApproval() {
    const [deviceId, setDeviceId] = useState("");

    useEffect(() => {
        const fetchId = async () => {
            const id = await getDeviceId();
            setDeviceId(id);
        };
        fetchId();
    }, []);

    return (
        <div className="flex-1 flex items-center justify-center bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-lg border border-slate-100 text-center">
                <div className="flex justify-center">
                    <div className="rounded-full bg-amber-100 p-4">
                        <svg className="w-10 h-10 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                </div>
                
                <div>
                    <h2 className="mt-4 text-2xl font-bold text-slate-900 tracking-tight">
                        Awaiting Admin Approval
                    </h2>
                    <p className="mt-4 text-sm text-slate-600 leading-relaxed">
                        Your device registration request has been successfully sent. 
                        Please wait for your administrator to approve this device before you can log in.
                    </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mt-6">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Your Device ID</p>
                    <p className="font-mono text-sm text-slate-800 break-all">
                        {deviceId || "Loading..."}
                    </p>
                </div>

                <div className="mt-8">
                    <Link
                        to="/"
                        className="inline-flex justify-center items-center py-2.5 px-6 border border-slate-300 text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#6804a1] transition-colors shadow-sm"
                    >
                        Back to Login
                    </Link>
                </div>
            </div>
        </div>
    );
}

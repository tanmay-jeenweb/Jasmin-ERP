import { useState, useEffect } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";
import { requestDeviceRegistration } from "../api/authApi";
import { getDeviceId } from "../utils/device";

export default function DeviceRegistration() {
    const location = useLocation();
    const navigate = useNavigate();
    const [deviceId, setDeviceId] = useState("");
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const username = location.state?.username;
    const password = location.state?.password;

    useEffect(() => {
        if (!username || !password) {
            navigate("/"); // redirect to login if no state is passed
            return;
        }
        
        const initDevice = async () => {
            try {
                const id = await getDeviceId();
                setDeviceId(id);
            } catch (error) {
                toast.error("Failed to generate device signature");
            } finally {
                setLoading(false);
            }
        };

        initDevice();
    }, [username, password, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const response = await requestDeviceRegistration({
                username,
                password,
                deviceId
            });
            
            if (response.data.success || response.data.status === "PENDING_APPROVAL") {
                navigate("/pending-approval");
            } else {
                toast.error("Failed to submit device for approval");
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to submit device");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="flex-1 flex items-center justify-center bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg border border-slate-100">
                <div>
                    <h2 className="mt-2 text-center text-3xl font-extrabold text-slate-900 tracking-tight flex items-center justify-center gap-2">
                        <svg className="w-8 h-8 text-[#6804a1]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        Register Device
                    </h2>
                    <p className="mt-4 text-center text-sm text-slate-600">
                        This device needs administrator approval before you can log in.
                    </p>
                </div>
                
                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
                            <input
                                type="text"
                                value={username || ""}
                                disabled
                                className="appearance-none relative block w-full px-3 py-2 border border-slate-200 bg-slate-50 text-slate-500 rounded-lg sm:text-sm cursor-not-allowed"
                            />
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Device Signature</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={loading ? "Generating fingerprint..." : deviceId}
                                    disabled
                                    className={`appearance-none relative block w-full px-3 py-2 border border-slate-200 bg-slate-50 text-slate-700 font-mono text-sm rounded-lg sm:text-sm cursor-not-allowed ${loading ? "text-slate-400" : ""}`}
                                />
                                {loading && (
                                    <div className="absolute right-3 top-2.5">
                                        <div className="animate-spin h-4 w-4 border-2 border-[#6804a1] rounded-full border-t-transparent"></div>
                                    </div>
                                )}
                            </div>
                            <p className="mt-1 text-xs text-slate-500">A unique hardware-based signature for this browser/device.</p>
                        </div>
                    </div>

                    <div>
                        <button
                            type="submit"
                            disabled={loading || submitting}
                            className="group relative w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-semibold rounded-lg text-white bg-[#6804a1] hover:bg-[#52037e] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#6804a1] transition-colors duration-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {submitting ? "Submitting..." : "Submit for Approval"}
                        </button>
                    </div>
                    
                    <div className="text-center text-sm">
                        <Link to="/" className="font-medium text-slate-500 hover:text-slate-700 transition-colors">
                            Back to Login
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
}

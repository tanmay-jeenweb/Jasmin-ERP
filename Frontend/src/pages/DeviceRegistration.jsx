import { useState, useEffect } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";
import { requestDeviceRegistration, getApprovedDevicesList } from "../api/authApi";
import { getDeviceId } from "../utils/device";

export default function DeviceRegistration() {
    const location = useLocation();
    const navigate = useNavigate();
    const [deviceId, setDeviceId] = useState("");
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [revokeDeviceId, setRevokeDeviceId] = useState("");
    const [showReplacementModal, setShowReplacementModal] = useState(false);
    const [approvedDevices, setApprovedDevices] = useState(location.state?.approvedDevices || []);

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

                // Fetch fresh list of approved devices from backend directly
                const res = await getApprovedDevicesList({ username, password });
                if (res.data.success) {
                    setApprovedDevices(res.data.approvedDevices || []);
                }
            } catch (error) {
                console.error("Failed to generate signature or fetch devices", error);
            } finally {
                setLoading(false);
            }
        };

        initDevice();
    }, [username, password, navigate]);

    const maskDeviceId = (id) => {
        if (!id || id.length <= 12) return id;
        return `${id.substring(0, 6)}...${id.substring(id.length - 6)}`;
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        
        if (approvedDevices.length >= 3) {
            setShowReplacementModal(true);
            return;
        }

        submitRegistration();
    };

    const handleConfirmSubmit = () => {
        if (!revokeDeviceId) {
            toast.error("Please select a device to replace");
            return;
        }
        submitRegistration();
    };

    const submitRegistration = async () => {
        setSubmitting(true);
        try {
            const response = await requestDeviceRegistration({
                username,
                password,
                deviceId,
                revokeDeviceId: revokeDeviceId ? Number(revokeDeviceId) : null
            });
            
            if (response.data.success || response.data.status === "PENDING_APPROVAL") {
                setShowReplacementModal(false);
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
                            Submit for Approval
                        </button>
                    </div>
                    
                    <div className="text-center text-sm">
                        <Link to="/" className="font-medium text-slate-500 hover:text-slate-700 transition-colors">
                            Back to Login
                        </Link>
                    </div>
                </form>
            </div>

            {/* Device Replacement Selection Modal */}
            {showReplacementModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center overflow-x-hidden overflow-y-auto outline-none focus:outline-none">
                    {/* Backdrop */}
                    <div 
                        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity"
                        onClick={() => setShowReplacementModal(false)}
                    />
                    
                    {/* Modal Box */}
                    <div className="relative w-full max-w-md mx-auto my-6 z-50 px-4">
                        <div className="relative flex flex-col w-full bg-white border border-slate-200 rounded-2xl shadow-xl outline-none focus:outline-none overflow-hidden animate-fade-in">
                            {/* Header */}
                            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-amber-50">
                                <h3 className="text-base font-bold text-amber-800 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-amber-600 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    Device Limit Reached (3/3)
                                </h3>
                                <button
                                    onClick={() => setShowReplacementModal(false)}
                                    className="text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                            
                            {/* Body */}
                            <div className="relative p-6 flex-auto">
                                <p className="text-sm text-slate-600 leading-relaxed mb-4">
                                    You already have 3 active devices. Please choose one device below that you wish to replace once this new request is approved:
                                </p>
                                <div className="space-y-3">
                                    {approvedDevices.map((device, index) => (
                                        <label 
                                            key={device.id} 
                                            className={`flex items-start gap-3 cursor-pointer text-xs text-slate-700 bg-white p-3 rounded-lg border transition-all ${
                                                revokeDeviceId === String(device.id)
                                                    ? "border-[#6804a1] ring-1 ring-[#6804a1] bg-purple-50/10"
                                                    : "border-slate-200 hover:bg-slate-50"
                                            }`}
                                        >
                                            <input
                                                type="radio"
                                                name="revokeDevice"
                                                value={device.id}
                                                checked={revokeDeviceId === String(device.id)}
                                                onChange={() => setRevokeDeviceId(String(device.id))}
                                                className="mt-0.5 text-[#6804a1] focus:ring-[#6804a1] h-4 w-4"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="font-semibold text-slate-900 font-mono text-xs truncate" title={device.device_id}>
                                                    Device {index + 1}: {maskDeviceId(device.device_id)}
                                                </div>
                                                <div className="text-[10px] text-slate-400 mt-1">
                                                    Approved: {new Date(device.submitted_at).toLocaleString()}
                                                </div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            
                            {/* Footer */}
                            <div className="flex items-center justify-between p-5 border-t border-slate-100 bg-slate-50/50">
                                <button
                                    onClick={() => setShowReplacementModal(false)}
                                    type="button"
                                    className="inline-flex justify-center items-center px-4 py-2 border border-slate-300 text-sm font-semibold rounded-lg text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#6804a1] transition-colors shadow-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirmSubmit}
                                    type="button"
                                    disabled={!revokeDeviceId || submitting}
                                    className="inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-semibold rounded-lg text-white bg-[#6804a1] hover:bg-[#52037e] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#6804a1] transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {submitting ? "Submitting..." : "Confirm & Submit"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

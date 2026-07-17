import React from "react";

export default function LoginAlertModal({ alerts, onClose }) {
    if (!alerts || alerts.length === 0) return null;

    const [currentIndex, setCurrentIndex] = React.useState(0);
    const alert = alerts[currentIndex];

    const handleNext = () => {
        if (currentIndex < alerts.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md">
            {/* Ambient aesthetic light glow layers */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] h-[320px] bg-purple-650/15 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute top-1/3 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] bg-indigo-650/10 rounded-full blur-[90px] pointer-events-none" />

            {/* Premium Glassmorphic Modal Card */}
            <div className="bg-slate-900/75 border border-slate-800/80 text-white rounded-[24px] w-full max-w-[480px] shadow-[0_25px_60px_rgba(0,0,0,0.55)] overflow-hidden backdrop-blur-2xl transition-all duration-300">
                <div className="p-6 sm:p-8 flex flex-col items-center">
                    
                    {/* Multi-alert indicator badge */}
                    {alerts.length > 1 && (
                        <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-4 bg-indigo-950/40 px-3 py-1 rounded-full border border-indigo-900/30">
                            Notification {currentIndex + 1} of {alerts.length}
                        </div>
                    )}

                    {/* Order: 1. Image Insert */}
                    {alert.image_url && (
                        <div className="w-full flex justify-center mb-5 shrink-0">
                            <div className="relative w-full max-h-[220px] rounded-xl overflow-hidden border border-slate-800/50 bg-slate-950/40 flex items-center justify-center shadow-lg">
                                <img
                                    src={alert.image_url}
                                    alt={alert.title}
                                    className="max-w-full max-h-[220px] object-contain hover:scale-[1.02] transition-transform duration-500"
                                />
                            </div>
                        </div>
                    )}

                    {/* Order: 2. Title */}
                    <h2 className="text-lg sm:text-xl font-extrabold text-white text-center leading-tight tracking-tight mb-3.5 bg-gradient-to-r from-white via-slate-100 to-indigo-150 bg-clip-text">
                        {alert.title}
                    </h2>

                    {/* Order: 3. Description */}
                    <div className="w-full bg-slate-950/40 border border-slate-850/60 rounded-xl p-4 sm:p-5 max-h-[160px] overflow-y-auto mb-6">
                        <p className="text-slate-300 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-medium text-left">
                            {alert.description}
                        </p>
                    </div>

                    {/* Footer Close/Next Button */}
                    <button
                        onClick={handleNext}
                        className="w-full py-3 rounded-xl text-white text-xs sm:text-sm font-bold tracking-wider transition-all duration-300 bg-gradient-to-r from-purple-600 to-indigo-650 hover:from-purple-500 hover:to-indigo-550 shadow-[0_4px_18px_rgba(122,5,189,0.35)] hover:shadow-[0_4px_28px_rgba(122,5,189,0.55)] hover:-translate-y-0.5 focus:outline-none cursor-pointer border-none flex justify-center items-center gap-2"
                    >
                        <span>{currentIndex < alerts.length - 1 ? "Next Notification" : "Proceed to Dashboard"}</span>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
}

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { loginUser } from "../api/authApi";
import { getDeviceId } from "../utils/device";
const logo = "/Jasmin-Logo.png";
import jwlogo from "../assets/jwLogo.jpeg";


export default function Login() {
    const navigate = useNavigate();
    const [form, setForm] = useState({ username: "", password: "" });
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const deviceId = await getDeviceId();
            const response = await loginUser({ ...form, deviceId });

            if (!response.data.success) {
                if (response.data.status === "DEVICE_REGISTRATION_REQUIRED") {
                    navigate("/device-registration", { 
                        state: { 
                            username: form.username, 
                            password: form.password,
                            approvedDevices: response.data.approvedDevices || []
                        } 
                    });
                    return;
                }
                if (response.data.status === "PENDING_APPROVAL") {
                    navigate("/pending-approval");
                    return;
                }
                toast.error(response.data.message || "Login failed");
                return;
            }

            const user = response.data.user;
            const token = response.data.token;
            localStorage.setItem("user", JSON.stringify(user));
            localStorage.setItem("token", token);
            sessionStorage.setItem("loginTime", new Date().toLocaleTimeString());
            window.dispatchEvent(new Event("auth-change"));
            navigate("/user/home");

        } catch (error) {
            if (error.response?.data?.status === "DEVICE_MISMATCH") {
                toast.error("Unauthorized device. Contact admin.");
            } else {
                toast.error(error.response?.data?.message || "Login failed");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-screen w-screen flex flex-col md:flex-row bg-gradient-to-br from-[#0c081b] via-slate-950 to-[#0e0a21] font-sans antialiased text-slate-200 overflow-hidden relative">
            
            {/* Ambient Glows (placed on parent to prevent clipping at 50% width and scrollbar triggers) */}
            {/* Left side glow */}
            <div className="absolute top-[45%] left-[25%] -translate-x-1/2 -translate-y-1/2 w-[40%] h-[60%] bg-purple-600/15 rounded-full blur-[130px] pointer-events-none z-0" />
            {/* Right side glows */}
            <div className="absolute top-[25%] left-[75%] -translate-x-1/2 -translate-y-1/2 w-[40%] h-[50%] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none z-0" />
            <div className="absolute bottom-[25%] left-[65%] -translate-x-1/2 -translate-y-1/2 w-[35%] h-[45%] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none z-0" />

            {/* Left Column: Jasmin Mobile Showroom (50% width on md and above) */}
            <div className="hidden md:flex md:w-1/2 h-full relative overflow-hidden select-none bg-transparent flex-col justify-center items-center p-8 z-10">
                
                {/* Showroom Image container with subtle drop shadow and hover effect - Shifted higher */}
                <div className="w-full flex justify-center items-center max-h-[70%] z-10 relative -top-16">
                    <img
                        src="/Jasmin new (12).png"
                        alt="Jasmin Mobile Store front"
                        className="w-[95%] h-auto object-contain transition-transform duration-[6000ms] hover:scale-103 ease-out drop-shadow-[0_20px_50px_rgba(122,5,189,0.25)]"
                    />
                </div>
                
                {/* Floating Brand Text */}
                <div className="absolute bottom-4 left-12 z-20 max-w-md">
                    <h1 className="text-3xl lg:text-4xl font-extrabold text-white leading-tight tracking-tight">
                        Empowering Connection,<br />
                        <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                            Redefining ERP.
                        </span>
                    </h1>
                    <p className="mt-3 text-slate-400 text-xs leading-relaxed max-w-sm">
                        Manage your Jasmin Mobile distribution, sales network, agreements, and business processes in one advanced management platform.
                    </p>
                </div>
            </div>

            {/* Right Column: Login Form (50% width on md and above) - Added overflow-y-auto */}
            <div className="w-full md:w-1/2 h-full flex flex-col justify-between p-5 sm:p-8 relative bg-transparent overflow-y-auto z-10">

                {/* Top spacer */}
                <div className="h-2 sm:h-4"></div>

                {/* Form Card Container (centered) */}
                <div className="w-full max-w-md mx-auto z-10 flex flex-col justify-center flex-grow py-3">
                    {/* Logo & Heading */}
                    <div className="flex flex-col items-center mb-4">
                        <img
                            src={logo}
                            alt="Jasmin Logo"
                            className="h-16 sm:h-20 w-auto mb-2 drop-shadow-[0_4px_16px_rgba(168,85,247,0.25)] hover:scale-105 transition-transform duration-300"
                        />
                        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight text-center">
                            Welcome Back
                        </h2>
                        <p className="text-slate-400 text-xs mt-1 text-center">
                            Sign in to your ERP dashboard
                        </p>
                    </div>

                    {/* Premium Dark Glassmorphic Form Card */}
                    <div className="bg-slate-900/40 backdrop-blur-2xl border border-slate-800/80 rounded-3xl p-5 sm:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.35)] hover:shadow-[0_25px_60px_rgba(0,0,0,0.55)] hover:border-purple-500/20 transition-all duration-300">
                        <form onSubmit={handleLogin} className="space-y-4">
                            
                            {/* Username Field */}
                            <div className="space-y-1.5">
                                <label htmlFor="username" className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                    Username
                                </label>
                                <div className="relative">
                                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4.5 h-4.5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                                        </svg>
                                    </span>
                                    <input
                                        id="username"
                                        name="username"
                                        type="text"
                                        required
                                        placeholder="Enter your username"
                                        value={form.username}
                                        onChange={(e) => setForm({ ...form, username: e.target.value })}
                                        className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-800 bg-slate-950/60 text-white text-xs sm:text-sm outline-none transition-all duration-200 placeholder:text-slate-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 focus:bg-slate-900/60"
                                    />
                                </div>
                            </div>

                            {/* Password Field */}
                            <div className="space-y-1.5">
                                <label htmlFor="password" className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                    Password
                                </label>
                                <div className="relative">
                                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4.5 h-4.5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                                        </svg>
                                    </span>
                                    <input
                                        id="password"
                                        name="password"
                                        type={showPassword ? "text" : "password"}
                                        required
                                        placeholder="Enter your password"
                                        value={form.password}
                                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                                        className="w-full pl-11 pr-12 py-2.5 rounded-xl border border-slate-800 bg-slate-950/60 text-white text-xs sm:text-sm outline-none transition-all duration-200 placeholder:text-slate-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 focus:bg-slate-900/60"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                                        tabIndex={-1}
                                    >
                                        {showPassword ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4.5 h-4.5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                                            </svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4.5 h-4.5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Submit Button */}
                             <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-2.5 rounded-xl text-white text-xs sm:text-sm font-semibold tracking-wider transition-all duration-300 bg-purple-600 hover:bg-purple-500 shadow-[0_4px_15px_rgba(122,5,189,0.3)] hover:shadow-[0_4px_25px_rgba(122,5,189,0.5)] hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:opacity-75 disabled:cursor-not-allowed flex justify-center items-center gap-2 cursor-pointer"
                            >
                                {loading ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        Signing in...
                                    </>
                                ) : (
                                    <>
                                        <span>Sign In</span>
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                                        </svg>
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Footer */}
                <div className="z-10 mt-auto flex flex-col sm:flex-row justify-between items-center gap-2 border-t border-slate-900/60 pt-3 text-[10px] text-slate-500 w-full max-w-md mx-auto">
                    <div className="flex items-center gap-1.5">
                        <span>Powered by</span>
                        <img src={jwlogo} alt="Jeenweb" className="h-5 w-auto rounded-sm opacity-60 hover:opacity-90 transition-opacity" />
                    </div>
                    <div className="text-center sm:text-right">
                        <div>Helpline: <a href="tel:9824466017" className="font-semibold text-slate-400 hover:text-slate-300 transition-colors">9824466017</a></div>
                        <div>Email: <a href="mailto:info@jeenweb.com" className="font-semibold text-slate-400 hover:text-slate-300 transition-colors">info@jeenweb.com</a></div>
                    </div>
                </div>
            </div>
        </div>
    );
}
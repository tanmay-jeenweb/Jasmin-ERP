import AppRoutes from "./routes";
import Footer from "./components/Footer";
import { useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { getDeviceId } from "./utils/device";
import LoginAlertModal from "./components/LoginAlertModal";
import { getActiveAlerts } from "./api/alertApi";
// New branch push
function App() {
    const location = useLocation();
    const hideFooterOnPaths = ["/"];
    const shouldHideFooter = hideFooterOnPaths.includes(location.pathname);

    const [activeAlerts, setActiveAlerts] = useState([]);
    const [showAlertModal, setShowAlertModal] = useState(false);

    useEffect(() => {
        const checkAlerts = async () => {
            const hasSeen = sessionStorage.getItem("alertShown");
            const isLoggedIn = localStorage.getItem("token") && localStorage.getItem("user");

            if (isLoggedIn && hasSeen !== "true") {
                try {
                    const response = await getActiveAlerts();
                    const alerts = response.data?.data || [];
                    if (alerts.length > 0) {
                        setActiveAlerts(alerts);
                        setShowAlertModal(true);
                    } else {
                        sessionStorage.setItem("alertShown", "true");
                    }
                } catch (error) {
                    console.error("Failed to fetch active alerts:", error);
                }
            }
        };
        checkAlerts();
    }, [location.pathname]);

    const [watermarkText, setWatermarkText] = useState("");

    useEffect(() => {
        const initWatermark = async () => {
            if (location.pathname === "/" || location.pathname === "/device-registration") {
                setWatermarkText("");
                return;
            }
            try {
                const devId = await getDeviceId();
                const userStr = localStorage.getItem("user");
                const user = userStr ? JSON.parse(userStr) : null;
                const username = user?.username || user?.name || "Guest";

                const today = new Date();
                const dd = String(today.getDate()).padStart(2, '0');
                const mm = String(today.getMonth() + 1).padStart(2, '0');
                const yyyy = today.getFullYear();
                const dateStr = `${dd}/${mm}/${yyyy}`;

                setWatermarkText(`${username}-${dateStr}-${devId}`);
            } catch (e) {
                console.error("Watermark init failed", e);
            }
        };
        initWatermark();
    }, [location.pathname]);

    const svgString = watermarkText ? `<svg xmlns="http://www.w3.org/2000/svg" width="340" height="200">
  <text 
    x="50%" 
    y="50%" 
    font-size="11" 
    font-family="'Inter', sans-serif" 
    fill="rgba(255, 3, 3, 0.32)" 
    text-anchor="middle" 
    transform="rotate(-25, 140, 70)"
  >
    ${watermarkText}
  </text>
</svg>` : "";

    const watermarkBg = svgString
        ? `url("data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgString)))}")`
        : "none";

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 relative">
            {watermarkText && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        pointerEvents: "none",
                        zIndex: 99999,
                        backgroundImage: watermarkBg,
                        backgroundRepeat: "repeat",
                        userSelect: "none",
                        WebkitUserSelect: "none"
                    }}
                />
            )}
            <div className="flex-1 flex flex-col">
                <AppRoutes />
            </div>
            {!shouldHideFooter && <Footer />}
            {showAlertModal && (
                <LoginAlertModal
                    alerts={activeAlerts}
                    onClose={() => {
                        setShowAlertModal(false);
                        sessionStorage.setItem("alertShown", "true");
                    }}
                />
            )}
        </div>
    );
}

export default App;
import AppRoutes from "./routes";
import Footer from "./components/Footer";
import { useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { getDeviceId } from "./utils/device";
// New branch push
function App() {
    const location = useLocation();
    const hideFooterOnPaths = ["/"];
    const shouldHideFooter = hideFooterOnPaths.includes(location.pathname);

    const [watermarkText, setWatermarkText] = useState("");

    useEffect(() => {
        const initWatermark = async () => {
            try {
                const devId = await getDeviceId();
                const userStr = localStorage.getItem("user");
                const user = userStr ? JSON.parse(userStr) : null;
                const username = user?.username || user?.name || "Guest";
                setWatermarkText(`${username}-${devId}`);
            } catch (e) {
                console.error("Watermark init failed", e);
            }
        };
        initWatermark();
    }, [location.pathname]);

    const svgString = watermarkText ? `<svg xmlns="http://www.w3.org/2000/svg" width="450" height="280">
  <text 
    x="50%" 
    y="50%" 
    font-size="14" 
    font-family="'Inter', sans-serif" 
    fill="rgba(255, 3, 3, 0.32)" 
    text-anchor="middle" 
    transform="rotate(-28, 225, 140)"
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
        </div>
    );
}

export default App;
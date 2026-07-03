import AppRoutes from "./routes";
import Footer from "./components/Footer";
import { useLocation } from "react-router-dom";

function App() {
    const location = useLocation();
    const hideFooterOnPaths = ["/"];
    const shouldHideFooter = hideFooterOnPaths.includes(location.pathname);

    return (
        <div className="flex flex-col min-h-screen bg-slate-50">
            <div className="flex-1 flex flex-col">
                <AppRoutes />
            </div>
            {!shouldHideFooter && <Footer />}
        </div>
    );
}

export default App;
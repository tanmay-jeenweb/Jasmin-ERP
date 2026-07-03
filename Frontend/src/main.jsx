import React from "react";
import ReactDOM from "react-dom/client";

import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { PermissionProvider } from "./context/PermissionContext";

import App from "./App";
import "./index.css";

ReactDOM.createRoot(
    document.getElementById("root")
).render(

    <BrowserRouter>
        <PermissionProvider>
            <App />
            <Toaster position="top-right" />
        </PermissionProvider>
    </BrowserRouter>
);
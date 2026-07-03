require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const path = require("path");
const uploadConfig = require("./config/uploadConfig.js");
const { connectDB } = require("./config/db.js");

// Routes
const authRoutes = require("./routes/authRoutes.js");
const adminRoutes = require("./routes/adminRoutes.js");
const userTypeMasterRoutes = require("./routes/userTypeMasterRoutes.js");
const mobileBrandRoutes = require("./routes/mobileBrandRoutes.js");
const bankRoutes = require("./routes/bankRoutes.js");
const financeMachineRoutes = require("./routes/financeMachineRoutes.js");

// Model Initializations
const { initUserModel } = require("./models/userModel.js");
const { createUserTypesTable, createUserTypePermissionsTable } = require("./models/userTypeModel.js");
const { createAuditLogsTable } = require("./models/auditLogModel.js");
const { createUserDevicesTable } = require("./models/deviceModel.js");
const { createMobileBrandsTable } = require("./models/mobileBrandModel.js");
const { createBankTable } = require("./models/bankModel.js");
const { createFinanceMachineTable } = require("./models/financeMachineModel.js");


const app = express();

const allowedOrigins = [
    "http://localhost:5173",
    "https://crm.jasminmobile.com",
    "http://crm.jasminmobile.com",
    "https://www.crm.jasminmobile.com",
    "http://www.crm.jasminmobile.com",
    process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
    origin: allowedOrigins,
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-HTTP-Method-Override", "x-device-id", "device-id"],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
}));
app.use(express.json());
app.use(cookieParser());

// Serve uploaded files statically if set to express
if (uploadConfig.serveMethod === "express") {
    console.log(`Serving uploaded files statically from: ${uploadConfig.uploadDir}`);
    app.use("/uploads", express.static(uploadConfig.uploadDir));
}

// HTTP Method Override middleware for environments that block PUT and DELETE requests
app.use((req, res, next) => {
    const methodOverride = req.headers['x-http-method-override'];
    if (req.method === 'POST' && methodOverride) {
        req.method = methodOverride.toUpperCase();
    }
    next();
});

app.use(["/api/auth", "/auth"], authRoutes);
app.use(["/api/admin", "/admin"], adminRoutes);
app.use(["/api/usertypes", "/usertypes"], userTypeMasterRoutes);
app.use(["/api/mobilebrands", "/mobilebrands"], mobileBrandRoutes);
app.use(["/api/banks", "/banks"], bankRoutes);
app.use(["/api/financemachines", "/financemachines"], financeMachineRoutes);


// Global 404 handler
app.use((req, res) => {
    res.status(404).json({ success: false, message: "Route not found" });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error("Unhandled Error:", err.stack);
    res.status(500).json({ success: false, message: "Something went wrong" });
});

const startServer = async () => {
    try {
        await connectDB();

        console.log("Initializing database tables...");
        // Initialize tables in correct dependency order
        await initUserModel();
        await createUserTypesTable();
        await createUserTypePermissionsTable();
        await createAuditLogsTable();
        await createUserDevicesTable();
        await createMobileBrandsTable();
        await createBankTable();
        await createFinanceMachineTable();

        console.log("All database tables are initialized and ready.");

        const PORT = process.env.PORT || 5000;
        app.listen(PORT, () => {
            console.log(`Server Running on Port ${PORT}`);
        });
    } catch (error) {
        console.error("Failed to start application server:", error);
        process.exit(1);
    }
};

startServer();
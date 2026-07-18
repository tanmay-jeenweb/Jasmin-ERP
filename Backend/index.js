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
const { createStateTable } = require("./models/stateModel.js");
const stateRoutes = require("./routes/stateRoutes.js");
const { createSupportTable } = require("./models/supportModel.js");
const supportRoutes = require("./routes/supportRoutes.js");
const { createProductTypeTable } = require("./models/productTypeModel.js");
const productTypeRoutes = require("./routes/productTypeRoutes.js");
const { createItemModelsTable } = require("./models/itemModelModel.js");
const itemModelRoutes = require("./routes/itemModelRoutes.js");
const { createModelGroupsTable } = require("./models/modelGroupModel.js");
const modelGroupRoutes = require("./routes/modelGroupRoutes.js");
const { createBranchTable } = require("./models/branchModel.js");
const branchRoutes = require("./routes/branchRoutes.js");
const { createBranchFinanceCodeTables } = require("./models/branchFinanceModel.js");
const branchFinanceRoutes = require("./routes/branchFinanceRoutes.js");
const { createOffersTable } = require("./models/offerModel.js");
const offerRoutes = require("./routes/offerRoutes.js");
const { createTargetVsAchievementsTable } = require("./models/targetVsAchievementModel.js");
const targetVsAchievementRoutes = require("./routes/targetVsAchievementRoutes.js");
const { createStockCashDepositTable } = require("./models/stockCashDepositModel.js");
const stockCashDepositRoutes = require("./routes/stockCashDepositRoutes.js");
const { createUserBranchMappingsTable } = require("./models/userBranchMappingModel.js");
const userBranchMappingRoutes = require("./routes/userBranchMappingRoutes.js");
const brandWiseSalesRoutes = require("./routes/brandWiseSalesRoutes.js");
const { createAlertsTable } = require("./models/alertModel.js");
const alertRoutes = require("./routes/alertRoutes.js");
const { createBranchBrandFinanceMappingTable } = require("./models/branchBrandFinanceMappingModel.js");
const branchBrandFinanceMappingRoutes = require("./routes/branchBrandFinanceMappingRoutes.js");
const branchBrandFinanceReportRoutes = require("./routes/branchBrandFinanceReportRoutes.js");
const { createVariationTable } = require("./models/variationModel.js");
const variationRoutes = require("./routes/variationRoutes.js");
const priceListRoutes = require("./routes/priceListRoutes.js");



const app = express();

const allowedOrigins = [
    "http://localhost:5173",
    "https://crm.jasminmobile.com",
    "http://crm.jasminmobile.com",
    "https://www.crm.jasminmobile.com",
    "http://www.crm.jasminmobile.com",
    "https://erp.jasminmobile.com",
    "http://erp.jasminmobile.com",
    "https://www.erp.jasminmobile.com",
    "http://www.erp.jasminmobile.com",
    process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
    origin: allowedOrigins,
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-HTTP-Method-Override", "x-device-id", "device-id"],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
}));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
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
app.use(["/api/states", "/states"], stateRoutes);
app.use(["/api/support", "/support"], supportRoutes);
app.use(["/api/producttypes", "/producttypes"], productTypeRoutes);
app.use(["/api/itemmodels", "/itemmodels"], itemModelRoutes);
app.use(["/api/modelgroups", "/modelgroups"], modelGroupRoutes);
app.use(["/api/branches", "/branches"], branchRoutes);
app.use(["/api/branches/finance-codes", "/branches/finance-codes"], branchFinanceRoutes);
app.use(["/api/offers", "/offers"], offerRoutes);
app.use(["/api/target-vs-achievement", "/target-vs-achievement"], targetVsAchievementRoutes);
app.use(["/api/stock-cash-deposit", "/stock-cash-deposit"], stockCashDepositRoutes);
app.use(["/api/user-branch-mappings", "/user-branch-mappings", "/api/user-branch-mapping", "/user-branch-mapping"], userBranchMappingRoutes);
app.use(["/api/brand-wise-sales", "/brand-wise-sales"], brandWiseSalesRoutes);
app.use(["/api/alerts", "/alerts"], alertRoutes);
app.use(["/api/branch-brand-finance-mapping", "/branch-brand-finance-mapping"], branchBrandFinanceMappingRoutes);
app.use(["/api/reports", "/reports"], branchBrandFinanceReportRoutes);
app.use(["/api/variations", "/variations"], variationRoutes);
app.use(["/api/price-lists", "/price-lists"], priceListRoutes);



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
        await createStateTable();
        await createSupportTable();
        await createProductTypeTable();
        await createItemModelsTable();
        await createModelGroupsTable();
        await createBranchTable();
        await createBranchFinanceCodeTables();
        await createOffersTable();
        await createTargetVsAchievementsTable();
        await createStockCashDepositTable();
        await createUserBranchMappingsTable();
        await createAlertsTable();
        await createBranchBrandFinanceMappingTable();
        await createVariationTable();


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
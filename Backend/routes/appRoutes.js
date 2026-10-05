const express = require("express");
const router = express.Router();
const {
    downloadApk,
    checkAppVersion,
    setAppVersion
} = require("../controllers/appVersionController.js");
const { verifyToken } = require("../middleware/authMiddleware.js");

// Public endpoints for direct mobile app / browser access
router.get("/download", downloadApk);
router.get("/version", checkAppVersion);
router.get("/check-update", checkAppVersion);

// Protected endpoint for updating the version setting
router.post("/version", verifyToken, setAppVersion);

module.exports = router;

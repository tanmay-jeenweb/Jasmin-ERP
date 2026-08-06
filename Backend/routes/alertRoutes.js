const express = require("express");
const {
    createAlertController,
    getAllAlertsController,
    getActiveAlertsController,
    updateAlertController,
    deleteAlertController,
    toggleAlertActiveController
} = require("../controllers/alertControllers.js");
const { verifyToken, verifyAdmin, verifyPermission } = require("../middleware/authMiddleware.js");
const upload = require("../middleware/uploadMiddleware.js");

const router = express.Router();

// Public/Authenticated routes (any logged-in user can check for active alerts)
router.get("/active", verifyToken, getActiveAlertsController);

// Protected routes (mapped to alert_master permissions)
router.post("/", verifyToken, verifyPermission("alert_master", "write"), upload.single("image"), createAlertController);
router.get("/", verifyToken, verifyPermission("alert_master", "read"), getAllAlertsController);
router.put("/:id", verifyToken, verifyPermission("alert_master", "update"), upload.single("image"), updateAlertController);
router.delete("/:id", verifyToken, verifyPermission("alert_master", "delete"), deleteAlertController);
router.patch("/:id/toggle", verifyToken, verifyPermission("alert_master", "update"), toggleAlertActiveController);

module.exports = router;

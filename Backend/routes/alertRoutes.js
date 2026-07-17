const express = require("express");
const {
    createAlertController,
    getAllAlertsController,
    getActiveAlertsController,
    updateAlertController,
    deleteAlertController,
    toggleAlertActiveController
} = require("../controllers/alertControllers.js");
const { verifyToken, verifyAdmin } = require("../middleware/authMiddleware.js");
const upload = require("../middleware/uploadMiddleware.js");

const router = express.Router();

// Public/Authenticated routes (any logged-in user can check for active alerts)
router.get("/active", verifyToken, getActiveAlertsController);

// Protected routes (Admin/Super Admin only)
router.post("/", verifyToken, verifyAdmin, upload.single("image"), createAlertController);
router.get("/", verifyToken, verifyAdmin, getAllAlertsController);
router.put("/:id", verifyToken, verifyAdmin, upload.single("image"), updateAlertController);
router.delete("/:id", verifyToken, verifyAdmin, deleteAlertController);
router.patch("/:id/toggle", verifyToken, verifyAdmin, toggleAlertActiveController);

module.exports = router;

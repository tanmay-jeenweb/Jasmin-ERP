const express = require("express");

const {
    fetchUsers,
    createUserByAdmin,
    approveDeviceController,
    revokeDeviceController,
    fetchAuditLogs,
    fetchUserAuditLogs,
    fetchActivityLogs,
    fetchPendingDevices,
    toggleUserActiveController,
    fetchUserActiveDevicesController,
    revokeSpecificDeviceController
} = require("../controllers/adminController.js");
const { verifyToken, verifyAdmin, verifyPermission } = require("../middleware/authMiddleware.js");

const router = express.Router();

router.get("/users", verifyToken, verifyPermission("user_master", "read"), fetchUsers);
router.post("/create-user", verifyToken, verifyPermission("user_master", "write"), createUserByAdmin);
router.patch("/user/:id/toggle-active", verifyToken, verifyPermission("user_master", "update"), toggleUserActiveController);

router.get("/pending-devices", verifyToken, verifyPermission("device_approval", "read"), fetchPendingDevices);
router.put("/approve-device/:deviceRowId", verifyToken, verifyPermission("device_approval", "write"), approveDeviceController);
router.put("/revoke-device/:userId", verifyToken, verifyPermission("device_approval", "write"), revokeDeviceController);
router.get("/devices/user/:userId", verifyToken, verifyPermission("device_approval", "read"), fetchUserActiveDevicesController);
router.put("/devices/revoke/:deviceRowId", verifyToken, verifyPermission("device_approval", "write"), revokeSpecificDeviceController);

router.get("/audit-logs", verifyToken, verifyPermission("device_approval", "read"), fetchAuditLogs);
router.get("/audit-logs/:userId", verifyToken, verifyPermission("device_approval", "read"), fetchUserAuditLogs);
router.get('/activity-logs', verifyToken, verifyPermission("activity_report", "read"), fetchActivityLogs);

module.exports = router;    
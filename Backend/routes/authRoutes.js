const express = require("express");

const {
    login,
    logout,
    refresh,
    updateProfileController,
    requestDeviceRegistration,
    getMyPermissions,
    getActiveUsersController,
    getApprovedDevicesController
} = require("../controllers/authControllers.js");
const { verifyToken } = require("../middleware/authMiddleware.js");

const router = express.Router();

router.post("/login", login);
router.post("/request-device", requestDeviceRegistration);
router.post("/approved-devices", getApprovedDevicesController);
router.post("/logout", logout);
router.post("/refresh", refresh);
router.put("/update-profile", verifyToken, updateProfileController);
router.get("/my-permissions", verifyToken, getMyPermissions);
router.get("/active-users", verifyToken, getActiveUsersController);

module.exports = router;
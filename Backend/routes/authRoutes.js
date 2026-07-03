const express = require("express");

const {
    login,
    logout,
    updateProfileController,
    requestDeviceRegistration,
    getMyPermissions,
    getActiveUsersController
} = require("../controllers/authControllers.js");
const { verifyToken } = require("../middleware/authMiddleware.js");

const router = express.Router();

router.post("/login", login);
router.post("/request-device", requestDeviceRegistration);
router.post("/logout", logout);
router.put("/update-profile", verifyToken, updateProfileController);
router.get("/my-permissions", verifyToken, getMyPermissions);
router.get("/active-users", verifyToken, getActiveUsersController);

module.exports = router;
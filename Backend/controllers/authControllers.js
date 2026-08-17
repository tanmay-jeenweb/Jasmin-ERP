const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/db.js");

const {
    findUserByUsername,
    updateUserProfile
} = require("../models/userModel.js");

const { createAuditLog } = require("../models/auditLogModel.js");

const {
    getApprovedDevices,
    getPendingDevice,
    createPendingDevice
} = require("../models/deviceModel.js");

// ================= LOGIN =================

const login = async (req, res) => {
    try {
        const {
            username,
            password,
            deviceId
        } = req.body;

        // Validate Input
        if (!username || !password || !deviceId) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        // Find User
        const user = await findUserByUsername(username);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        if (user.active === 0 || user.active === false) {
            return res.status(403).json({
                success: false,
                message: "Your account is deactivated. Please contact an administrator."
            });
        }

        // Compare Password
        const isPasswordCorrect = await bcrypt.compare(password, user.password);
        if (!isPasswordCorrect) {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials"
            });
        }

        // Helper to format landing_type array
        let userLandingType = user.landing_type;
        if (typeof userLandingType === 'string') {
            try { userLandingType = JSON.parse(userLandingType); } catch (e) { userLandingType = [userLandingType]; }
        }
        if (!userLandingType) userLandingType = ["All"];

        let userState = user.state;
        if (typeof userState === 'string') {
            try { userState = JSON.parse(userState); } catch (e) { userState = [userState]; }
        }

        // ================= ADMIN LOGIN =================
        if (user.role === "admin" && (user.device_verification_required === 0 || user.device_verification_required === false)) {
            const token = jwt.sign(
                { id: user.id, role: user.role, name: user.name, username: user.username, mob_no: user.mob_no },
                process.env.JWT_SECRET,
                { expiresIn: "1d" }
            );

            return res.status(200).json({
                success: true,
                message: "Admin login successful",
                token,
                user: {
                    id: user.id,
                    name: user.name,
                    username: user.username,
                    email: user.email,
                    role: user.role,
                    mob_no: user.mob_no,
                    modules: user.modules || [],
                    landing_type: userLandingType,
                    state: userState
                }
            });
        }

        // ================= DEVICE MATCHING =================
        if (user.device_verification_required === 0 || user.device_verification_required === false) {
            const token = jwt.sign(
                { id: user.id, role: user.role, name: user.name, username: user.username, mob_no: user.mob_no },
                process.env.JWT_SECRET,
                { expiresIn: "1d" }
            );

            return res.status(200).json({
                success: true,
                message: "Login successful",
                token,
                user: {
                    id: user.id,
                    name: user.name,
                    username: user.username,
                    email: user.email,
                    role: user.role,
                    mob_no: user.mob_no,
                    modules: user.modules || [],
                    landing_type: userLandingType,
                    state: userState
                }
            });
        }

        const approvedDevices = await getApprovedDevices(user.id);
        const isDeviceApproved = approvedDevices.some(d => d.device_id === deviceId);

        if (isDeviceApproved) {
            // Device matches, login successful
            const token = jwt.sign(
                { id: user.id, role: user.role, name: user.name, username: user.username, mob_no: user.mob_no },
                process.env.JWT_SECRET,
                { expiresIn: "1d" }
            );

            return res.status(200).json({
                success: true,
                message: "Login successful",
                token,
                user: {
                    id: user.id,
                    name: user.name,
                    username: user.username,
                    email: user.email,
                    role: user.role,
                    mob_no: user.mob_no,
                    modules: user.modules || [],
                    landing_type: userLandingType,
                    state: userState
                }
            });
        }

        // If the current device is not approved, check if there is a pending registration request for this device
        const [pendingRows] = await db.execute(
            "SELECT * FROM user_devices WHERE user_id = ? AND status = 'pending' AND closed_at IS NULL AND device_id = ?",
            [user.id, deviceId]
        );
        
        if (pendingRows.length > 0) {
            return res.status(200).json({
                success: false,
                status: "PENDING_APPROVAL"
            });
        }

        // No pending or approved device, needs registration
        return res.status(200).json({
            success: false,
            status: "DEVICE_REGISTRATION_REQUIRED",
            message: "New device detected. Registration required.",
            approvedDevices: approvedDevices.map(d => ({
                id: d.id,
                device_id: d.device_id,
                submitted_at: d.submitted_at
            }))
        });

    } catch (error) {
        console.error("Login Error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });
    }
};

// ================= REQUEST DEVICE REGISTRATION =================

const requestDeviceRegistration = async (req, res) => {
    try {
        const { username, password, deviceId, revokeDeviceId } = req.body;

        if (!username || !password || !deviceId) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        const user = await findUserByUsername(username);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        if (user.active === 0 || user.active === false) {
            return res.status(403).json({
                success: false,
                message: "Your account is deactivated. Please contact an administrator."
            });
        }

        const isPasswordCorrect = await bcrypt.compare(password, user.password);
        if (!isPasswordCorrect) {
            return res.status(401).json({ success: false, message: "Invalid credentials" });
        }

        // Check if user already has 3 approved devices
        const approvedDevices = await getApprovedDevices(user.id);
        if (approvedDevices.length >= 3 && !revokeDeviceId) {
            return res.status(400).json({
                success: false,
                message: "Maximum limit of 3 devices reached. Please select a device to replace."
            });
        }

        if (revokeDeviceId) {
            // Revoke the chosen device immediately so the user deletes/removes it themselves
            const revokeQuery = `
                UPDATE user_devices
                SET status = 'revoked', closed_at = NOW(), closed_by = NULL
                WHERE user_id = ? AND id = ? AND status = 'approved' AND closed_at IS NULL
            `;
            const [revokeResult] = await db.execute(revokeQuery, [user.id, revokeDeviceId]);
            if (revokeResult.affectedRows === 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid device selected for replacement."
                });
            }
        }

        // Create pending device with optional replacement ID
        await createPendingDevice(user.id, deviceId, revokeDeviceId || null);

        await createAuditLog(
            user.id,
            user.name || user.username || 'Unknown',
            deviceId,
            'Device Management',
            'registration_requested',
            null,
            {
                user_id: user.id,
                username: user.username,
                device_id: deviceId,
                status: 'pending',
                replaces_device_id: revokeDeviceId || null
            }
        );

        return res.status(200).json({
            success: true,
            status: "PENDING_APPROVAL"
        });

    } catch (error) {
        console.error("Device Registration Error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });
    }
};


// ================= LOGOUT =================

const logout = async (req, res) => {
    try {
        return res.status(200).json({
            success: true,
            message: "Logged out successfully"
        });
    } catch (error) {
        console.error("Logout Error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });
    }
};

// ================= UPDATE PROFILE =================

const updateProfileController = async (req, res) => {
    try {
        const {name, email, mob_no} = req.body;
        const userId = req.user.id;

        if (!name || !email || !mob_no) {
            return res.status(400).json({
                success: false,
                message: "Name, email, and mobile number are required"
            });
        }

        await updateUserProfile(userId, name, email, mob_no);

        return res.status(200).json({
            success: true,
            message: "Profile updated successfully",
            user: {
                id: userId,
                name,
                email,
                mob_no,
                role: req.user.role
            }
        });
        
    } catch (error) {
        console.error("Update Profile Error:", error);
        if (error.code === 'ER_DUP_ENTRY') {
            const message = error.sqlMessage || error.message || '';
            if (message.includes('email')) {
                return res.status(400).json({ success: false, message: "Email already exists" });
            }
            if (message.includes('username')) {
                return res.status(400).json({ success: false, message: "Username already exists" });
            }
            return res.status(400).json({ success: false, message: "Email or username already exists" });
        }
        return res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });
    }
};

// ================= GET MY PERMISSIONS =================
const getMyPermissions = async (req, res) => {
    try {
        const userId = req.user.id;

        // Admin has unrestricted access — return a wildcard flag or full permissions
        if (req.user.role === 'admin') {
            return res.status(200).json({
                success: true,
                isAdmin: true,
                permissions: {}
            });
        }

        // Get the user's user_type_id
        const [userRows] = await db.execute(
            'SELECT user_type_id FROM users WHERE id = ?',
            [userId]
        );

        if (!userRows.length || !userRows[0].user_type_id) {
            return res.status(200).json({
                success: true,
                isAdmin: false,
                permissions: {}
            });
        }

        const userTypeId = userRows[0].user_type_id;

        // Fetch all permission rows for this user type
        const [rows] = await db.execute(
            `SELECT master_name, can_read, can_write, can_update, can_delete
             FROM user_type_permissions
             WHERE user_type_id = ?`,
            [userTypeId]
        );

        // Build a keyed map: { location_type: { read, write, update, delete }, ... }
        const permissions = {};
        for (const row of rows) {
            permissions[row.master_name] = {
                read:   !!row.can_read,
                write:  !!row.can_write,
                update: !!row.can_update,
                delete: !!row.can_delete,
            };
        }

        return res.status(200).json({
            success: true,
            isAdmin: false,
            permissions
        });

    } catch (error) {
        console.error('getMyPermissions Error:', error);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

const getActiveUsersController = async (req, res) => {
    try {
        const { getAllUsers } = require("../models/userModel.js");
        const users = await getAllUsers(false);
        const mapped = users.map(u => ({
            id: u.id,
            name: u.name,
            username: u.username,
            email: u.email
        }));
        return res.status(200).json({
            success: true,
            data: mapped
        });
    } catch (error) {
        console.error("Get Active Users Error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });
    }
};

const getApprovedDevicesController = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: "Username and password are required"
            });
        }

        const user = await findUserByUsername(username);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const isPasswordCorrect = await bcrypt.compare(password, user.password);
        if (!isPasswordCorrect) {
            return res.status(401).json({ success: false, message: "Invalid credentials" });
        }

        const approvedDevices = await getApprovedDevices(user.id);

        return res.status(200).json({
            success: true,
            approvedDevices: approvedDevices.map(d => ({
                id: d.id,
                device_id: d.device_id,
                submitted_at: d.submitted_at
            }))
        });

    } catch (error) {
        console.error("Get Approved Devices Error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });
    }
};

module.exports = {
    login,
    logout,
    updateProfileController,
    requestDeviceRegistration,
    getMyPermissions,
    getActiveUsersController,
    getApprovedDevicesController
};
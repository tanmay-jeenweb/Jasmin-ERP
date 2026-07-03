const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/db.js");

const {
    findUserByUsername,
    updateUserProfile
} = require("../models/userModel.js");

const { createAuditLog } = require("../models/auditLogModel.js");

const {
    getApprovedDevice,
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
                    modules: user.modules || []
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
                    modules: user.modules || []
                }
            });
        }

        const approvedDevice = await getApprovedDevice(user.id);

        if (approvedDevice) {
            if (approvedDevice.device_id === deviceId) {
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
                        modules: user.modules || []
                    }
                });
            } else {
                // Device mismatch, check if they have a pending device for this deviceId
                const pendingDevice = await getPendingDevice(user.id);
                if (pendingDevice && pendingDevice.device_id === deviceId) {
                    return res.status(200).json({
                        success: false,
                        status: "PENDING_APPROVAL"
                    });
                }
                return res.status(200).json({
                    success: false,
                    status: "DEVICE_REGISTRATION_REQUIRED",
                    message: "New device detected. Registration required."
                });
            }
        }

        // No approved device found
        const pendingDevice = await getPendingDevice(user.id);
        if (pendingDevice) {
            return res.status(200).json({
                success: false,
                status: "PENDING_APPROVAL"
            });
        }

        // No pending or approved device, needs registration
        return res.status(200).json({
            success: false,
            status: "DEVICE_REGISTRATION_REQUIRED"
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
        const { username, password, deviceId } = req.body;

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

        // Create pending device
        await createPendingDevice(user.id, deviceId);

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
                status: 'pending'
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

module.exports = {
    login,
    logout,
    updateProfileController,
    requestDeviceRegistration,
    getMyPermissions,
    getActiveUsersController
};
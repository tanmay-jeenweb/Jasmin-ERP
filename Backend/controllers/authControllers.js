const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/db.js");

const {
    findUserByUsername,
    updateUserProfile
} = require("../models/userModel.js");

const {
    addRefreshToken,
    findRefreshToken,
    deleteRefreshToken,
    deleteExpiredRefreshTokens
} = require("../models/refreshTokenModel.js");

const { createAuditLog } = require("../models/auditLogModel.js");

const {
    getApprovedDevices,
    getPendingDevice,
    createPendingDevice
} = require("../models/deviceModel.js");

// Helper to generate access and refresh tokens, set cookie, and respond
const generateTokensAndRespond = async (req, user, userLandingType, userState, deviceId, res, message, isMobileLogin = false) => {
    // Generate Access Token (short-lived, configured in env, default 15m)
    const token = jwt.sign(
        { id: user.id, role: user.role, name: user.name, username: user.username, mob_no: user.mob_no, mobile: isMobileLogin },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_ACCESS_EXPIRATION || "15m" }
    );

    // Generate Refresh Token (long-lived, configured in env, default 7d)
    const refreshExpiresIn = process.env.JWT_REFRESH_EXPIRATION || "7d";
    const refreshToken = jwt.sign(
        { id: user.id, mobile: isMobileLogin },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: refreshExpiresIn }
    );

    // Calculate expiration timestamp
    let durationMs = 7 * 24 * 60 * 60 * 1000; // default 7 days
    const match = refreshExpiresIn.match(/^(\d+)([dhm])$/);
    if (match) {
        const val = parseInt(match[1], 10);
        const unit = match[2];
        if (unit === 'd') durationMs = val * 24 * 60 * 60 * 1000;
        else if (unit === 'h') durationMs = val * 60 * 60 * 1000;
        else if (unit === 'm') durationMs = val * 60 * 1000;
    }
    const expiresAt = new Date(Date.now() + durationMs);

    // Save Refresh Token to database
    await addRefreshToken(user.id, refreshToken, deviceId || null, expiresAt);

    // Set Refresh Token in HTTP-only cookie
    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: durationMs
    });

    // Clean up expired tokens in background
    try {
        await deleteExpiredRefreshTokens();
    } catch (e) {
        console.error("Failed to delete expired refresh tokens:", e);
    }

    // Log login activity
    try {
        await createAuditLog(
            user.id,
            user.name || user.username || 'Unknown',
            deviceId || null,
            'User Authentication',
            'login',
            null,
            {
                platform: isMobileLogin ? "Mobile App" : "Web Application",
                status: "Login successful"
            }
        );
    } catch (logError) {
        console.error("Failed to create login audit log:", logError);
    }

    return res.status(200).json({
        success: true,
        message,
        token,
        refreshToken, // Fallback for client applications not using cookies
        user: {
            id: user.id,
            name: user.name,
            username: user.username,
            email: user.email,
            role: user.role,
            mob_no: user.mob_no,
            modules: user.modules || [],
            landing_type: userLandingType,
            state: userState,
            mobile: isMobileLogin
        }
    });
};

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

        // Check Web/Mobile Access permission
        const isMobileLogin = req.body.mobile === true || req.body.mobile === 'true';
        if (isMobileLogin) {
            if (user.mobile_access === 0 || user.mobile_access === false) {
                return res.status(403).json({
                    success: false,
                    message: "Mobile access is disabled for this account. Please contact an administrator."
                });
            }
        } else {
            if (user.web_access === 0 || user.web_access === false) {
                return res.status(403).json({
                    success: false,
                    message: "Web access is disabled for this account. Please contact an administrator."
                });
            }
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
            return await generateTokensAndRespond(req, user, userLandingType, userState, deviceId, res, "Admin login successful", isMobileLogin);
        }

        // ================= DEVICE MATCHING =================
        if (user.device_verification_required === 0 || user.device_verification_required === false) {
            return await generateTokensAndRespond(req, user, userLandingType, userState, deviceId, res, "Login successful", isMobileLogin);
        }

        const approvedDevices = await getApprovedDevices(user.id);
        const isDeviceApproved = approvedDevices.some(d => d.device_id === deviceId);

        if (isDeviceApproved) {
            // Device matches, login successful
            return await generateTokensAndRespond(req, user, userLandingType, userState, deviceId, res, "Login successful", isMobileLogin);
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
        const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
        if (refreshToken) {
            let userId = null;
            let deviceId = null;
            let username = 'Unknown';
            let isMobile = false;

            try {
                // 1. Try to find the refresh token entry in DB to get user_id and device_id
                const dbToken = await findRefreshToken(refreshToken);
                if (dbToken) {
                    userId = dbToken.user_id;
                    deviceId = dbToken.device_id;
                }
                
                // Decode the refresh token JWT to get user ID and isMobile flag
                const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
                if (decoded) {
                    userId = userId || decoded.id;
                    isMobile = decoded.mobile === true || decoded.mobile === 'true';
                }

                if (userId) {
                    // 2. Fetch the user details (name, username) from DB
                    const [userRows] = await db.execute(
                        "SELECT name, username FROM users WHERE id = ?",
                        [userId]
                    );
                    if (userRows.length > 0) {
                        username = userRows[0].name || userRows[0].username || 'Unknown';
                    }
                }
            } catch (err) {
                console.error("Error retrieving user info from refresh token for logout log:", err);
            }

            // Fallback: Try to decode authorization header if user ID is still not found
            if (!userId) {
                const authHeader = req.headers.authorization;
                if (authHeader && authHeader.startsWith("Bearer ")) {
                    try {
                        const token = authHeader.split(" ")[1];
                        const decoded = jwt.verify(token, process.env.JWT_SECRET);
                        userId = decoded.id;
                        username = decoded.name || decoded.username || 'Unknown';
                        isMobile = decoded.mobile === true || decoded.mobile === 'true';
                    } catch (e) {
                        // Ignore decode errors
                    }
                }
            }

            // 3. Log logout activity before deleting the token from database
            if (userId) {
                try {
                    await createAuditLog(
                        userId,
                        username,
                        deviceId || null,
                        'User Authentication',
                        'logout',
                        null,
                        {
                            platform: isMobile ? "Mobile App" : "Web Application",
                            status: "Logged out successfully"
                        }
                    );
                } catch (logError) {
                    console.error("Failed to create logout audit log:", logError);
                }
            }

            await deleteRefreshToken(refreshToken);
        }
        res.clearCookie("refreshToken");
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

// ================= REFRESH TOKEN =================

const refresh = async (req, res) => {
    try {
        // Extract token from cookie or body
        const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

        if (!refreshToken) {
            return res.status(400).json({
                success: false,
                message: "Refresh token is required"
            });
        }

        // Verify token signature and expiration
        let decoded;
        try {
            decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        } catch (err) {
            return res.status(401).json({
                success: false,
                message: "Invalid or expired refresh token"
            });
        }

        // Verify token exists in database and is not expired
        const dbToken = await findRefreshToken(refreshToken);
        if (!dbToken) {
            return res.status(401).json({
                success: false,
                message: "Refresh token is invalid or has been revoked"
            });
        }

        // Get the user information
        const { getUserById } = require("../models/userModel.js");
        const user = await getUserById(decoded.id);

        if (!user || user.active === 0 || user.active === false) {
            return res.status(403).json({
                success: false,
                message: "User account deactivated or not found"
            });
        }

        // Verify that they still have access
        const isMobileRefresh = decoded.mobile === true || decoded.mobile === 'true';
        if (isMobileRefresh) {
            if (user.mobile_access === 0 || user.mobile_access === false) {
                return res.status(403).json({
                    success: false,
                    message: "Mobile access is disabled for this account."
                });
            }
        } else {
            if (user.web_access === 0 || user.web_access === false) {
                return res.status(403).json({
                    success: false,
                    message: "Web access is disabled for this account."
                });
            }
        }

        // Generate new Access Token (short-lived)
        const newAccessToken = jwt.sign(
            { id: user.id, role: user.role, name: user.name, username: user.username, mob_no: user.mob_no, mobile: isMobileRefresh },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_ACCESS_EXPIRATION || "15m" }
        );

        // Rotate the Refresh Token
        const refreshExpiresIn = process.env.JWT_REFRESH_EXPIRATION || "7d";
        const newRefreshToken = jwt.sign(
            { id: user.id, mobile: isMobileRefresh },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: refreshExpiresIn }
        );

        // Calculate expiration timestamp
        let durationMs = 7 * 24 * 60 * 60 * 1000; // default 7 days
        const match = refreshExpiresIn.match(/^(\d+)([dhm])$/);
        if (match) {
            const val = parseInt(match[1], 10);
            const unit = match[2];
            if (unit === 'd') durationMs = val * 24 * 60 * 60 * 1000;
            else if (unit === 'h') durationMs = val * 60 * 60 * 1000;
            else if (unit === 'm') durationMs = val * 60 * 1000;
        }
        const expiresAt = new Date(Date.now() + durationMs);

        // Delete old token and insert new token into database
        await deleteRefreshToken(refreshToken);
        await addRefreshToken(user.id, newRefreshToken, dbToken.device_id, expiresAt);

        // Set the new refresh token in HTTP-only cookie
        res.cookie("refreshToken", newRefreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: durationMs
        });

        return res.status(200).json({
            success: true,
            token: newAccessToken,
            refreshToken: newRefreshToken
        });

    } catch (error) {
        console.error("Refresh Token Error:", error);
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
        if (req.user.role === 'admin' || req.user.role === 'super admin') {
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
    refresh,
    updateProfileController,
    requestDeviceRegistration,
    getMyPermissions,
    getActiveUsersController,
    getApprovedDevicesController
};
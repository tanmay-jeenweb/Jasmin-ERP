const bcrypt = require("bcryptjs");
const db = require("../config/db.js");

const {
    createUser,
    getUserById,
    toggleUserActive
} = require("../models/userModel.js");

const {
    approveDevice,
    revokeAllActiveDevices,
    getAllDeviceHistory,
    getDeviceHistoryForUser,
    getPendingDevicesAllUsers
} = require("../models/deviceModel.js");
const { getAllAuditLogs, createAuditLog } = require("../models/auditLogModel.js");

const fetchUsers = async (req, res) => {
    try {
        const includeInactive = req.query.includeInactive === 'true';
        const whereClause = includeInactive 
            ? "WHERE u.role != 'super admin' OR u.role IS NULL" 
            : "WHERE (u.role != 'super admin' OR u.role IS NULL) AND u.active = TRUE";
        // Fetch users along with device counts using subqueries to prevent duplicate user rows
        const query = `
            SELECT 
                u.id, u.name, u.username, u.email, u.mob_no, u.role,
                ut.type_name,
                device_verification_required, u.active,
                u.state, u.city, u.branch, u.product_type, u.landing_type,
                (SELECT COUNT(*) FROM user_devices WHERE user_id = u.id AND status = 'approved' AND closed_at IS NULL) AS approved_devices_count,
                (SELECT COUNT(*) FROM user_devices WHERE user_id = u.id AND status = 'pending' AND closed_at IS NULL) AS pending_devices_count
            FROM users u
            LEFT JOIN user_types ut ON u.user_type_id = ut.id
            ${whereClause}
        `;
        const [users] = await db.execute(query);

        return res.status(200).json({
            success: true,
            users
        });

    } catch (error) {
        console.log("Fetch Users Error:", error);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

const createUserByAdmin = async (req, res) => {
    try {
        const {
            name,
            username,
            email,
            password,
            userTypeId,
            mobNo,
            dateOfJoin,
            deviceVerificationRequired,
            role,
            state,
            city,
            branch,
            productType,
            landingType,
            brand,
            webAccess,
            mobileAccess
        } = req.body;

        if (!name || !username || !email || !password) {
            return res.status(400).json({ success: false, message: "Name, username, email and password are required" });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await createUser(
            name,
            username,
            email,
            hashedPassword,
            userTypeId || null,
            mobNo || null,
            dateOfJoin || null,
            typeof deviceVerificationRequired === 'boolean' ? deviceVerificationRequired : true,
            true,
            role || 'user',
            state || null,
            city || null,
            branch || null,
            productType || null,
            landingType || null,
            brand || null,
            password,
            typeof webAccess === 'boolean' ? webAccess : true,
            typeof mobileAccess === 'boolean' ? mobileAccess : true
        );

        const adminDeviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';
        await createAuditLog(
            req.user?.id,
            req.user?.name || req.user?.username || 'Unknown',
            adminDeviceId,
            'User Master',
            'created',
            null,
            {
                id: newUser.insertId,
                name,
                username,
                email,
                user_type_id: userTypeId || null,
                mob_no: mobNo || null,
                date_of_join: dateOfJoin || null,
                device_verification_required: deviceVerificationRequired,
                role: role || 'user',
                state,
                city,
                branch,
                product_type: productType,
                landing_type: landingType,
                brand: brand,
                web_access: typeof webAccess === 'boolean' ? webAccess : true,
                mobile_access: typeof mobileAccess === 'boolean' ? mobileAccess : true
            }
        );

        return res.status(201).json({ success: true, message: "User created successfully" });
    } catch (error) {
        console.log("Create User Error:", error);
        if (error.code === 'ER_DUP_ENTRY') {
            const message = error.sqlMessage || error.message || '';
            if (message.includes('username')) {
                return res.status(400).json({ success: false, message: "Username already exists" });
            }
            if (message.includes('email')) {
                return res.status(400).json({ success: false, message: "Email already exists" });
            }
            return res.status(400).json({ success: false, message: "Username or email already exists" });
        }
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

const approveDeviceController = async (req, res) => {
    try {
        const { deviceRowId } = req.params;
        const adminId = req.user.id;

        // Fetch device info before approval for the log
        const [deviceRows] = await db.execute(
            `SELECT ud.device_id, ud.user_id, u.username, u.name AS user_name
             FROM user_devices ud
             JOIN users u ON u.id = ud.user_id
             WHERE ud.id = ?`,
            [deviceRowId]
        );
        const deviceInfo = deviceRows[0] || {};

        await approveDevice(deviceRowId, adminId);

        const adminDeviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';
        await createAuditLog(
            adminId,
            req.user?.name || req.user?.username || 'Unknown',
            adminDeviceId,
            'Device Management',
            'approved',
            { status: 'pending', device_id: deviceInfo.device_id, user: deviceInfo.user_name },
            { status: 'approved', device_id: deviceInfo.device_id, user: deviceInfo.user_name, approved_by: req.user?.name }
        );

        return res.status(200).json({ success: true, message: "Device approved successfully" });
    } catch (error) {
        console.log("Approve Device Error:", error);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

const revokeDeviceController = async (req, res) => {
    try {
        const { userId } = req.params;
        const adminId = req.user.id;

        await revokeAllActiveDevices(userId, adminId);

        return res.status(200).json({ success: true, message: "Device revoked successfully" });
    } catch (error) {
        console.log("Revoke Device Error:", error);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};


const fetchAuditLogs = async (req, res) => {
    try {
        const logs = await getAllDeviceHistory();
        return res.status(200).json({ success: true, logs });
    } catch (error) {
        console.log("Fetch Audit Logs Error:", error);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

const fetchUserAuditLogs = async (req, res) => {
    try {
        const { userId } = req.params;
        const logs = await getDeviceHistoryForUser(userId);
        return res.status(200).json({ success: true, logs });
    } catch (error) {
        console.log("Fetch User Audit Logs Error:", error);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

const fetchActivityLogs = async (req, res) => {
    try {
        const logs = await getAllAuditLogs();
        return res.status(200).json({ success: true, logs });
    } catch (error) {
        console.log("Fetch Activity Logs Error:", error);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

const fetchPendingDevices = async (req, res) => {
    try {
        const devices = await getPendingDevicesAllUsers();
        return res.status(200).json({ success: true, devices });
    } catch (error) {
        console.log("Fetch Pending Devices Error:", error);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

const toggleUserActiveController = async (req, res) => {
    try {
        const { id } = req.params;
        const { active } = req.body;
        const adminId = req.user.id;
        const adminDeviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';

        const beforeData = await getUserById(id);
        if (!beforeData) return res.status(404).json({ success: false, message: "User not found" });

        await toggleUserActive(id, active);

        await createAuditLog(
            adminId,
            req.user?.name || req.user?.username || 'Unknown',
            adminDeviceId,
            'User Master',
            active ? 'activated' : 'deactivated',
            { name: beforeData.name, username: beforeData.username, active: beforeData.active },
            { name: beforeData.name, username: beforeData.username, active: active }
        );

        return res.status(200).json({ success: true, message: `User ${active ? 'activated' : 'deactivated'}` });
    } catch (error) {
        console.log("Toggle User Active Error:", error);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

const fetchUserActiveDevicesController = async (req, res) => {
    try {
        const { userId } = req.params;
        const [devices] = await db.execute(`
            SELECT * FROM user_devices
            WHERE user_id = ? AND closed_at IS NULL
            ORDER BY status DESC, submitted_at DESC
        `, [userId]);
        return res.status(200).json({ success: true, devices });
    } catch (error) {
        console.log("Fetch User Active Devices Error:", error);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

const revokeSpecificDeviceController = async (req, res) => {
    try {
        const { deviceRowId } = req.params;
        const adminId = req.user.id;

        // Fetch device info before revoking for logging
        const [deviceRows] = await db.execute(`
            SELECT ud.device_id, ud.user_id, u.username, u.name AS user_name
            FROM user_devices ud
            JOIN users u ON u.id = ud.user_id
            WHERE ud.id = ?
        `, [deviceRowId]);
        const deviceInfo = deviceRows[0] || {};

        await db.execute(`
            UPDATE user_devices
            SET status = 'revoked', closed_at = NOW(), closed_by = ?
            WHERE id = ?
        `, [adminId, deviceRowId]);

        const adminDeviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';
        await createAuditLog(
            adminId,
            req.user?.name || req.user?.username || 'Unknown',
            adminDeviceId,
            'Device Management',
            'revoked',
            { status: 'approved', device_id: deviceInfo.device_id, user: deviceInfo.user_name },
            { status: 'revoked', device_id: deviceInfo.device_id, user: deviceInfo.user_name, closed_by: req.user?.name }
        );

        return res.status(200).json({ success: true, message: "Specific device revoked successfully" });
    } catch (error) {
        console.log("Revoke Specific Device Error:", error);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

const fetchSuperAdminUsers = async (req, res) => {
    try {
        if (req.user.role !== 'super admin') {
            return res.status(403).json({ success: false, message: "Forbidden. Super Admin only." });
        }

        const query = `
            SELECT 
                u.id, u.name, u.username, u.email, u.mob_no, u.role,
                u.user_type_id, ut.type_name,
                u.device_verification_required, u.active,
                u.state, u.city, u.branch, u.product_type, u.landing_type, u.brand,
                u.plain_password, u.web_access, u.mobile_access
            FROM users u
            LEFT JOIN user_types ut ON u.user_type_id = ut.id
            WHERE u.role != 'super admin' OR u.role IS NULL
            ORDER BY u.name ASC
        `;
        const [users] = await db.execute(query);

        return res.status(200).json({
            success: true,
            users
        });
    } catch (error) {
        console.log("Fetch Super Admin Users Error:", error);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

const updateUserBySuperAdmin = async (req, res) => {
    try {
        if (req.user.role !== 'super admin') {
            return res.status(403).json({ success: false, message: "Forbidden. Super Admin only." });
        }

        const { userId } = req.params;
        const {
            name,
            username,
            email,
            password,
            userTypeId,
            mobNo,
            deviceVerificationRequired,
            active,
            role,
            state,
            city,
            branch,
            productType,
            landingType,
            brand,
            webAccess,
            mobileAccess
        } = req.body;

        const [userRows] = await db.execute("SELECT * FROM users WHERE id = ?", [userId]);
        if (userRows.length === 0) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const currentUser = userRows[0];

        if (currentUser.role === 'super admin' && currentUser.id !== req.user.id) {
            return res.status(403).json({ success: false, message: "Cannot modify super admin" });
        }

        let query = `
            UPDATE users SET 
                name = ?,
                username = ?,
                email = ?,
                user_type_id = ?,
                mob_no = ?,
                device_verification_required = ?,
                active = ?,
                role = ?,
                state = ?,
                city = ?,
                branch = ?,
                product_type = ?,
                landing_type = ?,
                brand = ?,
                web_access = ?,
                mobile_access = ?
        `;
        const queryParams = [
            name !== undefined ? name : currentUser.name,
            username !== undefined ? username : currentUser.username,
            email !== undefined ? email : currentUser.email,
            userTypeId !== undefined ? userTypeId : currentUser.user_type_id,
            mobNo !== undefined ? mobNo : currentUser.mob_no,
            deviceVerificationRequired !== undefined ? (deviceVerificationRequired ? 1 : 0) : currentUser.device_verification_required,
            active !== undefined ? (active ? 1 : 0) : currentUser.active,
            role !== undefined ? role : currentUser.role,
            state !== undefined ? (state ? JSON.stringify(state) : null) : currentUser.state,
            city !== undefined ? city : currentUser.city,
            branch !== undefined ? (branch ? JSON.stringify(branch) : null) : currentUser.branch,
            productType !== undefined ? (productType ? JSON.stringify(productType) : null) : currentUser.product_type,
            landingType !== undefined ? (landingType ? JSON.stringify(landingType) : null) : currentUser.landing_type,
            brand !== undefined ? (brand ? JSON.stringify(brand) : null) : currentUser.brand,
            webAccess !== undefined ? (webAccess ? 1 : 0) : currentUser.web_access,
            mobileAccess !== undefined ? (mobileAccess ? 1 : 0) : currentUser.mobile_access
        ];

        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            query += `, password = ?, plain_password = ?`;
            queryParams.push(hashedPassword, password);
        }

        query += ` WHERE id = ?`;
        queryParams.push(userId);

        await db.execute(query, queryParams);

        return res.status(200).json({ success: true, message: "User updated successfully" });
    } catch (error) {
        console.log("Update User By Super Admin Error:", error);
        if (error.code === 'ER_DUP_ENTRY') {
            const message = error.sqlMessage || error.message || '';
            if (message.includes('username')) {
                return res.status(400).json({ success: false, message: "Username already exists" });
            }
            if (message.includes('email')) {
                return res.status(400).json({ success: false, message: "Email already exists" });
            }
            return res.status(400).json({ success: false, message: "Username or email already exists" });
        }
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

module.exports = {
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
    revokeSpecificDeviceController,
    fetchSuperAdminUsers,
    updateUserBySuperAdmin
};
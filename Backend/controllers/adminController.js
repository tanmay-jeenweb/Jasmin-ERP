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
        const whereClause = includeInactive ? '' : 'WHERE u.active = TRUE';
        // Fetch users along with their active device status
        const query = `
            SELECT 
                u.id, u.name, u.username, u.email, u.mob_no, u.role,
                d.status AS device_status, ut.type_name,
                d.device_id, device_verification_required, u.active,
                u.state, u.city, u.branch, u.product_type, u.landing_type
            FROM users u
            LEFT JOIN user_devices d ON d.user_id = u.id AND d.closed_at IS NULL
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
            brand
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
            brand || null
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
                brand: brand
            }
        );

        return res.status(201).json({ success: true, message: "User created successfully" });
    } catch (error) {
        console.log("Create User Error:", error);
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

module.exports = {
    fetchUsers,
    createUserByAdmin,
    approveDeviceController,
    revokeDeviceController,
    fetchAuditLogs,
    fetchUserAuditLogs,
    fetchActivityLogs,
    fetchPendingDevices,
    toggleUserActiveController
};
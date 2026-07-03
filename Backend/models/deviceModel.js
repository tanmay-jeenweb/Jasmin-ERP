const db = require("../config/db.js");

const createUserDevicesTable = async () => {
    const query = `
        CREATE TABLE IF NOT EXISTS user_devices (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          device_id VARCHAR(255) NOT NULL,
          status ENUM('pending', 'approved', 'revoked') DEFAULT 'pending',
          submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          approved_by INT NULL,
          approved_at TIMESTAMP NULL,
          closed_at TIMESTAMP NULL,
          closed_by INT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
          FOREIGN KEY (closed_by) REFERENCES users(id) ON DELETE SET NULL
        )
    `;
    await db.execute(query);
    console.log("User devices table ready");
};

// Get the current approved active device for login check
const getApprovedDevice = async (userId) => {
    const query = `
        SELECT * FROM user_devices
        WHERE user_id = ? AND status = 'approved' AND closed_at IS NULL
        LIMIT 1
    `;
    const [rows] = await db.execute(query, [userId]);
    return rows[0];
};

// Get any pending active device for a user
const getPendingDevice = async (userId) => {
    const query = `
        SELECT * FROM user_devices
        WHERE user_id = ? AND status = 'pending' AND closed_at IS NULL
        ORDER BY submitted_at DESC
        LIMIT 1
    `;
    const [rows] = await db.execute(query, [userId]);
    return rows[0];
};

// Insert a new pending device
const createPendingDevice = async (userId, deviceId) => {
    const query = `
        INSERT INTO user_devices (user_id, device_id, status)
        VALUES (?, ?, 'pending')
    `;
    const [result] = await db.execute(query, [userId, deviceId]);
    return result;
};

// Approve a device
const approveDevice = async (deviceRowId, adminId) => {
    // 1. Find the user_id for this device
    const [rows] = await db.execute('SELECT user_id FROM user_devices WHERE id = ?', [deviceRowId]);
    if (rows.length > 0) {
        const userId = rows[0].user_id;
        // 2. Revoke all other active devices for this user
        const revokeQuery = `
            UPDATE user_devices
            SET status = 'revoked', closed_at = NOW(), closed_by = ?
            WHERE user_id = ? AND id != ? AND closed_at IS NULL
        `;
        await db.execute(revokeQuery, [adminId, userId, deviceRowId]);
    }

    // 3. Approve this device
    const query = `
        UPDATE user_devices
        SET status = 'approved', approved_by = ?, approved_at = NOW(), closed_at = NULL, closed_by = NULL
        WHERE id = ?
    `;
    const [result] = await db.execute(query, [adminId, deviceRowId]);
    return result;
};

// Revoke a specific device
const revokeDevice = async (deviceRowId, adminId) => {
    const query = `
        UPDATE user_devices
        SET status = 'revoked', closed_at = NOW(), closed_by = ?
        WHERE id = ?
    `;
    const [result] = await db.execute(query, [adminId, deviceRowId]);
    return result;
};

// Revoke all active devices for a user
const revokeAllActiveDevices = async (userId, adminId) => {
    const query = `
        UPDATE user_devices
        SET status = 'revoked', closed_at = NOW(), closed_by = ?
        WHERE user_id = ? AND closed_at IS NULL
    `;
    const [result] = await db.execute(query, [adminId, userId]);
    return result;
};


// Get all device history for a specific user
const getDeviceHistoryForUser = async (userId) => {
    const query = `
        SELECT
            d.*,
            approver.name AS approved_by_name,
            closer.name AS closed_by_name
        FROM user_devices d
        LEFT JOIN users approver ON approver.id = d.approved_by
        LEFT JOIN users closer ON closer.id = d.closed_by
        WHERE d.user_id = ?
        ORDER BY d.submitted_at DESC
    `;
    const [rows] = await db.execute(query, [userId]);
    return rows;
};

// Get all device history across all users
const getAllDeviceHistory = async () => {
    const query = `
        SELECT
            d.*,
            u.name AS user_name,
            u.email AS user_email,
            approver.name AS approved_by_name,
            closer.name AS closed_by_name
        FROM user_devices d
        JOIN users u ON u.id = d.user_id
        LEFT JOIN users approver ON approver.id = d.approved_by
        LEFT JOIN users closer ON closer.id = d.closed_by
        ORDER BY d.submitted_at DESC
    `;
    const [rows] = await db.execute(query);
    return rows;
};

// Get all pending devices across all users
const getPendingDevicesAllUsers = async () => {
    const query = `
        SELECT
            d.*,
            u.name AS user_name,
            u.email AS user_email
        FROM user_devices d
        JOIN users u ON u.id = d.user_id
        WHERE d.status = 'pending' AND d.closed_at IS NULL
        ORDER BY d.submitted_at DESC
    `;
    const [rows] = await db.execute(query);
    return rows;
};

module.exports = {
    createUserDevicesTable,
    getApprovedDevice,
    getPendingDevice,
    createPendingDevice,
    approveDevice,
    revokeDevice,
    revokeAllActiveDevices,
    getDeviceHistoryForUser,
    getAllDeviceHistory,
    getPendingDevicesAllUsers
};

const db = require('../config/db.js');

const createAuditLogsTable = async () => {
    const query = `
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT DEFAULT NULL,
            username VARCHAR(255) DEFAULT NULL,
            device_id VARCHAR(255) DEFAULT NULL,
            master_name VARCHAR(255) NOT NULL,
            change_type VARCHAR(50) NOT NULL,
            before_data TEXT,
            after_data TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        )
    `;

    await db.execute(query);
    console.log('Audit logs table ready');
};

const createAuditLog = async (
    userId,
    username,
    deviceId,
    masterName,
    changeType,
    beforeData = null,
    afterData = null
) => {
    if (userId) {
        try {
            const [userRows] = await db.execute("SELECT role FROM users WHERE id = ?", [userId]);
            if (userRows.length > 0 && userRows[0].role === 'super admin') {
                return null;
            }
        } catch (e) {
            console.error("Error checking user role in createAuditLog:", e);
        }
    }

    if (username) {
        const lowerName = username.toLowerCase();
        if (lowerName.includes("superadmin") || lowerName.includes("super admin")) {
            return null;
        }
    }

    const query = `
        INSERT INTO audit_logs
            (user_id, username, device_id, master_name, change_type, before_data, after_data)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await db.execute(query, [
        userId ?? null,
        username ?? null,
        deviceId ?? null,
        masterName ?? null,
        changeType ?? null,
        beforeData ? JSON.stringify(beforeData) : null,
        afterData ? JSON.stringify(afterData) : null
    ]);

    return result;
};

const getAllAuditLogs = async () => {
    const query = `
        SELECT al.id, al.user_id, al.username, al.device_id, al.master_name, al.change_type, al.before_data, al.after_data, al.created_at
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        WHERE (u.role != 'super admin' OR u.role IS NULL)
          AND (al.username IS NULL OR (LOWER(al.username) NOT LIKE '%superadmin%' AND LOWER(al.username) NOT LIKE '%super admin%'))
        ORDER BY al.created_at DESC
    `;

    const [rows] = await db.execute(query);

    return rows.map((row) => ({
        ...row,
        before_data: row.before_data ? JSON.parse(row.before_data) : null,
        after_data: row.after_data ? JSON.parse(row.after_data) : null,
    }));
};

module.exports = {
    createAuditLogsTable,
    createAuditLog,
    getAllAuditLogs,
};

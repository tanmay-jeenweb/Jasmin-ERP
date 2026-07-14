const db = require('../config/db.js');

// ─── Masters list (must match frontend) ─────────────────────────────────────
const MASTERS = [
    { key: 'user_type', label: 'User Type Master' },
    { key: 'mobile_brand_master', label: 'Brand Master' },
    { key: 'bank_master', label: 'Finance Company Master' },
    { key: 'finance_machine_master', label: 'Finance Machine Master' },
    { key: 'user_master', label: 'User Master' },
    { key: 'device_approval', label: 'Device Approval' },
    { key: 'state_master', label: 'State Master' },
    { key: 'product_type_master', label: 'Product Type Master' },
    { key: 'item_model_master', label: 'Model Master' },
    { key: 'model_group_master', label: 'Model Group Master' },
    { key: 'branch_master', label: 'Branch Master' },
    { key: 'abm_branch_mapping', label: 'ABM Branch Mapping' },
];

// ─── Table creation ──────────────────────────────────────────────────────────
const createUserTypesTable = async () => {

    const query = `
        CREATE TABLE IF NOT EXISTS user_types (
            id INT AUTO_INCREMENT PRIMARY KEY,
            type_name VARCHAR(100) NOT NULL UNIQUE,
            user_role VARCHAR(50) DEFAULT 'VIEWER',
            added_by INT NOT NULL,
            device_id VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `;

    await db.execute(query);

    try {
        const [rows] = await db.execute("SHOW COLUMNS FROM user_types LIKE 'user_role'");
        if (rows.length === 0) {
            await db.execute("ALTER TABLE user_types ADD COLUMN user_role VARCHAR(50) DEFAULT 'VIEWER'");
            console.log("Added user_role column to user_types");
        }
    } catch (err) {
        console.error("Error checking/adding user_role column:", err.message);
    }

    console.log("User types table ready");
};

const createUserTypePermissionsTable = async () => {
    const query = `
        CREATE TABLE IF NOT EXISTS user_type_permissions (
            id           INT AUTO_INCREMENT PRIMARY KEY,
            user_type_id INT NOT NULL,
            master_name  VARCHAR(100) NOT NULL,
            can_read     TINYINT(1) DEFAULT 0,
            can_write    TINYINT(1) DEFAULT 0,
            can_update   TINYINT(1) DEFAULT 0,
            can_delete   TINYINT(1) DEFAULT 0,
            UNIQUE KEY uq_ut_master (user_type_id, master_name),
            FOREIGN KEY (user_type_id) REFERENCES user_types(id) ON DELETE CASCADE
        )
    `;
    await db.execute(query);
    console.log("User type permissions table ready");

    // Migrate existing operator permissions to worker_employee safely
    try {
        await db.execute("UPDATE IGNORE user_type_permissions SET master_name = 'worker_employee' WHERE master_name = 'operator'");
        await db.execute("DELETE FROM user_type_permissions WHERE master_name = 'operator'");

        await db.execute("UPDATE IGNORE user_type_permissions SET master_name = 'worker_employee_type' WHERE master_name = 'operator_type'");
        await db.execute("DELETE FROM user_type_permissions WHERE master_name = 'operator_type'");
        
        console.log("✅ Permission keys migrated to worker_employee and worker_employee_type.");
    } catch (err) {
        console.error("Migration of user permissions failed:", err.message);
    }
};

// ─── Permissions helpers ─────────────────────────────────────────────────────

/**
 * permissions = [{ masterName, canRead, canWrite, canUpdate, canDelete }, ...]
 */
const upsertPermissions = async (userTypeId, permissions) => {
    if (!permissions || permissions.length === 0) return;

    for (const p of permissions) {
        const query = `
            INSERT INTO user_type_permissions
                (user_type_id, master_name, can_read, can_write, can_update, can_delete)
            VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                can_read   = VALUES(can_read),
                can_write  = VALUES(can_write),
                can_update = VALUES(can_update),
                can_delete = VALUES(can_delete)
        `;
        await db.execute(query, [
            userTypeId,
            p.masterName,
            p.canRead ? 1 : 0,
            p.canWrite ? 1 : 0,
            p.canUpdate ? 1 : 0,
            p.canDelete ? 1 : 0,
        ]);
    }
};

const getPermissionsByUserTypeId = async (userTypeId) => {
    const [rows] = await db.execute(
        `SELECT master_name, can_read, can_write, can_update, can_delete
         FROM user_type_permissions
         WHERE user_type_id = ?`,
        [userTypeId]
    );
    return rows;
};

// ─── User Type CRUD ──────────────────────────────────────────────────────────

const createUserType = async (typeName, userRole, addedBy, deviceId, permissions) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const [result] = await conn.execute(
            `INSERT INTO user_types (type_name, user_role, added_by, device_id) VALUES (?, ?, ?, ?)`,
            [typeName, userRole || 'VIEWER', addedBy, deviceId]
        );

        const newId = result.insertId;

        if (permissions && permissions.length > 0) {
            for (const p of permissions) {
                await conn.execute(
                    `INSERT INTO user_type_permissions
                        (user_type_id, master_name, can_read, can_write, can_update, can_delete)
                     VALUES (?, ?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE
                        can_read   = VALUES(can_read),
                        can_write  = VALUES(can_write),
                        can_update = VALUES(can_update),
                        can_delete = VALUES(can_delete)`,
                    [newId, p.masterName, p.canRead ? 1 : 0, p.canWrite ? 1 : 0, p.canUpdate ? 1 : 0, p.canDelete ? 1 : 0]
                );
            }
        }

        await conn.commit();
        return result;
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
};

const getAllUserTypes = async () => {

    const query = `
        SELECT
            ut.id,
            ut.type_name,
            ut.user_role,
            COALESCE(u.name, 'Unknown') AS added_by_name,
            ut.device_id,
            ut.created_at
        FROM user_types ut
        LEFT JOIN users u ON ut.added_by = u.id
        ORDER BY ut.created_at DESC
    `;

    const [results] = await db.execute(query);

    // Fetch permissions for each user type
    for (const row of results) {
        const perms = await getPermissionsByUserTypeId(row.id);
        row.permissions = perms.map(p => ({
            masterName: p.master_name,
            canRead: !!p.can_read,
            canWrite: !!p.can_write,
            canUpdate: !!p.can_update,
            canDelete: !!p.can_delete,
        }));
    }

    return results;
};

const updateUserType = async (id, typeName, userRole, permissions) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        await conn.execute(
            `UPDATE user_types SET type_name = ?, user_role = ? WHERE id = ?`,
            [typeName, userRole || 'VIEWER', id]
        );

        if (permissions && permissions.length > 0) {
            for (const p of permissions) {
                await conn.execute(
                    `INSERT INTO user_type_permissions
                        (user_type_id, master_name, can_read, can_write, can_update, can_delete)
                     VALUES (?, ?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE
                        can_read   = VALUES(can_read),
                        can_write  = VALUES(can_write),
                        can_update = VALUES(can_update),
                        can_delete = VALUES(can_delete)`,
                    [id, p.masterName, p.canRead ? 1 : 0, p.canWrite ? 1 : 0, p.canUpdate ? 1 : 0, p.canDelete ? 1 : 0]
                );
            }
        }

        await conn.commit();
        return { affectedRows: 1 };
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
};

const deleteUserType = async (id) => {
    const query = `DELETE FROM user_types WHERE id = ?`;
    const [result] = await db.execute(query, [id]);
    return result;
};

const getUserTypeById = async (id) => {
    const [rows] = await db.execute(
        `SELECT id, type_name, user_role, added_by, device_id, created_at, updated_at FROM user_types WHERE id = ?`,
        [id]
    );
    if (!rows[0]) return null;
    const permissions = await getPermissionsByUserTypeId(id);
    return {
        ...rows[0],
        permissions: permissions.map((p) => ({
            masterName: p.master_name,
            canRead: !!p.can_read,
            canWrite: !!p.can_write,
            canUpdate: !!p.can_update,
            canDelete: !!p.can_delete,
        })),
    };
};

module.exports = {
    MASTERS,
    createUserTypesTable,
    createUserTypePermissionsTable,
    upsertPermissions,
    getPermissionsByUserTypeId,
    createUserType,
    getAllUserTypes,
    updateUserType,
    deleteUserType,
    getUserTypeById
};

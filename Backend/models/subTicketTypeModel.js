const db = require('../config/db.js');

const createSubTicketTypeTable = async () => {
    // 1. Migration: Drop old FK on assigned_to if it exists and convert column to JSON array
    try {
        const [fks] = await db.execute(`
            SELECT CONSTRAINT_NAME 
            FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
            WHERE TABLE_SCHEMA = DATABASE() 
              AND TABLE_NAME = 'sub_ticket_type_master' 
              AND COLUMN_NAME = 'assigned_to' 
              AND REFERENCED_TABLE_NAME = 'users'
        `);
        for (const fk of fks) {
            await db.execute(`ALTER TABLE sub_ticket_type_master DROP FOREIGN KEY ${fk.CONSTRAINT_NAME}`);
            console.log(`Dropped FK ${fk.CONSTRAINT_NAME} on sub_ticket_type_master.assigned_to`);
        }
    } catch (e) {
        /* FK may not exist or already dropped */
    }

    try {
        const [indexes] = await db.execute("SHOW INDEX FROM sub_ticket_type_master WHERE Column_name = 'assigned_to'");
        for (const idx of indexes) {
            await db.execute(`ALTER TABLE sub_ticket_type_master DROP INDEX \`${idx.Key_name}\``);
            console.log(`Dropped Index ${idx.Key_name} on sub_ticket_type_master.assigned_to`);
        }
    } catch (e) {
        /* index may not exist or already dropped */
    }

    try {
        const [cols] = await db.execute(`SHOW COLUMNS FROM sub_ticket_type_master LIKE 'assigned_to'`);
        if (cols.length > 0 && cols[0].Type.toLowerCase().includes('int')) {
            await db.execute(`ALTER TABLE sub_ticket_type_master MODIFY COLUMN assigned_to JSON NOT NULL`);
            await db.execute(`UPDATE sub_ticket_type_master SET assigned_to = JSON_ARRAY(assigned_to) WHERE JSON_TYPE(assigned_to) != 'ARRAY'`);
            console.log("Migrated sub_ticket_type_master.assigned_to to JSON array");
        }
    } catch (e) {
        /* ignore migration errors */
    }

    try {
        const [remarkCols] = await db.execute(`SHOW COLUMNS FROM sub_ticket_type_master LIKE 'remark'`);
        if (remarkCols.length === 0) {
            await db.execute(`ALTER TABLE sub_ticket_type_master ADD COLUMN remark TEXT NULL AFTER assigned_to`);
            console.log("Added column 'remark' to sub_ticket_type_master");
        }
    } catch (e) {
        /* ignore migration errors */
    }

    // 2. Define/Create table if not exists
    const query = `
        CREATE TABLE IF NOT EXISTS sub_ticket_type_master (
            id INT AUTO_INCREMENT PRIMARY KEY,
            ticket_type_id INT NOT NULL,
            name VARCHAR(150) NOT NULL,
            assigned_to JSON NOT NULL,
            remark TEXT NULL,
            added_by INT NOT NULL,
            device_id VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_ticket_subticket (ticket_type_id, name),
            FOREIGN KEY (ticket_type_id) REFERENCES ticket_type_master(id) ON DELETE RESTRICT,
            FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE CASCADE
        )
    `;
    await db.execute(query);
    console.log("Sub ticket type master table ready");
};

const createSubTicketType = async (ticketTypeId, name, assignedTo, addedBy, deviceId, remark = null) => {
    const jsonAssignedTo = JSON.stringify(Array.isArray(assignedTo) ? assignedTo : [assignedTo]);
    const trimmedRemark = remark && typeof remark === 'string' ? remark.trim() : null;
    const query = `
        INSERT INTO sub_ticket_type_master (ticket_type_id, name, assigned_to, added_by, device_id, remark)
        VALUES (?, ?, ?, ?, ?, ?)
    `;
    const [result] = await db.execute(query, [ticketTypeId, name, jsonAssignedTo, addedBy, deviceId, trimmedRemark]);
    return result;
};

const getAllSubTicketTypes = async () => {
    const query = `
        SELECT
            sttm.id,
            sttm.ticket_type_id,
            ttm.name AS ticket_type_name,
            sttm.name,
            sttm.assigned_to,
            sttm.remark,
            COALESCE(u_added.name, 'Unknown') AS added_by_name,
            sttm.device_id,
            sttm.created_at,
            sttm.updated_at
        FROM sub_ticket_type_master sttm
        INNER JOIN ticket_type_master ttm ON sttm.ticket_type_id = ttm.id
        LEFT JOIN users u_added ON sttm.added_by = u_added.id
        ORDER BY ttm.name ASC, sttm.name ASC
    `;
    const [results] = await db.execute(query);

    // Fetch all users to map assigned_to IDs to user details
    const [users] = await db.execute(`
        SELECT u.id, u.name, u.username, u.email, COALESCE(ut.type_name, u.role, 'User') AS role_name
        FROM users u
        LEFT JOIN user_types ut ON u.user_type_id = ut.id
    `);
    const userMap = new Map(users.map((u) => [u.id, u]));

    return results.map((row) => {
        let assignedIds = [];
        try {
            assignedIds = typeof row.assigned_to === 'string' ? JSON.parse(row.assigned_to) : (row.assigned_to || []);
            if (!Array.isArray(assignedIds)) assignedIds = [assignedIds];
        } catch (e) {
            assignedIds = [];
        }

        const assignedUsers = assignedIds.map((id) => userMap.get(id) || { id, name: `User #${id}` });

        return {
            ...row,
            assigned_to: assignedIds,
            assigned_users: assignedUsers,
            assigned_to_name: assignedUsers.map((u) => u.name).join(', ')
        };
    });
};

const getSubTicketTypeById = async (id) => {
    const query = `
        SELECT
            sttm.id,
            sttm.ticket_type_id,
            ttm.name AS ticket_type_name,
            sttm.name,
            sttm.assigned_to,
            sttm.remark,
            sttm.added_by,
            sttm.device_id,
            sttm.created_at,
            sttm.updated_at
        FROM sub_ticket_type_master sttm
        INNER JOIN ticket_type_master ttm ON sttm.ticket_type_id = ttm.id
        WHERE sttm.id = ?
    `;
    const [rows] = await db.execute(query, [id]);
    if (!rows[0]) return null;

    const row = rows[0];
    let assignedIds = [];
    try {
        assignedIds = typeof row.assigned_to === 'string' ? JSON.parse(row.assigned_to) : (row.assigned_to || []);
        if (!Array.isArray(assignedIds)) assignedIds = [assignedIds];
    } catch (e) {
        assignedIds = [];
    }

    return {
        ...row,
        assigned_to: assignedIds
    };
};

const checkDuplicateSubTicket = async (ticketTypeId, name, excludeId = null) => {
    let query = `
        SELECT id FROM sub_ticket_type_master 
        WHERE ticket_type_id = ? AND LOWER(TRIM(name)) = LOWER(TRIM(?))
    `;
    const params = [ticketTypeId, name];
    if (excludeId) {
        query += ` AND id != ?`;
        params.push(excludeId);
    }
    const [rows] = await db.execute(query, params);
    return rows[0] || null;
};

const updateSubTicketType = async (id, ticketTypeId, name, assignedTo, remark = null) => {
    const jsonAssignedTo = JSON.stringify(Array.isArray(assignedTo) ? assignedTo : [assignedTo]);
    const trimmedRemark = remark && typeof remark === 'string' ? remark.trim() : null;
    const query = `
        UPDATE sub_ticket_type_master
        SET ticket_type_id = ?, name = ?, assigned_to = ?, remark = ?
        WHERE id = ?
    `;
    const [result] = await db.execute(query, [ticketTypeId, name, jsonAssignedTo, trimmedRemark, id]);
    return result;
};

const deleteSubTicketType = async (id) => {
    const query = `DELETE FROM sub_ticket_type_master WHERE id = ?`;
    const [result] = await db.execute(query, [id]);
    return result;
};

const getActiveAssignees = async () => {
    const query = `
        SELECT
            u.id,
            u.name,
            u.username,
            u.email,
            COALESCE(ut.type_name, u.role, 'User') AS role_name
        FROM users u
        LEFT JOIN user_types ut ON u.user_type_id = ut.id
        WHERE u.active = TRUE
        ORDER BY u.name ASC
    `;
    const [rows] = await db.execute(query);
    return rows;
};

module.exports = {
    createSubTicketTypeTable,
    createSubTicketType,
    getAllSubTicketTypes,
    getSubTicketTypeById,
    checkDuplicateSubTicket,
    updateSubTicketType,
    deleteSubTicketType,
    getActiveAssignees
};

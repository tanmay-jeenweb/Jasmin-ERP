const db = require('../config/db.js');

const createTicketTables = async () => {
    // 1. Tickets table
    const createTicketsQuery = `
        CREATE TABLE IF NOT EXISTS tickets (
            id INT AUTO_INCREMENT PRIMARY KEY,
            ticket_no VARCHAR(50) NOT NULL UNIQUE,
            ticket_type_id INT NOT NULL,
            sub_ticket_type_id INT NOT NULL,
            title VARCHAR(255) NOT NULL,
            description TEXT NOT NULL,
            images JSON DEFAULT NULL,
            remarks TEXT DEFAULT NULL,
            status ENUM('OPEN', 'IN_PROGRESS', 'COMPLETED') DEFAULT 'OPEN',
            assigned_to JSON NOT NULL,
            created_by INT NOT NULL,
            completed_at TIMESTAMP NULL DEFAULT NULL,
            completed_by INT NULL DEFAULT NULL,
            device_id VARCHAR(255) DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (ticket_type_id) REFERENCES ticket_type_master(id) ON DELETE RESTRICT,
            FOREIGN KEY (sub_ticket_type_id) REFERENCES sub_ticket_type_master(id) ON DELETE RESTRICT,
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (completed_by) REFERENCES users(id) ON DELETE SET NULL
        )
    `;
    await db.execute(createTicketsQuery);

    // 2. Ticket Remarks / Activity Log table
    const createRemarksQuery = `
        CREATE TABLE IF NOT EXISTS ticket_remarks (
            id INT AUTO_INCREMENT PRIMARY KEY,
            ticket_id INT NOT NULL,
            user_id INT NOT NULL,
            remark TEXT NOT NULL,
            action_type VARCHAR(50) DEFAULT 'REMARK',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `;
    await db.execute(createRemarksQuery);

    console.log("Tickets and ticket_remarks tables ready");
};

// Generate next sequential ticket number like TK-2026-00001
const generateTicketNumber = async () => {
    const year = new Date().getFullYear();
    const prefix = `TK-${year}-`;
    const [rows] = await db.execute(
        `SELECT ticket_no FROM tickets WHERE ticket_no LIKE ? ORDER BY id DESC LIMIT 1`,
        [`${prefix}%`]
    );
    let nextNum = 1;
    if (rows.length > 0 && rows[0].ticket_no) {
        const parts = rows[0].ticket_no.split('-');
        const lastNum = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(lastNum)) {
            nextNum = lastNum + 1;
        }
    }
    return `${prefix}${String(nextNum).padStart(5, '0')}`;
};

// Create a new ticket
const createTicket = async ({
    ticketTypeId,
    subTicketTypeId,
    title,
    description,
    images = [],
    remarks = '',
    assignedTo = [],
    createdBy,
    deviceId = null
}) => {
    const ticketNo = await generateTicketNumber();
    const imagesJson = JSON.stringify(images || []);
    const assignedToJson = JSON.stringify(assignedTo || []);

    const query = `
        INSERT INTO tickets (
            ticket_no,
            ticket_type_id,
            sub_ticket_type_id,
            title,
            description,
            images,
            remarks,
            status,
            assigned_to,
            created_by,
            device_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'OPEN', ?, ?, ?)
    `;

    const [result] = await db.execute(query, [
        ticketNo,
        ticketTypeId,
        subTicketTypeId,
        title,
        description,
        imagesJson,
        remarks || null,
        assignedToJson,
        createdBy,
        deviceId
    ]);

    const ticketId = result.insertId;

    // If an initial remark was entered, add it to ticket_remarks
    if (remarks && remarks.trim()) {
        await db.execute(
            `INSERT INTO ticket_remarks (ticket_id, user_id, remark, action_type) VALUES (?, ?, ?, 'CREATED')`,
            [ticketId, createdBy, remarks.trim()]
        );
    }

    return { id: ticketId, ticket_no: ticketNo };
};

// Get tickets based on user role and assigned status
const getTicketsForUser = async ({ userId, isAdmin, tab = 'active', search = '', ticketTypeId = null }) => {
    let whereClauses = [];
    let params = [];

    // Filter by Tab: 'active' (not completed) vs 'history' (completed)
    if (tab === 'history') {
        whereClauses.push("t.status = 'COMPLETED'");
    } else {
        whereClauses.push("t.status != 'COMPLETED'");
    }

    // Role-based visibility:
    // If not admin: must be either ticket creator OR in assigned_to list
    if (!isAdmin) {
        whereClauses.push(`(t.created_by = ? OR JSON_CONTAINS(t.assigned_to, CAST(? AS JSON)))`);
        params.push(userId, JSON.stringify(userId));
    }

    // Optional Filter by Ticket Type
    if (ticketTypeId) {
        whereClauses.push("t.ticket_type_id = ?");
        params.push(ticketTypeId);
    }

    // Search by title, ticket_no, description, creator name
    if (search && search.trim()) {
        const searchTerm = `%${search.trim()}%`;
        whereClauses.push("(t.ticket_no LIKE ? OR t.title LIKE ? OR t.description LIKE ? OR u_creator.name LIKE ?)");
        params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const query = `
        SELECT
            t.id,
            t.ticket_no,
            t.ticket_type_id,
            ttm.name AS ticket_type_name,
            t.sub_ticket_type_id,
            sttm.name AS sub_ticket_type_name,
            t.title,
            t.description,
            t.images,
            t.remarks,
            t.status,
            t.assigned_to,
            t.created_by,
            COALESCE(u_creator.name, 'Unknown') AS creator_name,
            COALESCE(u_creator.username, '') AS creator_username,
            t.completed_at,
            t.completed_by,
            COALESCE(u_comp.name, '') AS completed_by_name,
            t.device_id,
            t.created_at,
            t.updated_at
        FROM tickets t
        LEFT JOIN ticket_type_master ttm ON t.ticket_type_id = ttm.id
        LEFT JOIN sub_ticket_type_master sttm ON t.sub_ticket_type_id = sttm.id
        LEFT JOIN users u_creator ON t.created_by = u_creator.id
        LEFT JOIN users u_comp ON t.completed_by = u_comp.id
        ${whereSql}
        ORDER BY t.created_at DESC
    `;

    const [rows] = await db.execute(query, params);

    // Fetch user map for resolving assigned_to IDs to user info
    const [users] = await db.execute(`
        SELECT u.id, u.name, u.username, u.email, COALESCE(ut.type_name, u.role, 'User') AS role_name
        FROM users u
        LEFT JOIN user_types ut ON u.user_type_id = ut.id
    `);
    const userMap = new Map(users.map((u) => [u.id, u]));

    return rows.map((ticket) => {
        let assignedIds = [];
        try {
            assignedIds = typeof ticket.assigned_to === 'string' ? JSON.parse(ticket.assigned_to) : (ticket.assigned_to || []);
            if (!Array.isArray(assignedIds)) assignedIds = [assignedIds];
        } catch (e) {
            assignedIds = [];
        }

        let images = [];
        try {
            images = typeof ticket.images === 'string' ? JSON.parse(ticket.images) : (ticket.images || []);
            if (!Array.isArray(images)) images = [];
        } catch (e) {
            images = [];
        }

        const assignedUsers = assignedIds.map((id) => userMap.get(id) || { id, name: `User #${id}` });

        return {
            ...ticket,
            assigned_to: assignedIds,
            assigned_users: assignedUsers,
            images
        };
    });
};

// Get single ticket details
const getTicketById = async (ticketId) => {
    const query = `
        SELECT
            t.id,
            t.ticket_no,
            t.ticket_type_id,
            ttm.name AS ticket_type_name,
            t.sub_ticket_type_id,
            sttm.name AS sub_ticket_type_name,
            t.title,
            t.description,
            t.images,
            t.remarks,
            t.status,
            t.assigned_to,
            t.created_by,
            COALESCE(u_creator.name, 'Unknown') AS creator_name,
            COALESCE(u_creator.username, '') AS creator_username,
            COALESCE(u_creator.email, '') AS creator_email,
            t.completed_at,
            t.completed_by,
            COALESCE(u_comp.name, '') AS completed_by_name,
            t.device_id,
            t.created_at,
            t.updated_at
        FROM tickets t
        LEFT JOIN ticket_type_master ttm ON t.ticket_type_id = ttm.id
        LEFT JOIN sub_ticket_type_master sttm ON t.sub_ticket_type_id = sttm.id
        LEFT JOIN users u_creator ON t.created_by = u_creator.id
        LEFT JOIN users u_comp ON t.completed_by = u_comp.id
        WHERE t.id = ?
    `;

    const [rows] = await db.execute(query, [ticketId]);
    if (!rows[0]) return null;

    const ticket = rows[0];

    // Parse assigned_to
    let assignedIds = [];
    try {
        assignedIds = typeof ticket.assigned_to === 'string' ? JSON.parse(ticket.assigned_to) : (ticket.assigned_to || []);
        if (!Array.isArray(assignedIds)) assignedIds = [assignedIds];
    } catch (e) {
        assignedIds = [];
    }

    // Parse images
    let images = [];
    try {
        images = typeof ticket.images === 'string' ? JSON.parse(ticket.images) : (ticket.images || []);
        if (!Array.isArray(images)) images = [];
    } catch (e) {
        images = [];
    }

    // Resolve assigned users
    const [users] = await db.execute(`
        SELECT u.id, u.name, u.username, u.email, COALESCE(ut.type_name, u.role, 'User') AS role_name
        FROM users u
        LEFT JOIN user_types ut ON u.user_type_id = ut.id
    `);
    const userMap = new Map(users.map((u) => [u.id, u]));
    const assignedUsers = assignedIds.map((id) => userMap.get(id) || { id, name: `User #${id}` });

    return {
        ...ticket,
        assigned_to: assignedIds,
        assigned_users: assignedUsers,
        images
    };
};

// Get remarks / activity log for a ticket
const getTicketRemarks = async (ticketId) => {
    const query = `
        SELECT
            tr.id,
            tr.ticket_id,
            tr.user_id,
            COALESCE(u.name, 'Unknown') AS user_name,
            COALESCE(u.username, '') AS username,
            COALESCE(ut.type_name, u.role, 'User') AS user_role,
            tr.remark,
            tr.action_type,
            tr.created_at
        FROM ticket_remarks tr
        LEFT JOIN users u ON tr.user_id = u.id
        LEFT JOIN user_types ut ON u.user_type_id = ut.id
        WHERE tr.ticket_id = ?
        ORDER BY tr.created_at ASC
    `;
    const [rows] = await db.execute(query, [ticketId]);
    return rows;
};

// Add a new remark to a ticket
const addTicketRemark = async ({ ticketId, userId, remark, actionType = 'REMARK' }) => {
    const query = `
        INSERT INTO ticket_remarks (ticket_id, user_id, remark, action_type)
        VALUES (?, ?, ?, ?)
    `;
    const [result] = await db.execute(query, [ticketId, userId, remark.trim(), actionType]);

    // Update tickets table latest remarks column
    await db.execute(`UPDATE tickets SET remarks = ? WHERE id = ?`, [remark.trim(), ticketId]);

    return result;
};

// Shift ticket to a new Ticket Type and Subticket Type
const shiftTicket = async ({
    ticketId,
    newTicketTypeId,
    newSubTicketTypeId,
    newAssignedTo,
    shiftedByUserId,
    reasonRemark = ''
}) => {
    const jsonAssignedTo = JSON.stringify(newAssignedTo || []);

    const updateQuery = `
        UPDATE tickets
        SET ticket_type_id = ?,
            sub_ticket_type_id = ?,
            assigned_to = ?
        WHERE id = ?
    `;
    const [result] = await db.execute(updateQuery, [newTicketTypeId, newSubTicketTypeId, jsonAssignedTo, ticketId]);

    // Get new ticket type and subticket names for remark log
    const [ttRows] = await db.execute(`SELECT name FROM ticket_type_master WHERE id = ?`, [newTicketTypeId]);
    const [sttRows] = await db.execute(`SELECT name FROM sub_ticket_type_master WHERE id = ?`, [newSubTicketTypeId]);

    const ttName = ttRows[0]?.name || 'Unknown Type';
    const sttName = sttRows[0]?.name || 'Unknown Subticket';

    const logRemark = `Shifted ticket to category "${ttName} > ${sttName}"${reasonRemark ? `. Note: ${reasonRemark}` : ''}`;

    await db.execute(
        `INSERT INTO ticket_remarks (ticket_id, user_id, remark, action_type) VALUES (?, ?, ?, 'SHIFT')`,
        [ticketId, shiftedByUserId, logRemark]
    );

    return result;
};

// Mark ticket as completed
const completeTicket = async ({ ticketId, completedByUserId, resolutionRemark = '' }) => {
    const updateQuery = `
        UPDATE tickets
        SET status = 'COMPLETED',
            completed_at = CURRENT_TIMESTAMP,
            completed_by = ?
        WHERE id = ?
    `;
    const [result] = await db.execute(updateQuery, [completedByUserId, ticketId]);

    const remarkText = resolutionRemark && resolutionRemark.trim()
        ? `Ticket completed: ${resolutionRemark.trim()}`
        : 'Ticket marked as completed.';

    await db.execute(
        `INSERT INTO ticket_remarks (ticket_id, user_id, remark, action_type) VALUES (?, ?, ?, 'COMPLETED')`,
        [ticketId, completedByUserId, remarkText]
    );

    return result;
};

// Get stats for tabs and dashboard
const getTicketStatsForUser = async ({ userId, isAdmin }) => {
    let baseWhere = '';
    let params = [];

    if (!isAdmin) {
        baseWhere = `WHERE (created_by = ? OR JSON_CONTAINS(assigned_to, CAST(? AS JSON)))`;
        params = [userId, JSON.stringify(userId)];
    }

    const query = `
        SELECT
            COUNT(*) AS total,
            COUNT(CASE WHEN status != 'COMPLETED' THEN 1 END) AS active_count,
            COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) AS history_count,
            COUNT(CASE WHEN JSON_CONTAINS(assigned_to, CAST(? AS JSON)) AND status != 'COMPLETED' THEN 1 END) AS assigned_to_me_active
        FROM tickets
        ${baseWhere}
    `;

    // Parameter order: the assigned_to_me check takes userId, followed by baseWhere params if not admin
    const statsParams = [JSON.stringify(userId), ...params];
    const [rows] = await db.execute(query, statsParams);

    return rows[0] || {
        total: 0,
        active_count: 0,
        history_count: 0,
        assigned_to_me_active: 0
    };
};

module.exports = {
    createTicketTables,
    createTicket,
    getTicketsForUser,
    getTicketById,
    getTicketRemarks,
    addTicketRemark,
    shiftTicket,
    completeTicket,
    getTicketStatsForUser
};

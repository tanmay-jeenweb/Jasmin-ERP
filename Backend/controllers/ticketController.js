const db = require('../config/db.js');
const {
    createTicket,
    getTicketsForUser,
    getTicketById,
    getTicketRemarks,
    addTicketRemark,
    shiftTicket,
    completeTicket,
    getTicketStatsForUser
} = require('../models/ticketModel.js');
const { getTicketTypeById } = require('../models/ticketTypeModel.js');
const { getSubTicketTypeById } = require('../models/subTicketTypeModel.js');
const { createAuditLog } = require('../models/auditLogModel.js');
const { getFileUrl } = require('../config/uploadConfig.js');

// Helper to check if a user has ticket management permissions
const checkHasTicketManagementPermission = async (user) => {
    if (!user) return false;
    if (user.role === 'admin' || user.role === 'super admin') return true;

    const userTypeId = user.user_type_id;
    if (!userTypeId) return false;

    const query = `
        SELECT can_update, can_write 
        FROM user_type_permissions 
        WHERE user_type_id = ? AND master_name IN ('ticket_management', 'sub_ticket_type_master')
    `;
    const [rows] = await db.execute(query, [userTypeId]);
    return rows.some(r => r.can_update === 1 || r.can_write === 1);
};

// 1. Create a new Ticket
const createTicketController = async (req, res) => {
    try {
        const { ticket_type_id, sub_ticket_type_id, title, description, remarks } = req.body;
        const createdBy = req.user.id;
        const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';

        // Compulsory Validation
        if (!ticket_type_id) {
            return res.status(400).json({ success: false, message: 'Ticket type is required.' });
        }
        if (!sub_ticket_type_id) {
            return res.status(400).json({ success: false, message: 'Sub ticket type is required.' });
        }
        if (!title || !title.trim()) {
            return res.status(400).json({ success: false, message: 'Title is required.' });
        }
        if (!description || !description.trim()) {
            return res.status(400).json({ success: false, message: 'Describe the issue (Description) is compulsory.' });
        }

        // Verify Ticket Type exists
        const ticketType = await getTicketTypeById(ticket_type_id);
        if (!ticketType) {
            return res.status(404).json({ success: false, message: 'Selected ticket type does not exist.' });
        }

        // Verify Sub Ticket Type exists & fetch assigned resolvers
        const subTicketType = await getSubTicketTypeById(sub_ticket_type_id);
        if (!subTicketType) {
            return res.status(404).json({ success: false, message: 'Selected sub ticket type does not exist.' });
        }

        if (String(subTicketType.ticket_type_id) !== String(ticket_type_id)) {
            return res.status(400).json({ success: false, message: 'Sub ticket type does not belong to selected ticket type.' });
        }

        const assignedTo = subTicketType.assigned_to || [];
        if (assignedTo.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'The selected sub ticket type has no assigned resolvers. Please contact an administrator.'
            });
        }

        // Handle uploaded images (max 5)
        const uploadedImages = [];
        if (req.files && Array.isArray(req.files)) {
            if (req.files.length > 5) {
                return res.status(400).json({ success: false, message: 'Maximum 5 images are allowed.' });
            }
            for (const file of req.files) {
                uploadedImages.push(file.filename);
            }
        }

        const result = await createTicket({
            ticketTypeId: parseInt(ticket_type_id, 10),
            subTicketTypeId: parseInt(sub_ticket_type_id, 10),
            title: title.trim(),
            description: description.trim(),
            images: uploadedImages,
            remarks: remarks ? remarks.trim() : '',
            assignedTo,
            createdBy,
            deviceId
        });

        await createAuditLog(
            createdBy,
            req.user?.name || req.user?.username || 'Unknown',
            deviceId,
            'Ticket Creation',
            result.ticket_no,
            null,
            { id: result.id, ticket_no: result.ticket_no, title: title.trim() }
        );

        res.status(201).json({
            success: true,
            message: `Ticket ${result.ticket_no} created successfully.`,
            data: result
        });
    } catch (error) {
        console.error('Error creating ticket:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create ticket. Internal server error.'
        });
    }
};

// 2. Get tickets list for current user (Active or History)
const getTicketsController = async (req, res) => {
    try {
        const userId = req.user.id;
        const isAdmin = req.user.role === 'admin' || req.user.role === 'super admin';
        const { tab = 'active', search = '', ticket_type_id = null } = req.query;

        const tickets = await getTicketsForUser({
            userId,
            isAdmin,
            tab,
            search,
            ticketTypeId: ticket_type_id ? parseInt(ticket_type_id, 10) : null
        });

        // Also check if current user has ticket management permission (for UI action flags)
        const hasTicketManagement = await checkHasTicketManagementPermission(req.user);

        const formattedTickets = tickets.map(t => ({
            ...t,
            image_urls: (t.images || []).map(img => getFileUrl(img))
        }));

        res.status(200).json({
            success: true,
            data: formattedTickets,
            userMeta: {
                currentUserId: userId,
                isAdmin,
                hasTicketManagement
            }
        });
    } catch (error) {
        console.error('Error fetching tickets:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch tickets. Internal server error.'
        });
    }
};

// 3. Get single ticket details with full remarks thread
const getTicketDetailsController = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const isAdmin = req.user.role === 'admin' || req.user.role === 'super admin';

        const ticket = await getTicketById(id);
        if (!ticket) {
            return res.status(404).json({ success: false, message: 'Ticket not found.' });
        }

        // Check view permission: must be admin OR ticket creator OR assigned resolver
        const isCreator = ticket.created_by === userId;
        const isResolver = ticket.assigned_to.some(aid => String(aid) === String(userId));

        if (!isAdmin && !isCreator && !isResolver) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. You do not have permission to view this ticket.'
            });
        }

        const remarksThread = await getTicketRemarks(id);
        const hasTicketManagement = await checkHasTicketManagementPermission(req.user);

        res.status(200).json({
            success: true,
            data: {
                ...ticket,
                image_urls: (ticket.images || []).map(img => getFileUrl(img)),
                remarks_thread: remarksThread,
                permissions: {
                    canAddRemark: (isCreator || isResolver || isAdmin) && ticket.status !== 'COMPLETED',
                    canShift: (isAdmin || hasTicketManagement || isResolver) && ticket.status !== 'COMPLETED',
                    canComplete: (isResolver || isAdmin) && ticket.status !== 'COMPLETED',
                    isLocked: ticket.status === 'COMPLETED'
                }
            }
        });
    } catch (error) {
        console.error('Error fetching ticket details:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch ticket details. Internal server error.'
        });
    }
};

// 4. Add remark to ticket (Creator, Resolver, or Admin for 2-way communication)
const addRemarkController = async (req, res) => {
    try {
        const { id } = req.params;
        const { remark } = req.body;
        const userId = req.user.id;
        const isAdmin = req.user.role === 'admin' || req.user.role === 'super admin';

        if (!remark || !remark.trim()) {
            return res.status(400).json({ success: false, message: 'Remark cannot be empty.' });
        }

        const ticket = await getTicketById(id);
        if (!ticket) {
            return res.status(404).json({ success: false, message: 'Ticket not found.' });
        }

        // Locked check: completed tickets cannot be edited
        if (ticket.status === 'COMPLETED') {
            return res.status(400).json({
                success: false,
                message: 'This ticket is completed and locked. No further remarks or edits can be added.'
            });
        }

        // Only ticket creator, assigned resolvers, or admin can add remarks
        const isCreator = ticket.created_by === userId;
        const isResolver = ticket.assigned_to.some(aid => String(aid) === String(userId));
        if (!isCreator && !isResolver && !isAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Only the ticket creator, assigned resolvers, or admins can add remarks.'
            });
        }

        await addTicketRemark({
            ticketId: id,
            userId,
            remark: remark.trim(),
            actionType: 'REMARK'
        });

        const updatedRemarks = await getTicketRemarks(id);

        res.status(200).json({
            success: true,
            message: 'Remark added successfully.',
            data: updatedRemarks
        });
    } catch (error) {
        console.error('Error adding remark:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add remark. Internal server error.'
        });
    }
};

// 5. Shift ticket to another Ticket Type & Sub Ticket Type
const shiftTicketController = async (req, res) => {
    try {
        const { id } = req.params;
        const { new_ticket_type_id, new_sub_ticket_type_id, reason_remark } = req.body;
        const userId = req.user.id;
        const isAdmin = req.user.role === 'admin' || req.user.role === 'super admin';

        if (!new_ticket_type_id || !new_sub_ticket_type_id) {
            return res.status(400).json({
                success: false,
                message: 'Both new Ticket Type and new Sub Ticket Type are required to shift a ticket.'
            });
        }

        const ticket = await getTicketById(id);
        if (!ticket) {
            return res.status(404).json({ success: false, message: 'Ticket not found.' });
        }

        // Locked check
        if (ticket.status === 'COMPLETED') {
            return res.status(400).json({
                success: false,
                message: 'This ticket is completed and locked. It cannot be shifted.'
            });
        }

        // Permission check: Admin, users with ticket management permission, or assigned resolvers can shift
        const isCreator = ticket.created_by === userId;
        const isResolver = ticket.assigned_to.some(aid => String(aid) === String(userId));
        const hasTicketManagement = await checkHasTicketManagementPermission(req.user);

        if (!isAdmin && !hasTicketManagement && !isResolver) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Only administrators, ticket management staff, or assigned resolvers can shift this ticket.'
            });
        }

        // Verify new sub ticket type and its assignees
        const newSubTicketType = await getSubTicketTypeById(new_sub_ticket_type_id);
        if (!newSubTicketType) {
            return res.status(404).json({ success: false, message: 'New sub ticket type does not exist.' });
        }

        if (String(newSubTicketType.ticket_type_id) !== String(new_ticket_type_id)) {
            return res.status(400).json({
                success: false,
                message: 'New sub ticket type does not belong to the selected ticket type.'
            });
        }

        const newAssignedTo = newSubTicketType.assigned_to || [];
        if (newAssignedTo.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'The new sub ticket type has no assigned resolvers.'
            });
        }

        await shiftTicket({
            ticketId: id,
            newTicketTypeId: parseInt(new_ticket_type_id, 10),
            newSubTicketTypeId: parseInt(new_sub_ticket_type_id, 10),
            newAssignedTo,
            shiftedByUserId: userId,
            reasonRemark: reason_remark ? reason_remark.trim() : ''
        });

        const updatedTicket = await getTicketById(id);
        const updatedRemarks = await getTicketRemarks(id);

        res.status(200).json({
            success: true,
            message: 'Ticket shifted successfully to new category and assignees.',
            data: {
                ...updatedTicket,
                remarks_thread: updatedRemarks
            }
        });
    } catch (error) {
        console.error('Error shifting ticket:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to shift ticket. Internal server error.'
        });
    }
};

// 6. Complete Ticket
const completeTicketController = async (req, res) => {
    try {
        const { id } = req.params;
        const { resolution_remark } = req.body;
        const userId = req.user.id;
        const isAdmin = req.user.role === 'admin' || req.user.role === 'super admin';

        const ticket = await getTicketById(id);
        if (!ticket) {
            return res.status(404).json({ success: false, message: 'Ticket not found.' });
        }

        if (ticket.status === 'COMPLETED') {
            return res.status(400).json({ success: false, message: 'Ticket is already marked as completed.' });
        }

        // Only assigned resolvers or admin can complete
        const isResolver = ticket.assigned_to.some(aid => String(aid) === String(userId));
        if (!isResolver && !isAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Only assigned ticket resolvers or admins can mark a ticket as completed.'
            });
        }

        await completeTicket({
            ticketId: id,
            completedByUserId: userId,
            resolutionRemark: resolution_remark ? resolution_remark.trim() : ''
        });

        res.status(200).json({
            success: true,
            message: 'Ticket marked as Completed and moved to History.'
        });
    } catch (error) {
        console.error('Error completing ticket:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to complete ticket. Internal server error.'
        });
    }
};

// 7. Get form options (Ticket Types and Sub Ticket Types) for ticket creation and shift dropdowns
const getTicketFormOptionsController = async (req, res) => {
    try {
        // Fetch active ticket types
        const [ticketTypes] = await db.execute(`
            SELECT id, name FROM ticket_type_master ORDER BY name ASC
        `);

        // Fetch active sub ticket types
        const [subTicketTypes] = await db.execute(`
            SELECT id, ticket_type_id, name, assigned_to, remark
            FROM sub_ticket_type_master
            ORDER BY name ASC
        `);

        // Fetch users map for resolver names
        const [users] = await db.execute(`
            SELECT id, name, username, email FROM users WHERE active = TRUE
        `);
        const userMap = new Map(users.map(u => [u.id, u.name]));

        const parsedSubTickets = subTicketTypes.map(st => {
            let assignedIds = [];
            try {
                assignedIds = typeof st.assigned_to === 'string' ? JSON.parse(st.assigned_to) : (st.assigned_to || []);
                if (!Array.isArray(assignedIds)) assignedIds = [assignedIds];
            } catch (e) {
                assignedIds = [];
            }
            const assigneeNames = assignedIds.map(id => userMap.get(id) || `User #${id}`);
            return {
                id: st.id,
                ticket_type_id: st.ticket_type_id,
                name: st.name,
                assigned_to: assignedIds,
                assigned_names: assigneeNames.join(', '),
                remark: st.remark || ''
            };
        });

        res.status(200).json({
            success: true,
            data: {
                ticket_types: ticketTypes,
                sub_ticket_types: parsedSubTickets
            }
        });
    } catch (error) {
        console.error('Error fetching ticket form options:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load ticket options. Internal server error.'
        });
    }
};

// 8. Get ticket stats
const getTicketStatsController = async (req, res) => {
    try {
        const userId = req.user.id;
        const isAdmin = req.user.role === 'admin' || req.user.role === 'super admin';

        const stats = await getTicketStatsForUser({ userId, isAdmin });

        res.status(200).json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Error fetching ticket stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch ticket stats. Internal server error.'
        });
    }
};

module.exports = {
    createTicketController,
    getTicketsController,
    getTicketDetailsController,
    addRemarkController,
    shiftTicketController,
    completeTicketController,
    getTicketFormOptionsController,
    getTicketStatsController
};

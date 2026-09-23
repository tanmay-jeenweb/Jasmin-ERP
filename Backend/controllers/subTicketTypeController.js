const {
    createSubTicketType,
    getAllSubTicketTypes,
    getSubTicketTypeById,
    checkDuplicateSubTicket,
    updateSubTicketType,
    deleteSubTicketType,
    getActiveAssignees
} = require('../models/subTicketTypeModel.js');
const { getTicketTypeById } = require('../models/ticketTypeModel.js');
const { createAuditLog } = require('../models/auditLogModel.js');

const addSubTicketTypeController = async (req, res) => {
    try {
        const { ticket_type_id, name, assigned_to, remark } = req.body;
        const addedBy = req.user.id;
        const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';

        if (!ticket_type_id) {
            return res.status(400).json({ success: false, message: 'Ticket type is required' });
        }
        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Subticket name is required' });
        }

        // Normalize assigned_to to array of integer user IDs
        let assignedIds = [];
        if (Array.isArray(assigned_to)) {
            assignedIds = assigned_to.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
        } else if (assigned_to) {
            const parsed = parseInt(assigned_to, 10);
            if (!isNaN(parsed)) assignedIds = [parsed];
        }

        if (assignedIds.length === 0) {
            return res.status(400).json({ success: false, message: 'At least one person must be assigned to this ticket' });
        }

        const trimmedName = name.trim();
        const cleanRemark = remark && typeof remark === 'string' ? remark.trim() : null;

        // Verify parent ticket type exists
        const ticketType = await getTicketTypeById(ticket_type_id);
        if (!ticketType) {
            return res.status(404).json({ success: false, message: 'Selected ticket type does not exist' });
        }

        // Check for duplicate subticket under the same ticket type
        const duplicate = await checkDuplicateSubTicket(ticket_type_id, trimmedName);
        if (duplicate) {
            return res.status(400).json({
                success: false,
                message: `Subticket '${trimmedName}' already exists under '${ticketType.name}'`
            });
        }

        const result = await createSubTicketType(ticket_type_id, trimmedName, assignedIds, addedBy, deviceId, cleanRemark);

        await createAuditLog(
            addedBy,
            req.user?.name || req.user?.username || 'Unknown',
            deviceId,
            'Sub Ticket Type Master',
            'created',
            null,
            {
                id: result.insertId,
                ticket_type_id,
                ticket_type_name: ticketType.name,
                name: trimmedName,
                assigned_to: assignedIds,
                remark: cleanRemark,
                added_by: addedBy,
                device_id: deviceId
            }
        );

        res.status(201).json({
            success: true,
            message: 'Sub ticket type created successfully',
            data: {
                id: result.insertId,
                ticket_type_id,
                name: trimmedName,
                assigned_to: assignedIds,
                remark: cleanRemark
            }
        });
    } catch (error) {
        console.error('Error adding sub ticket type:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const getAllSubTicketTypesController = async (req, res) => {
    try {
        const subTicketTypes = await getAllSubTicketTypes();
        res.status(200).json({
            success: true,
            message: 'Sub ticket types retrieved successfully',
            data: subTicketTypes
        });
    } catch (error) {
        console.error('Error retrieving sub ticket types:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const getAssigneesController = async (req, res) => {
    try {
        const assignees = await getActiveAssignees();
        res.status(200).json({
            success: true,
            message: 'Active assignees retrieved successfully',
            data: assignees
        });
    } catch (error) {
        console.error('Error retrieving assignees:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const updateSubTicketTypeController = async (req, res) => {
    try {
        const { id } = req.params;
        const { ticket_type_id, name, assigned_to, remark } = req.body;
        const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';

        if (!ticket_type_id) {
            return res.status(400).json({ success: false, message: 'Ticket type is required' });
        }
        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Subticket name is required' });
        }

        // Normalize assigned_to to array of integer user IDs
        let assignedIds = [];
        if (Array.isArray(assigned_to)) {
            assignedIds = assigned_to.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
        } else if (assigned_to) {
            const parsed = parseInt(assigned_to, 10);
            if (!isNaN(parsed)) assignedIds = [parsed];
        }

        if (assignedIds.length === 0) {
            return res.status(400).json({ success: false, message: 'At least one person must be assigned to this ticket' });
        }

        const trimmedName = name.trim();
        const cleanRemark = remark && typeof remark === 'string' ? remark.trim() : null;

        const existing = await getSubTicketTypeById(id);
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Sub ticket type not found' });
        }

        const ticketType = await getTicketTypeById(ticket_type_id);
        if (!ticketType) {
            return res.status(404).json({ success: false, message: 'Selected ticket type does not exist' });
        }

        const duplicate = await checkDuplicateSubTicket(ticket_type_id, trimmedName, id);
        if (duplicate) {
            return res.status(400).json({
                success: false,
                message: `Subticket '${trimmedName}' already exists under '${ticketType.name}'`
            });
        }

        await updateSubTicketType(id, ticket_type_id, trimmedName, assignedIds, cleanRemark);

        await createAuditLog(
            req.user.id,
            req.user?.name || req.user?.username || 'Unknown',
            deviceId,
            'Sub Ticket Type Master',
            'updated',
            {
                id: existing.id,
                ticket_type_id: existing.ticket_type_id,
                name: existing.name,
                assigned_to: existing.assigned_to,
                remark: existing.remark
            },
            {
                id: existing.id,
                ticket_type_id,
                name: trimmedName,
                assigned_to: assignedIds,
                remark: cleanRemark
            }
        );

        res.status(200).json({
            success: true,
            message: 'Sub ticket type updated successfully',
            data: {
                id: parseInt(id, 10),
                ticket_type_id,
                name: trimmedName,
                assigned_to: assignedIds,
                remark: cleanRemark
            }
        });
    } catch (error) {
        console.error('Error updating sub ticket type:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const deleteSubTicketTypeController = async (req, res) => {
    try {
        const { id } = req.params;
        const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';

        const existing = await getSubTicketTypeById(id);
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Sub ticket type not found' });
        }

        await deleteSubTicketType(id);

        await createAuditLog(
            req.user.id,
            req.user?.name || req.user?.username || 'Unknown',
            deviceId,
            'Sub Ticket Type Master',
            'deleted',
            {
                id: existing.id,
                ticket_type_id: existing.ticket_type_id,
                name: existing.name,
                assigned_to: existing.assigned_to
            },
            null
        );

        res.status(200).json({
            success: true,
            message: 'Sub ticket type deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting sub ticket type:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

module.exports = {
    addSubTicketTypeController,
    getAllSubTicketTypesController,
    getAssigneesController,
    updateSubTicketTypeController,
    deleteSubTicketTypeController
};

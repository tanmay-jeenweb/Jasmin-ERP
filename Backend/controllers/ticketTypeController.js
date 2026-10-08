const {
    createTicketType,
    getAllTicketTypes,
    getTicketTypeById,
    getTicketTypeByName,
    updateTicketType,
    countSubTicketsByTicketTypeId,
    deleteTicketType
} = require('../models/ticketTypeModel.js');
const { createAuditLog } = require('../models/auditLogModel.js');

const addTicketTypeController = async (req, res) => {
    try {
        const { name } = req.body;
        const addedBy = req.user.id;
        const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';

        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Ticket type name is required' });
        }

        const trimmedName = name.trim();

        // Check for duplicates
        const existing = await getTicketTypeByName(trimmedName);
        if (existing) {
            return res.status(400).json({ success: false, message: 'A ticket type with this name already exists' });
        }

        const result = await createTicketType(trimmedName, addedBy, deviceId);

        await createAuditLog(
            addedBy,
            req.user?.name || req.user?.username || 'Unknown',
            deviceId,
            'Ticket Type Master',
            'created',
            null,
            {
                id: result.insertId,
                name: trimmedName,
                added_by: addedBy,
                device_id: deviceId
            }
        );

        res.status(201).json({
            success: true,
            message: 'Ticket type created successfully',
            data: {
                id: result.insertId,
                name: trimmedName
            }
        });
    } catch (error) {
        console.error('Error adding ticket type:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const getAllTicketTypesController = async (req, res) => {
    try {
        const ticketTypes = await getAllTicketTypes();
        res.status(200).json({
            success: true,
            message: 'Ticket types retrieved successfully',
            data: ticketTypes
        });
    } catch (error) {
        console.error('Error retrieving ticket types:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const updateTicketTypeController = async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';

        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Ticket type name is required' });
        }

        const trimmedName = name.trim();

        const existing = await getTicketTypeById(id);
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Ticket type not found' });
        }

        // Check if name is taken by another ticket type
        const duplicate = await getTicketTypeByName(trimmedName);
        if (duplicate && duplicate.id !== parseInt(id, 10)) {
            return res.status(400).json({ success: false, message: 'Another ticket type with this name already exists' });
        }

        await updateTicketType(id, trimmedName);

        await createAuditLog(
            req.user.id,
            req.user?.name || req.user?.username || 'Unknown',
            deviceId,
            'Ticket Type Master',
            'updated',
            { id: existing.id, name: existing.name },
            { id: existing.id, name: trimmedName }
        );

        res.status(200).json({
            success: true,
            message: 'Ticket type updated successfully',
            data: {
                id: parseInt(id, 10),
                name: trimmedName
            }
        });
    } catch (error) {
        console.error('Error updating ticket type:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const deleteTicketTypeController = async (req, res) => {
    try {
        const { id } = req.params;
        const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';

        const existing = await getTicketTypeById(id);
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Ticket type not found' });
        }

        // Check if linked subtickets exist
        const subTicketCount = await countSubTicketsByTicketTypeId(id);
        if (subTicketCount > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete ticket type because it has ${subTicketCount} linked sub ticket type(s). Please delete or reassign them first.`
            });
        }

        await deleteTicketType(id);

        await createAuditLog(
            req.user.id,
            req.user?.name || req.user?.username || 'Unknown',
            deviceId,
            'Ticket Type Master',
            'deleted',
            { id: existing.id, name: existing.name },
            null
        );

        res.status(200).json({
            success: true,
            message: 'Ticket type deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting ticket type:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

module.exports = {
    addTicketTypeController,
    getAllTicketTypesController,
    updateTicketTypeController,
    deleteTicketTypeController
};

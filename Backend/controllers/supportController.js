const {
    createSupport,
    getAllSupports,
    updateSupport,
    deleteSupport,
    getSupportById
} = require('../models/supportModel.js');
const { createAuditLog } = require('../models/auditLogModel.js');

const addSupportController = async (req, res) => {
    try {
        const { name, designation, mobile_no, work } = req.body;
        const addedBy = req.user.id;
        const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';

        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Name is required' });
        }
        if (!designation || !designation.trim()) {
            return res.status(400).json({ success: false, message: 'Designation is required' });
        }
        if (!mobile_no || !mobile_no.trim()) {
            return res.status(400).json({ success: false, message: 'Mobile No. is required' });
        }
        if (!work || !work.trim()) {
            return res.status(400).json({ success: false, message: 'Work is required' });
        }

        const result = await createSupport(
            name.trim(),
            designation.trim(),
            mobile_no.trim(),
            work.trim(),
            addedBy,
            deviceId
        );
        
        await createAuditLog(
            addedBy,
            req.user?.name || req.user?.username || 'Unknown',
            deviceId,
            'Support Master',
            'created',
            null,
            {
                id: result.insertId,
                name: name.trim(),
                designation: designation.trim(),
                mobile_no: mobile_no.trim(),
                work: work.trim(),
                added_by: addedBy,
                device_id: deviceId
            }
        );

        res.status(201).json({
            success: true,
            message: 'Support record added successfully',
            data: {
                id: result.insertId,
                name: name.trim(),
                designation: designation.trim(),
                mobile_no: mobile_no.trim(),
                work: work.trim()
            }
        });
    } catch (error) {
        console.error('Error adding support:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const getAllSupportsController = async (req, res) => {
    try {
        const supports = await getAllSupports();
        res.status(200).json({
            success: true,
            message: 'Support records retrieved successfully',
            data: supports
        });
    } catch (error) {
        console.error('Error retrieving support records:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const updateSupportController = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, designation, mobile_no, work } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Name is required' });
        }
        if (!designation || !designation.trim()) {
            return res.status(400).json({ success: false, message: 'Designation is required' });
        }
        if (!mobile_no || !mobile_no.trim()) {
            return res.status(400).json({ success: false, message: 'Mobile No. is required' });
        }
        if (!work || !work.trim()) {
            return res.status(400).json({ success: false, message: 'Work is required' });
        }

        const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';
        const beforeData = await getSupportById(id);
        if (!beforeData) {
            return res.status(404).json({ success: false, message: 'Support record not found' });
        }

        await updateSupport(id, name.trim(), designation.trim(), mobile_no.trim(), work.trim());
        
        await createAuditLog(
            req.user?.id,
            req.user?.name || req.user?.username || 'Unknown',
            deviceId,
            'Support Master',
            'updated',
            beforeData,
            {
                ...beforeData,
                name: name.trim(),
                designation: designation.trim(),
                mobile_no: mobile_no.trim(),
                work: work.trim()
            }
        );

        res.status(200).json({ success: true, message: 'Support record updated successfully' });
    } catch (error) {
        console.error('Error updating support record:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const deleteSupportController = async (req, res) => {
    try {
        const { id } = req.params;
        const beforeData = await getSupportById(id);
        if (!beforeData) {
            return res.status(404).json({ success: false, message: 'Support record not found' });
        }

        const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';
        await deleteSupport(id);
        
        await createAuditLog(
            req.user?.id,
            req.user?.name || req.user?.username || 'Unknown',
            deviceId,
            'Support Master',
            'deleted',
            beforeData,
            null
        );

        res.status(200).json({ success: true, message: 'Support record deleted successfully' });
    } catch (error) {
        console.error('Error deleting support record:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

module.exports = {
    addSupportController,
    getAllSupportsController,
    updateSupportController,
    deleteSupportController
};

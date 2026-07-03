const {
    createFinanceMachine,
    getAllFinanceMachines,
    updateFinanceMachine,
    deleteFinanceMachine,
    getFinanceMachineById
} = require('../models/financeMachineModel.js');
const { createAuditLog } = require('../models/auditLogModel.js');

const addFinanceMachineController = async (req, res) => {
    try {
        const { machineName } = req.body;
        const addedBy = req.user.id;
        const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';

        if (!machineName || !machineName.trim()) {
            return res.status(400).json({ success: false, message: 'Finance machine name is required' });
        }

        const result = await createFinanceMachine(machineName.trim(), addedBy, deviceId);
        
        await createAuditLog(
            addedBy,
            req.user?.name || req.user?.username || 'Unknown',
            deviceId,
            'Finance Machine Master',
            'created',
            null,
            {
                id: result.insertId,
                machine_name: machineName.trim(),
                added_by: addedBy,
                device_id: deviceId
            }
        );

        res.status(201).json({
            success: true,
            message: 'Finance machine added successfully',
            data: { id: result.insertId, machine_name: machineName.trim() }
        });
    } catch (error) {
        console.error('Error adding finance machine:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, message: 'Finance machine name already exists' });
        }
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const getAllFinanceMachinesController = async (req, res) => {
    try {
        const machines = await getAllFinanceMachines();
        res.status(200).json({
            success: true,
            message: 'Finance machines retrieved successfully',
            data: machines
        });
    } catch (error) {
        console.error('Error retrieving finance machines:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const updateFinanceMachineController = async (req, res) => {
    try {
        const { id } = req.params;
        const { machineName } = req.body;

        if (!machineName || !machineName.trim()) {
            return res.status(400).json({ success: false, message: 'Finance machine name is required' });
        }

        const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';
        const beforeData = await getFinanceMachineById(id);
        if (!beforeData) {
            return res.status(404).json({ success: false, message: 'Finance machine not found' });
        }

        await updateFinanceMachine(id, machineName.trim());
        
        await createAuditLog(
            req.user?.id,
            req.user?.name || req.user?.username || 'Unknown',
            deviceId,
            'Finance Machine Master',
            'updated',
            beforeData,
            {
                ...beforeData,
                machine_name: machineName.trim()
            }
        );

        res.status(200).json({ success: true, message: 'Finance machine updated successfully' });
    } catch (error) {
        console.error('Error updating finance machine:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, message: 'Finance machine name already exists' });
        }
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const deleteFinanceMachineController = async (req, res) => {
    try {
        const { id } = req.params;
        const beforeData = await getFinanceMachineById(id);
        if (!beforeData) {
            return res.status(404).json({ success: false, message: 'Finance machine not found' });
        }

        const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';
        await deleteFinanceMachine(id);
        
        await createAuditLog(
            req.user?.id,
            req.user?.name || req.user?.username || 'Unknown',
            deviceId,
            'Finance Machine Master',
            'deleted',
            beforeData,
            null
        );

        res.status(200).json({ success: true, message: 'Finance machine deleted successfully' });
    } catch (error) {
        console.error('Error deleting finance machine:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

module.exports = {
    addFinanceMachineController,
    getAllFinanceMachinesController,
    updateFinanceMachineController,
    deleteFinanceMachineController
};

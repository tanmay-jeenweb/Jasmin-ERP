const {
    createMobileBrand,
    getAllMobileBrands,
    updateMobileBrand,
    deleteMobileBrand,
    getMobileBrandById
} = require('../models/mobileBrandModel.js');
const { createAuditLog } = require('../models/auditLogModel.js');

const addMobileBrandController = async (req, res) => {
    try {
        const { mobileBrand, forCode } = req.body;
        const addedBy = req.user.id;
        const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';

        if (!mobileBrand || !mobileBrand.trim()) {
            return res.status(400).json({ success: false, message: 'Brand name is required' });
        }

        const result = await createMobileBrand(mobileBrand.trim(), addedBy, deviceId, forCode);
        
        await createAuditLog(
            addedBy,
            req.user?.name || req.user?.username || 'Unknown',
            deviceId,
            'Brand Master',
            'created',
            null,
            {
                id: result.insertId,
                mobile_brand: mobileBrand.trim(),
                for_code: forCode || 'No',
                added_by: addedBy,
                device_id: deviceId
            }
        );

        res.status(201).json({
            success: true,
            message: 'Brand added successfully',
            data: { id: result.insertId, mobile_brand: mobileBrand.trim(), for_code: forCode || 'No' }
        });
    } catch (error) {
        console.error('Error adding brand:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, message: 'Brand already exists' });
        }
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const getAllMobileBrandsController = async (req, res) => {
    try {
        const brands = await getAllMobileBrands();
        res.status(200).json({
            success: true,
            message: 'Brands retrieved successfully',
            data: brands
        });
    } catch (error) {
        console.error('Error retrieving brands:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const updateMobileBrandController = async (req, res) => {
    try {
        const { id } = req.params;
        const { mobileBrand, forCode } = req.body;

        if (!mobileBrand || !mobileBrand.trim()) {
            return res.status(400).json({ success: false, message: 'Brand name is required' });
        }

        const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';
        const beforeData = await getMobileBrandById(id);
        if (!beforeData) {
            return res.status(404).json({ success: false, message: 'Brand not found' });
        }

        await updateMobileBrand(id, mobileBrand.trim(), forCode);
        
        await createAuditLog(
            req.user?.id,
            req.user?.name || req.user?.username || 'Unknown',
            deviceId,
            'Brand Master',
            'updated',
            beforeData,
            {
                ...beforeData,
                mobile_brand: mobileBrand.trim(),
                for_code: forCode || 'No'
            }
        );

        res.status(200).json({ success: true, message: 'Brand updated successfully' });
    } catch (error) {
        console.error('Error updating brand:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, message: 'Brand already exists' });
        }
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const deleteMobileBrandController = async (req, res) => {
    try {
        const { id } = req.params;
        const beforeData = await getMobileBrandById(id);
        if (!beforeData) {
            return res.status(404).json({ success: false, message: 'Brand not found' });
        }

        const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';
        await deleteMobileBrand(id);
        
        await createAuditLog(
            req.user?.id,
            req.user?.name || req.user?.username || 'Unknown',
            deviceId,
            'Brand Master',
            'deleted',
            beforeData,
            null
        );

        res.status(200).json({ success: true, message: 'Brand deleted successfully' });
    } catch (error) {
        console.error('Error deleting brand:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

module.exports = {
    addMobileBrandController,
    getAllMobileBrandsController,
    updateMobileBrandController,
    deleteMobileBrandController
};

const {
    createProductType,
    getAllProductTypes,
    updateProductType,
    deleteProductType,
    getProductTypeById
} = require('../models/productTypeModel.js');
const { createAuditLog } = require('../models/auditLogModel.js');

const addProductTypeController = async (req, res) => {
    try {
        const { productTypeName } = req.body;
        const addedBy = req.user.id;
        const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';

        if (!productTypeName || !productTypeName.trim()) {
            return res.status(400).json({ success: false, message: 'Product type name is required' });
        }

        const result = await createProductType(productTypeName.trim(), addedBy, deviceId);
        
        await createAuditLog(
            addedBy,
            req.user?.name || req.user?.username || 'Unknown',
            deviceId,
            'Product Type Master',
            'created',
            null,
            {
                id: result.insertId,
                product_type_name: productTypeName.trim(),
                added_by: addedBy,
                device_id: deviceId
            }
        );

        res.status(201).json({
            success: true,
            message: 'Product type added successfully',
            data: { id: result.insertId, product_type_name: productTypeName.trim() }
        });
    } catch (error) {
        console.error('Error adding product type:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, message: 'Product type name already exists' });
        }
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const getAllProductTypesController = async (req, res) => {
    try {
        const productTypes = await getAllProductTypes();
        res.status(200).json({
            success: true,
            message: 'Product types retrieved successfully',
            data: productTypes
        });
    } catch (error) {
        console.error('Error retrieving product types:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const updateProductTypeController = async (req, res) => {
    try {
        const { id } = req.params;
        const { productTypeName } = req.body;

        if (!productTypeName || !productTypeName.trim()) {
            return res.status(400).json({ success: false, message: 'Product type name is required' });
        }

        const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';
        const beforeData = await getProductTypeById(id);
        if (!beforeData) {
            return res.status(404).json({ success: false, message: 'Product type not found' });
        }

        await updateProductType(id, productTypeName.trim());
        
        await createAuditLog(
            req.user?.id,
            req.user?.name || req.user?.username || 'Unknown',
            deviceId,
            'Product Type Master',
            'updated',
            beforeData,
            {
                ...beforeData,
                product_type_name: productTypeName.trim()
            }
        );

        res.status(200).json({ success: true, message: 'Product type updated successfully' });
    } catch (error) {
        console.error('Error updating product type:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, message: 'Product type name already exists' });
        }
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const deleteProductTypeController = async (req, res) => {
    try {
        const { id } = req.params;
        const beforeData = await getProductTypeById(id);
        if (!beforeData) {
            return res.status(404).json({ success: false, message: 'Product type not found' });
        }

        const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';
        await deleteProductType(id);
        
        await createAuditLog(
            req.user?.id,
            req.user?.name || req.user?.username || 'Unknown',
            deviceId,
            'Product Type Master',
            'deleted',
            beforeData,
            null
        );

        res.status(200).json({ success: true, message: 'Product type deleted successfully' });
    } catch (error) {
        console.error('Error deleting product type:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

module.exports = {
    addProductTypeController,
    getAllProductTypesController,
    updateProductTypeController,
    deleteProductTypeController
};

const express = require('express');
const {
    getAllTemplatesController,
    getTemplateByIdController,
    createTemplateController,
    updateTemplateController,
    deleteTemplateController,
    getTemplateFilterOptionsController,
    getTemplateExportDataController
} = require('../controllers/priceListTemplateController.js');
const { verifyToken, verifyPermission } = require('../middleware/authMiddleware.js');

const router = express.Router();

// Read operations
router.get('/', verifyToken, verifyPermission(['price_list_template_master', 'variation_master', 'price_list'], 'read'), getAllTemplatesController);
router.get('/:id', verifyToken, verifyPermission(['price_list_template_master', 'variation_master', 'price_list'], 'read'), getTemplateByIdController);
router.get('/:id/filter-options', verifyToken, verifyPermission(['price_list_template_master', 'variation_master', 'price_list'], 'read'), getTemplateFilterOptionsController);

// Write/Create operations
router.post('/', verifyToken, verifyPermission(['price_list_template_master', 'variation_master', 'price_list'], 'write'), createTemplateController);

// Update operations
router.put('/:id', verifyToken, verifyPermission(['price_list_template_master', 'variation_master', 'price_list'], 'update'), updateTemplateController);

// Delete operations
router.delete('/:id', verifyToken, verifyPermission(['price_list_template_master', 'variation_master', 'price_list'], 'delete'), deleteTemplateController);

// Export data query
router.post('/:id/export-data', verifyToken, verifyPermission(['price_list_template_master', 'variation_master', 'price_list'], 'read'), getTemplateExportDataController);

module.exports = router;

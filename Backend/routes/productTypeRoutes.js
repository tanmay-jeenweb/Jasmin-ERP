const express = require('express');
const {
    addProductTypeController,
    getAllProductTypesController,
    updateProductTypeController,
    deleteProductTypeController
} = require('../controllers/productTypeController.js');
const { verifyToken, verifyPermission } = require('../middleware/authMiddleware.js');

const router = express.Router();

router.post('/add', verifyToken, verifyPermission('product_type_master', 'write'), addProductTypeController);
router.get('/all', verifyToken, verifyPermission('product_type_master', 'read'), getAllProductTypesController);
router.put('/update/:id', verifyToken, verifyPermission('product_type_master', 'update'), updateProductTypeController);
router.delete('/delete/:id', verifyToken, verifyPermission('product_type_master', 'delete'), deleteProductTypeController);

module.exports = router;

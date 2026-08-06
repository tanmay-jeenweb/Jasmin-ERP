const express = require('express');
const {
    syncItemModelsController,
    getAllItemModelsController,
    deleteItemModelController,
    getDistinctBrandsController
} = require('../controllers/itemModelController.js');
const { verifyToken, verifyPermission } = require('../middleware/authMiddleware.js');

const router = express.Router();

router.post('/sync', verifyToken, verifyPermission('item_model_master', 'write'), syncItemModelsController);
router.get('/all', verifyToken, verifyPermission('item_model_master', 'read'), getAllItemModelsController);
router.get('/brands', verifyToken, getDistinctBrandsController);
router.delete('/delete/:id', verifyToken, verifyPermission('item_model_master', 'delete'), deleteItemModelController);

module.exports = router;

const express = require('express');
const {
    addVariationController,
    getAllVariationsController,
    getVariationByIdController,
    updateVariationController,
    deleteVariationController,
    restoreVariationController
} = require('../controllers/variationController.js');
const { verifyToken, verifyPermission } = require('../middleware/authMiddleware.js');

const router = express.Router();

router.post('/add', verifyToken, verifyPermission('variation_master', 'write'), addVariationController);
router.get('/all', verifyToken, verifyPermission(['variation_master', 'price_list', 'price_list_report', 'price_list_view'], 'read'), getAllVariationsController);
router.get('/:id', verifyToken, verifyPermission('variation_master', 'read'), getVariationByIdController);
router.put('/update/:id', verifyToken, verifyPermission('variation_master', 'update'), updateVariationController);
router.delete('/delete/:id', verifyToken, verifyPermission('variation_master', 'delete'), deleteVariationController);
router.post('/restore/:id', verifyToken, verifyPermission('variation_master', 'write'), restoreVariationController);

module.exports = router;

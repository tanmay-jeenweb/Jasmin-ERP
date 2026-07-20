const express = require('express');
const {
    getPriceListDataController,
    importPriceListController
} = require('../controllers/priceListController.js');
const { verifyToken, verifyPermission } = require('../middleware/authMiddleware.js');

const router = express.Router();

router.get('/:variationId', verifyToken, verifyPermission('variation_master', 'read'), getPriceListDataController);
router.post('/import/:variationId', verifyToken, verifyPermission('variation_master', 'update'), importPriceListController);

module.exports = router;

const express = require('express');
const {
    getPriceListDataController,
    importPriceListController,
    getPriceListReportController,
    getModelGroupStockInfoController
} = require('../controllers/priceListController.js');
const { verifyToken, verifyPermission } = require('../middleware/authMiddleware.js');

const router = express.Router();

router.get('/stock-info', verifyToken, verifyPermission('variation_master', 'read'), getModelGroupStockInfoController);
router.get('/report/:variationId', verifyToken, verifyPermission('variation_master', 'read'), getPriceListReportController);
router.get('/:variationId', verifyToken, verifyPermission('variation_master', 'read'), getPriceListDataController);
router.post('/import/:variationId', verifyToken, verifyPermission('variation_master', 'update'), importPriceListController);

module.exports = router;


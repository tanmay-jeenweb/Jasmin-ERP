const express = require('express');
const {
    getPriceListDataController,
    importPriceListController,
    getPriceListReportController,
    getModelGroupStockInfoController,
    getHistoryTimestampsController
} = require('../controllers/priceListController.js');
const { verifyToken, verifyPermission } = require('../middleware/authMiddleware.js');

const router = express.Router();

router.get('/stock-info', verifyToken, verifyPermission(['price_list_report', 'price_list_view'], 'read'), getModelGroupStockInfoController);
router.get('/history-timestamps/:variationId', verifyToken, verifyPermission(['price_list_report', 'price_list_view'], 'read'), getHistoryTimestampsController);
router.get('/report/:variationId', verifyToken, verifyPermission(['price_list_report', 'price_list_view'], 'read'), getPriceListReportController);
router.get('/:variationId', verifyToken, verifyPermission('price_list', 'read'), getPriceListDataController);
router.post('/import/:variationId', verifyToken, verifyPermission('price_list', 'write'), importPriceListController);

module.exports = router;


const express = require('express');
const { 
    getStockCashDepositReportController, 
    importStockCashDepositController,
    importCurrentStockController,
    importOpeningCashAndCreditController,
    importCashDepositController
} = require('../controllers/stockCashDepositController.js');
const { verifyToken, verifyPermission } = require('../middleware/authMiddleware.js');

const router = express.Router();

router.get('/all', verifyToken, verifyPermission('stock_vs_cash_deposit', 'read'), getStockCashDepositReportController);
router.post('/import', verifyToken, verifyPermission('stock_vs_cash_deposit', 'write'), importStockCashDepositController);
router.post('/import-current-stock', verifyToken, verifyPermission('stock_vs_cash_deposit', 'write'), importCurrentStockController);
router.post('/import-opening-credit', verifyToken, verifyPermission('stock_vs_cash_deposit', 'write'), importOpeningCashAndCreditController);
router.post('/import-cash-deposit', verifyToken, verifyPermission('stock_vs_cash_deposit', 'write'), importCashDepositController);

module.exports = router;

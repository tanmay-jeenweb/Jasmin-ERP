const express = require('express');
const { 
    getStockCashDepositReportController, 
    importStockCashDepositController,
    importCurrentStockController,
    importOpeningCashAndCreditController,
    importCashDepositController
} = require('../controllers/stockCashDepositController.js');
const { verifyToken } = require('../middleware/authMiddleware.js');

const router = express.Router();

router.get('/all', verifyToken, getStockCashDepositReportController);
router.post('/import', verifyToken, importStockCashDepositController);
router.post('/import-current-stock', verifyToken, importCurrentStockController);
router.post('/import-opening-credit', verifyToken, importOpeningCashAndCreditController);
router.post('/import-cash-deposit', verifyToken, importCashDepositController);

module.exports = router;

const express = require('express');
const router = express.Router();
const { getFinanceBrandReportController } = require('../controllers/branchBrandFinanceReportController.js');
const { verifyToken } = require('../middleware/authMiddleware.js');

router.get('/finance-brand-report', verifyToken, getFinanceBrandReportController);

module.exports = router;

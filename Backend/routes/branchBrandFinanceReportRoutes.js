const express = require('express');
const router = express.Router();
const { getFinanceBrandReportController } = require('../controllers/branchBrandFinanceReportController.js');
const { verifyToken, verifyPermission } = require('../middleware/authMiddleware.js');

router.get('/finance-brand-report', verifyToken, verifyPermission('finance_brand_report', 'read'), getFinanceBrandReportController);

module.exports = router;

const express = require('express');
console.log("🚀 externalRoutes.js is being loaded by index.js!");
const router = express.Router();
const { getExternalMasterData } = require('../controllers/externalController.js');
const { saveBranchMappingsController } = require('../controllers/branchBrandFinanceMappingController.js');
const { saveBranchFinanceCodesController } = require('../controllers/branchFinanceController.js');
const verifyExternalApi = require('../middleware/verifyExternalApi.js');

// Route to fetch brand, finance company, and finance machine master data
router.get('/master-data', getExternalMasterData);

// Incoming synchronization endpoints from Jasmin CRM
router.post('/sync/brand-finance-mapping/:branchId', verifyExternalApi, saveBranchMappingsController);
router.post('/sync/finance-codes/:branchId', verifyExternalApi, saveBranchFinanceCodesController);

module.exports = router;


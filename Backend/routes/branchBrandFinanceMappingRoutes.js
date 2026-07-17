const express = require('express');
const {
    getBranchMappingsController,
    saveBranchMappingsController
} = require('../controllers/branchBrandFinanceMappingController.js');
const { verifyToken, verifyPermission } = require('../middleware/authMiddleware.js');

const router = express.Router();

router.get('/:branchId', verifyToken, verifyPermission('branch_master', 'read'), getBranchMappingsController);
router.post('/:branchId', verifyToken, verifyPermission('branch_master', 'write'), saveBranchMappingsController);

module.exports = router;

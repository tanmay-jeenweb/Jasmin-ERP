const express = require('express');
const {
    getBranchFinanceCodesController,
    saveBranchFinanceCodesController
} = require('../controllers/branchFinanceController.js');
const { verifyToken, verifyPermission } = require('../middleware/authMiddleware.js');

const router = express.Router();

router.get('/:id', verifyToken, verifyPermission('branch_master', 'read'), getBranchFinanceCodesController);
router.post('/:id', verifyToken, verifyPermission('branch_master', 'write'), saveBranchFinanceCodesController);

module.exports = router;

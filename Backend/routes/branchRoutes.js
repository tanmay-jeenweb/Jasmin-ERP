const express = require('express');
const {
    addBranchController,
    getAllBranchesController,
    updateBranchController,
    deleteBranchController,
    syncBranchesController,
    getEligibleAbmsController,
    toggleBranchInternalStatusController
} = require('../controllers/branchController.js');
const { verifyToken, verifyPermission } = require('../middleware/authMiddleware.js');

const router = express.Router();

router.post('/add', verifyToken, verifyPermission('branch_master', 'write'), addBranchController);
router.post('/sync', verifyToken, verifyPermission('branch_master', 'write'), syncBranchesController);
router.get('/all', verifyToken, verifyPermission(['branch_master', 'finance_brand_mapping'], 'read'), getAllBranchesController);
router.get('/eligible-abms', verifyToken, verifyPermission('branch_master', 'read'), getEligibleAbmsController);
router.put('/update/:id', verifyToken, verifyPermission('branch_master', 'update'), updateBranchController);
router.patch('/internal-status/:id', verifyToken, verifyPermission('branch_master', 'update'), toggleBranchInternalStatusController);
router.delete('/delete/:id', verifyToken, verifyPermission('branch_master', 'delete'), deleteBranchController);

module.exports = router;

const express = require('express');
const {
    getEligibleAbmsController,
    getActiveBranchesController,
    getAllAbmMappingsController,
    getAbmMappingByIdController,
    saveAbmBranchMappingController,
    deleteAbmMappingController
} = require('../controllers/abmBranchMappingController.js');
const { verifyToken, verifyPermission } = require('../middleware/authMiddleware.js');

const router = express.Router();

router.get('/abms', verifyToken, verifyPermission('abm_branch_mapping', 'read'), getEligibleAbmsController);
router.get('/branches', verifyToken, verifyPermission('abm_branch_mapping', 'read'), getActiveBranchesController);
router.get('/all', verifyToken, verifyPermission('abm_branch_mapping', 'read'), getAllAbmMappingsController);
router.get('/:id', verifyToken, verifyPermission('abm_branch_mapping', 'read'), getAbmMappingByIdController);
router.post('/save', verifyToken, verifyPermission('abm_branch_mapping', 'write'), saveAbmBranchMappingController);
router.delete('/delete/:id', verifyToken, verifyPermission('abm_branch_mapping', 'delete'), deleteAbmMappingController);

module.exports = router;

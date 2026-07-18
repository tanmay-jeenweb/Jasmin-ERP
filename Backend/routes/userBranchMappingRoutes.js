const express = require('express');
const {
    getEligibleUsersController,
    getActiveBranchesController,
    getAllUserMappingsController,
    getUserMappingByIdController,
    saveUserBranchMappingController,
    deleteUserMappingController
} = require('../controllers/userBranchMappingController.js');
const { verifyToken, verifyPermission } = require('../middleware/authMiddleware.js');

const router = express.Router();

router.get('/users', verifyToken, verifyPermission('user_branch_mapping', 'read'), getEligibleUsersController);
router.get('/branches', verifyToken, verifyPermission('user_branch_mapping', 'read'), getActiveBranchesController);
router.get('/all', verifyToken, verifyPermission('user_branch_mapping', 'read'), getAllUserMappingsController);
router.get('/:id', verifyToken, verifyPermission('user_branch_mapping', 'read'), getUserMappingByIdController);
router.post('/save', verifyToken, verifyPermission('user_branch_mapping', 'write'), saveUserBranchMappingController);
router.delete('/delete/:id', verifyToken, verifyPermission('user_branch_mapping', 'delete'), deleteUserMappingController);

module.exports = router;

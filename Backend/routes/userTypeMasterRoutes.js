const express = require('express');
const {
    addUserType,
    getAllUserTypesController,
    updateUserTypeController,
    deleteUserTypeController
} = require('../controllers/userTypeMasterController.js');
const { verifyToken, verifyPermission } = require('../middleware/authMiddleware.js');

const router = express.Router();

router.post('/add', verifyToken, verifyPermission('user_type', 'write'), addUserType);
router.get('/all', verifyToken, verifyPermission('user_type', 'read'), getAllUserTypesController);
router.put('/update/:id', verifyToken, verifyPermission('user_type', 'update'), updateUserTypeController);
router.delete('/delete/:id', verifyToken, verifyPermission('user_type', 'delete'), deleteUserTypeController);

module.exports = router;
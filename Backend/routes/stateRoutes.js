const express = require('express');
const {
    addStateController,
    getAllStatesController,
    updateStateController,
    deleteStateController
} = require('../controllers/stateController.js');
const { verifyToken, verifyPermission } = require('../middleware/authMiddleware.js');

const router = express.Router();

router.post('/add', verifyToken, verifyPermission('state_master', 'write'), addStateController);
router.get('/all', verifyToken, verifyPermission('state_master', 'read'), getAllStatesController);
router.put('/update/:id', verifyToken, verifyPermission('state_master', 'update'), updateStateController);
router.delete('/delete/:id', verifyToken, verifyPermission('state_master', 'delete'), deleteStateController);

module.exports = router;

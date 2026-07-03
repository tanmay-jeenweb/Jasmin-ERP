const express = require('express');
const {
    addFinanceMachineController,
    getAllFinanceMachinesController,
    updateFinanceMachineController,
    deleteFinanceMachineController
} = require('../controllers/financeMachineController.js');
const { verifyToken, verifyPermission } = require('../middleware/authMiddleware.js');

const router = express.Router();

router.post('/add', verifyToken, verifyPermission('finance_machine_master', 'write'), addFinanceMachineController);
router.get('/all', verifyToken, verifyPermission('finance_machine_master', 'read'), getAllFinanceMachinesController);
router.put('/update/:id', verifyToken, verifyPermission('finance_machine_master', 'update'), updateFinanceMachineController);
router.delete('/delete/:id', verifyToken, verifyPermission('finance_machine_master', 'delete'), deleteFinanceMachineController);

module.exports = router;

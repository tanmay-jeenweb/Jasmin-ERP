const express = require('express');
const {
    addBankController,
    getAllBanksController,
    updateBankController,
    deleteBankController
} = require('../controllers/bankController.js');
const { verifyToken, verifyPermission } = require('../middleware/authMiddleware.js');

const router = express.Router();

router.post('/add', verifyToken, verifyPermission('bank_master', 'write'), addBankController);
router.get('/all', verifyToken, verifyPermission('bank_master', 'read'), getAllBanksController);
router.put('/update/:id', verifyToken, verifyPermission('bank_master', 'update'), updateBankController);
router.delete('/delete/:id', verifyToken, verifyPermission('bank_master', 'delete'), deleteBankController);

module.exports = router;

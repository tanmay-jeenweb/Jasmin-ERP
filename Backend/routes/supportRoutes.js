const express = require('express');
const {
    addSupportController,
    getAllSupportsController,
    updateSupportController,
    deleteSupportController
} = require('../controllers/supportController.js');
const { verifyToken, verifyPermission } = require('../middleware/authMiddleware.js');

const router = express.Router();

router.post('/add', verifyToken, verifyPermission('support_master', 'write'), addSupportController);
router.get('/all', verifyToken, verifyPermission('support_master', 'read'), getAllSupportsController);
router.put('/update/:id', verifyToken, verifyPermission('support_master', 'update'), updateSupportController);
router.delete('/delete/:id', verifyToken, verifyPermission('support_master', 'delete'), deleteSupportController);

module.exports = router;

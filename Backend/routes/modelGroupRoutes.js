const express = require('express');
const {
    syncModelGroupsController,
    getAllModelGroupsController,
    deleteModelGroupController
} = require('../controllers/modelGroupController.js');
const { verifyToken, verifyPermission } = require('../middleware/authMiddleware.js');

const router = express.Router();

router.post('/sync', verifyToken, verifyPermission('model_group_master', 'write'), syncModelGroupsController);
router.get('/all', verifyToken, verifyPermission('model_group_master', 'read'), getAllModelGroupsController);
router.delete('/delete/:id', verifyToken, verifyPermission('model_group_master', 'delete'), deleteModelGroupController);

module.exports = router;

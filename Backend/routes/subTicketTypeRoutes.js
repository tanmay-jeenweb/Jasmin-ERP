const express = require('express');
const {
    addSubTicketTypeController,
    getAllSubTicketTypesController,
    getAssigneesController,
    updateSubTicketTypeController,
    deleteSubTicketTypeController
} = require('../controllers/subTicketTypeController.js');
const { verifyToken, verifyPermission } = require('../middleware/authMiddleware.js');

const router = express.Router();

router.post('/add', verifyToken, verifyPermission('sub_ticket_type_master', 'write'), addSubTicketTypeController);
router.get('/all', verifyToken, verifyPermission('sub_ticket_type_master', 'read'), getAllSubTicketTypesController);
router.get('/assignees', verifyToken, verifyPermission('sub_ticket_type_master', 'read'), getAssigneesController);
router.put('/update/:id', verifyToken, verifyPermission('sub_ticket_type_master', 'update'), updateSubTicketTypeController);
router.delete('/delete/:id', verifyToken, verifyPermission('sub_ticket_type_master', 'delete'), deleteSubTicketTypeController);

module.exports = router;

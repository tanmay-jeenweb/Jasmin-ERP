const express = require('express');
const {
    addTicketTypeController,
    getAllTicketTypesController,
    updateTicketTypeController,
    deleteTicketTypeController
} = require('../controllers/ticketTypeController.js');
const { verifyToken, verifyPermission } = require('../middleware/authMiddleware.js');

const router = express.Router();

router.post('/add', verifyToken, verifyPermission('ticket_type_master', 'write'), addTicketTypeController);
router.get('/all', verifyToken, verifyPermission('ticket_type_master', 'read'), getAllTicketTypesController);
router.put('/update/:id', verifyToken, verifyPermission('ticket_type_master', 'update'), updateTicketTypeController);
router.delete('/delete/:id', verifyToken, verifyPermission('ticket_type_master', 'delete'), deleteTicketTypeController);

module.exports = router;

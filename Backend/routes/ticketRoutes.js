const express = require('express');
const {
    createTicketController,
    getTicketsController,
    getTicketDetailsController,
    addRemarkController,
    shiftTicketController,
    completeTicketController,
    getTicketFormOptionsController,
    getTicketStatsController
} = require('../controllers/ticketController.js');
const { verifyToken } = require('../middleware/authMiddleware.js');
const upload = require('../middleware/uploadMiddleware.js');

const router = express.Router();

// Form options for dropdowns (Ticket types & subticket types)
router.get('/form-options', verifyToken, getTicketFormOptionsController);

// Ticket stats (active, history, assigned to me counts)
router.get('/stats', verifyToken, getTicketStatsController);

// Create ticket (with up to 5 images)
router.post('/add', verifyToken, upload.array('images', 5), createTicketController);

// List tickets (query param: ?tab=active or ?tab=history)
router.get('/list', verifyToken, getTicketsController);

// Get single ticket details and remarks thread
router.get('/details/:id', verifyToken, getTicketDetailsController);

// Add remark (resolver or admin)
router.post('/remark/:id', verifyToken, addRemarkController);

// Shift ticket (resolver/admin with ticket management permission)
router.put('/shift/:id', verifyToken, shiftTicketController);

// Complete ticket (resolver or admin)
router.put('/complete/:id', verifyToken, completeTicketController);

module.exports = router;

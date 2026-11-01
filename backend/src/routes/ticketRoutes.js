const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const { generateTicket, getTicketBySession } = require('../controllers/ticketController');

// POST /api/tickets/generate  (must be logged in)
router.post('/generate', requireAuth, generateTicket);

// GET /api/tickets/:session_id  (must be logged in)
router.get('/:session_id', requireAuth, getTicketBySession);

module.exports = router;

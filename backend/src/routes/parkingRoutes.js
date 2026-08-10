const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const { getAvailability, createSession, endSession } = require('../controllers/parkingController');

// GET /api/parking/availability - public, anyone can check availability
router.get('/availability', getAvailability);

// POST /api/parking/session/start - must be logged in
router.post('/session/start', requireAuth, createSession);

// POST /api/parking/session/end - must be logged in
router.post('/session/end', requireAuth, endSession);

module.exports = router;

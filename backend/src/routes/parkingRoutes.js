const express = require('express');
const router = express.Router();
const { getAvailability, createSession, endSession } = require('../controllers/parkingController');

// GET /api/parking/availability
router.get('/availability', getAvailability);

// POST /api/parking/session/start
router.post('/session/start', createSession);

// POST /api/parking/session/end
router.post('/session/end', endSession);

module.exports = router;

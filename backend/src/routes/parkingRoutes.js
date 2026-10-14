const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const {
  getAvailability,
  createSession,
  endSession,
  getActiveSessionForUser,
  getSessionHistory,
} = require('../controllers/parkingController');

// GET /api/parking/availability - public
router.get('/availability', getAvailability);

// POST /api/parking/session/start - requires auth
router.post('/session/start', requireAuth, createSession);

// POST /api/parking/session/end - requires auth
router.post('/session/end', requireAuth, endSession);

// GET /api/parking/session/active/:user_id - requires auth
router.get('/session/active/:user_id', requireAuth, getActiveSessionForUser);

// GET /api/parking/history/:user_id - requires auth
router.get('/history/:user_id', requireAuth, getSessionHistory);

module.exports = router;

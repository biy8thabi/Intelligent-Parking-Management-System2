const express = require('express');
const router = express.Router();
const { requireAuth, requireSelf } = require('../middleware/authMiddleware');
const {
  getAvailability,
  createSession,
  endSession,
  cancelSession,
  getActiveSessionForUser,
  getSessionHistory,
} = require('../controllers/parkingController');

// GET /api/parking/availability - public
router.get('/availability', getAvailability);

// POST /api/parking/session/start - logged in; body user_id must be yours
router.post('/session/start', requireAuth, createSession);

// POST /api/parking/session/end - logged in; session must be yours
router.post('/session/end', requireAuth, endSession);

// POST /api/parking/session/cancel - logged in; session must be yours
router.post('/session/cancel', requireAuth, cancelSession);

// GET /api/parking/session/active/:user_id - must be your own id (or admin)
router.get('/session/active/:user_id', requireSelf('user_id'), getActiveSessionForUser);

// GET /api/parking/history/:user_id - must be your own id (or admin)
router.get('/history/:user_id', requireSelf('user_id'), getSessionHistory);

module.exports = router;
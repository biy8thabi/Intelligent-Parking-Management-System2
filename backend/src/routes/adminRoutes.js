const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/authMiddleware');
const { getActiveSessions, forceEndSession } = require('../controllers/adminController');

// GET /api/admin/sessions/active - admins only
router.get('/sessions/active', requireAdmin, getActiveSessions);

// POST /api/admin/sessions/:id/force-end - admins only
router.post('/sessions/:id/force-end', requireAdmin, forceEndSession);

module.exports = router;

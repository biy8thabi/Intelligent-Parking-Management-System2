const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/authMiddleware');
const { getActiveSessions, forceEndSession, getAllUsers } = require('../controllers/adminController');

// GET /api/admin/sessions/active - admins only
router.get('/sessions/active', requireAdmin, getActiveSessions);

// POST /api/admin/sessions/:id/force-end - admins only
router.post('/sessions/:id/force-end', requireAdmin, forceEndSession);

router.get('/users', requireAdmin, getAllUsers);

module.exports = router;

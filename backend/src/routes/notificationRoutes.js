const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const { getNotifications, markAsRead } = require('../controllers/notificationController');

// GET /api/notifications/:user_id  (must be logged in)
router.get('/:user_id', requireAuth, getNotifications);

// PATCH /api/notifications/:id/read  (must be logged in)
router.patch('/:id/read', requireAuth, markAsRead);

module.exports = router;

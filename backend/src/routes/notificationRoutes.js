const express = require('express');
const router = express.Router();
const { requireAuth, requireSelf } = require('../middleware/authMiddleware');
const { getNotifications, markAsRead } = require('../controllers/notificationController');

// GET /api/notifications/:user_id - must be your own id (or admin)
router.get('/:user_id', requireSelf('user_id'), getNotifications);

// PATCH /api/notifications/:id/read - checked against the notification's owner
router.patch('/:id/read', requireAuth, markAsRead);

module.exports = router;

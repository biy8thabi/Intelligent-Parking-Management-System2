const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const {
  registerUser,
  loginUser,
  loginAdmin,
  getProfile,
  forgotPassword,
  changePassword,
} = require('../controllers/authController');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/admin-login', loginAdmin);
router.post('/forgot-password', forgotPassword);

// GET /api/auth/me - requires auth
router.get('/me', requireAuth, getProfile);

// PUT /api/auth/change-password - requires auth
router.put('/change-password', requireAuth, changePassword);

module.exports = router;

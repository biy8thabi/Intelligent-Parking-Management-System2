   const express = require('express');
   const router = express.Router();
   const { requireAuth } = require('../middleware/authMiddleware');
   const { registerUser, loginUser, loginAdmin, getProfile } = require('../controllers/authController');

   router.post('/register', registerUser);
   router.post('/login', loginUser);
   router.post('/admin-login', loginAdmin);
   router.get('/me', requireAuth, getProfile);

   module.exports = router;
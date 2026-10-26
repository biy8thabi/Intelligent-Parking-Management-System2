```javascript
const express = require('express');
const router = express.Router();

const {
  requireAuth
} = require('../middleware/authMiddleware');

const {
  registerUser,
  loginUser,
  loginAdmin,
  getProfile,
  resetAdminPassword
} = require('../controllers/authController');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/admin-login', loginAdmin);

// TEMPORARY: Remove immediately after resetting the admin password.
router.post('/admin-reset', resetAdminPassword);

router.get('/me', requireAuth, getProfile);

module.exports = router;
```

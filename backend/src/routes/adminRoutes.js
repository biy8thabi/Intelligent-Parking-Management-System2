const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/authMiddleware');
const { getActiveSessions, forceEndSession, getAllUsers } = require('../controllers/adminController');
const { listVehicles, createVehicle, updateVehicle, deleteVehicle } = require('../controllers/vehicleController');

// Sessions and drivers
router.get('/sessions/active', requireAdmin, getActiveSessions);
router.post('/sessions/:id/force-end', requireAdmin, forceEndSession);
router.get('/users', requireAdmin, getAllUsers);

// Vehicle register
router.get('/vehicles', requireAdmin, listVehicles);
router.post('/vehicles', requireAdmin, createVehicle);
router.put('/vehicles/:id', requireAdmin, updateVehicle);
router.delete('/vehicles/:id', requireAdmin, deleteVehicle);

module.exports = router;

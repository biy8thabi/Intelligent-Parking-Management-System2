const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/authMiddleware');
const {
  getActiveSessions,
  forceEndSession,
  getAllUsers,
  getAllSessions,
  getAllParkingSpaces,
  getAllTickets,
} = require('../controllers/adminController');
const {
  listVehicles,
  createVehicle,
  updateVehicle,
  deleteVehicle,
} = require('../controllers/vehicleController');

// Sessions and drivers
router.get('/sessions/active', requireAdmin, getActiveSessions);
router.post('/sessions/:id/force-end', requireAdmin, forceEndSession);
router.get('/users', requireAdmin, getAllUsers);

// Vehicle CRUD
router.get('/vehicles', requireAdmin, listVehicles);
router.post('/vehicles', requireAdmin, createVehicle);
router.put('/vehicles/:id', requireAdmin, updateVehicle);
router.delete('/vehicles/:id', requireAdmin, deleteVehicle);

// Admin website data — Revenue, Payments, Vehicles, Slots, Lots, Tickets
router.get('/sessions', requireAdmin, getAllSessions);
router.get('/parking-spaces', requireAdmin, getAllParkingSpaces);
router.get('/tickets', requireAdmin, getAllTickets);

module.exports = router;
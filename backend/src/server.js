require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

// Basic health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'IPMS backend is running' });
});

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/parking', require('./routes/parkingRoutes'));
app.use('/api/tickets', require('./routes/ticketRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`IPMS backend listening on port ${PORT}`);
});

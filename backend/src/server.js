require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

// Basic health check - useful for confirming the server is alive,
// and for your Network Engineers when they set up hosting/monitoring.
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'IPMS backend is running' });
});

// Route mounting will go here as you build them in Week 2, e.g.:
// app.use('/api/auth', require('./routes/authRoutes'));
// app.use('/api/parking', require('./routes/parkingRoutes'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`IPMS backend listening on port ${PORT}`);
});

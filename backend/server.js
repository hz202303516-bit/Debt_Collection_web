const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Import routes - adjust paths based on where this file is
const authRoutes = require('./backend/routes/auth');
const userRoutes = require('./backend/routes/users');
const borrowerRoutes = require('./backend/routes/borrowers');
const loanRoutes = require('./backend/routes/loans');
const paymentRoutes = require('./backend/routes/payments');
const gpsRoutes = require('./backend/routes/gps');
const reportsRoutes = require('./backend/routes/reports');
const adminRoutes = require('./backend/routes/admin');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/borrowers', borrowerRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/gps', gpsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/admin', adminRoutes);

// Serve frontend build
app.use(express.static(path.join(__dirname, 'frontend/build')));
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend/build', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
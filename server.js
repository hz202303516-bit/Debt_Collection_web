const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./auth');
const userRoutes = require('./users');
const borrowerRoutes = require('./borrowers');
const loanRoutes = require('./loans');
const paymentRoutes = require('./payments');
const gpsRoutes = require('./gps');
const reportsRoutes = require('./reports');
const adminRoutes = require('./admin');

const app = express();
const PORT = process.env.PORT || 5000;

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

// Serve static files from React build
app.use(express.static(path.join(__dirname, 'frontend', 'build')));

// Handle React routing - all non-API routes go to React
/*app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'build', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); */
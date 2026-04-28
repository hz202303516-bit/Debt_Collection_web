// Add this to your backend routes for getting users by role
// backend/routes/users.js

const express = require('express');
const { authenticateToken, authorizeRoles } = require('./middleware/auth');
const pool = require('./config/database');

const router = express.Router();

// Get users by role
router.get('/', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    try {
        const { role } = req.query;
        let query = 'SELECT user_id, name, email, role FROM users';
        let params = [];

        if (role) {
            query += ' WHERE role = $1';
            params.push(role);
        }

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
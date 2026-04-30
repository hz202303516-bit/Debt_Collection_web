const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

// Middleware (in same file - NO duplicate!)
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access denied' });
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-in-production');
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};

const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!req.user) return res.status(401).json({ error: 'Authentication required' });
        if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Access denied' });
        next();
    };
};

// Get all loans
router.get('/', authenticateToken, async (req, res) => {
    try {
        let query = `SELECT l.*, b.full_name as borrower_name, u.name as collector_name
                     FROM loans l JOIN borrowers b ON l.borrower_id = b.borrower_id
                     LEFT JOIN users u ON b.collector_id = u.user_id WHERE 1=1`;
        const params = [];
        if (req.user.role === 'borrower') {
            query += ' AND b.user_id = $1';
            params.push(req.user.userId);
        } else if (req.user.role === 'collector') {
            query += ' AND b.collector_id = $1';
            params.push(req.user.userId);
        }
        query += ' ORDER BY l.created_at DESC';
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch loans' });
    }
});

// Create loan (admin only)
router.post('/', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    try {
        const { borrower_id, loan_amount, interest_rate, due_date } = req.body;
        if (!borrower_id || !loan_amount || !interest_rate || !due_date) {
            return res.status(400).json({ error: 'All fields required' });
        }
        const result = await pool.query(
            `INSERT INTO loans (borrower_id, loan_amount, interest_rate, due_date, balance, status)
             VALUES ($1, $2, $3, $4, $2, 'active') RETURNING *`,
            [borrower_id, loan_amount, interest_rate, due_date]
        );
        res.status(201).json({ message: 'Loan created', loan: result.rows[0] });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create loan' });
    }
});

module.exports = router;

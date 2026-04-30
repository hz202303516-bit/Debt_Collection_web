const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access denied' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-in-production');
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
};

// Get all payments
router.get('/', authenticateToken, async (req, res) => {
    try {
        let query = `
            SELECT p.*, l.loan_amount, b.full_name as borrower_name, u.name as collector_name
            FROM payments p
            JOIN loans l ON p.loan_id = l.loan_id
            JOIN borrowers b ON l.borrower_id = b.borrower_id
            LEFT JOIN users u ON p.collector_id = u.user_id
        `;
        const params = [];

        if (req.user.role === 'borrower') {
            query += ' WHERE b.user_id = $1';
            params.push(req.user.userId);
        } else if (req.user.role === 'collector') {
            query += ' WHERE p.collector_id = $1';
            params.push(req.user.userId);
        }

        query += ' ORDER BY p.payment_date DESC';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching payments:', error.message);
        res.status(500).json({ error: 'Failed to fetch payments' });
    }
});

// Record payment
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { loan_id, amount, gps_latitude, gps_longitude } = req.body;

        if (!loan_id || !amount) {
            return res.status(400).json({ error: 'Loan ID and amount are required' });
        }

        // Verify loan exists and get borrower
        const loanResult = await pool.query(
            `SELECT l.*, b.borrower_id FROM loans l 
             JOIN borrowers b ON l.borrower_id = b.borrower_id 
             WHERE l.loan_id = $1`,
            [loan_id]
        );

        if (loanResult.rows.length === 0) {
            return res.status(404).json({ error: 'Loan not found' });
        }

        const loan = loanResult.rows[0];

        // Generate receipt number
        const receiptNumber = 'RCP-' + Date.now() + '-' + Math.floor(Math.random() * 1000);

        // Record payment
        const result = await pool.query(
            `INSERT INTO payments (loan_id, collector_id, amount, gps_latitude, gps_longitude, receipt_number)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [loan_id, req.user.userId, amount, gps_latitude || null, gps_longitude || null, receiptNumber]
        );

        // Update loan balance
        const newBalance = parseFloat(loan.balance) - parseFloat(amount);
        const newStatus = newBalance <= 0 ? 'paid' : 'active';

        await pool.query(
            `UPDATE loans SET balance = $1, status = $2, updated_at = CURRENT_TIMESTAMP 
             WHERE loan_id = $3`,
            [newBalance, newStatus, loan_id]
        );

        // Log GPS if provided
        if (gps_latitude && gps_longitude) {
            await pool.query(
                `INSERT INTO gps_logs (collector_id, borrower_id, latitude, longitude)
                 VALUES ($1, $2, $3, $4)`,
                [req.user.userId, loan.borrower_id, gps_latitude, gps_longitude]
            );
        }

        res.status(201).json({
            message: 'Payment recorded successfully',
            payment: result.rows[0],
            newBalance,
            receiptNumber
        });
    } catch (error) {
        console.error('Error recording payment:', error.message);
        res.status(500).json({ error: 'Failed to record payment' });
    }
});

module.exports = router;

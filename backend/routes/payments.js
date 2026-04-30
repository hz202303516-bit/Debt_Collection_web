const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Get all payments
router.get('/', authenticateToken, async (req, res) => {
    try {
        let query = `
            SELECT p.*, 
                   l.loan_amount,
                   l.balance as loan_balance,
                   b.full_name as borrower_name,
                   u.name as collector_name
            FROM payments p
            JOIN loans l ON p.loan_id = l.loan_id
            JOIN borrowers b ON l.borrower_id = b.borrower_id
            LEFT JOIN users u ON p.collector_id = u.user_id
            WHERE 1=1
        `;
        const params = [];

        if (req.user.role === 'borrower') {
            query += ' AND b.user_id = $' + (params.length + 1);
            params.push(req.user.userId);
        } else if (req.user.role === 'collector') {
            query += ' AND p.collector_id = $' + (params.length + 1);
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

        // Verify loan exists and is active
        const loanResult = await pool.query(
            `SELECT l.*, b.borrower_id, b.full_name 
             FROM loans l 
             JOIN borrowers b ON l.borrower_id = b.borrower_id 
             WHERE l.loan_id = $1`,
            [loan_id]
        );

        if (loanResult.rows.length === 0) {
            return res.status(404).json({ error: 'Loan not found' });
        }

        const loan = loanResult.rows[0];

        if (loan.status === 'paid') {
            return res.status(400).json({ error: 'Loan already fully paid' });
        }

        // Check if payment amount exceeds balance
        if (parseFloat(amount) > parseFloat(loan.balance)) {
            return res.status(400).json({ 
                error: `Payment amount exceeds remaining balance of ₱${parseFloat(loan.balance).toFixed(2)}` 
            });
        }

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
            [newBalance.toFixed(2), newStatus, loan_id]
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
            newBalance: newBalance.toFixed(2),
            receiptNumber
        });
    } catch (error) {
        console.error('Error recording payment:', error.message);
        res.status(500).json({ error: 'Failed to record payment' });
    }
});

// Get payments by loan ID
router.get('/loan/:loanId', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT p.*, u.name as collector_name
             FROM payments p
             LEFT JOIN users u ON p.collector_id = u.user_id
             WHERE p.loan_id = $1
             ORDER BY p.payment_date DESC`,
            [req.params.loanId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching loan payments:', error.message);
        res.status(500).json({ error: 'Failed to fetch loan payments' });
    }
});

module.exports = router;

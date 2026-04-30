const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Get all loans
router.get('/', authenticateToken, async (req, res) => {
    try {
        let query = `
            SELECT l.*, 
                   b.full_name as borrower_name, 
                   b.address as borrower_address,
                   u.name as collector_name
            FROM loans l
            JOIN borrowers b ON l.borrower_id = b.borrower_id
            LEFT JOIN users u ON b.collector_id = u.user_id
            WHERE 1=1
        `;
        const params = [];

        // Filter by role
        if (req.user.role === 'borrower') {
            query += ' AND b.user_id = $' + (params.length + 1);
            params.push(req.user.userId);
        } else if (req.user.role === 'collector') {
            query += ' AND b.collector_id = $' + (params.length + 1);
            params.push(req.user.userId);
        }

        query += ' ORDER BY l.created_at DESC';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching loans:', error.message);
        res.status(500).json({ error: 'Failed to fetch loans' });
    }
});

// Create new loan (admin only)
router.post('/', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    try {
        const { borrower_id, loan_amount, interest_rate, due_date } = req.body;

        // Validate required fields
        if (!borrower_id || !loan_amount || !interest_rate || !due_date) {
            return res.status(400).json({ error: 'All fields are required: borrower_id, loan_amount, interest_rate, due_date' });
        }

        // Verify borrower exists
        const borrowerCheck = await pool.query(
            'SELECT * FROM borrowers WHERE borrower_id = $1',
            [borrower_id]
        );

        if (borrowerCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Borrower not found' });
        }

        // Create loan
        const result = await pool.query(
            `INSERT INTO loans (borrower_id, loan_amount, interest_rate, due_date, balance, status)
             VALUES ($1, $2, $3, $4, $2, 'active')
             RETURNING *`,
            [borrower_id, loan_amount, interest_rate, due_date]
        );

        res.status(201).json({
            message: 'Loan created successfully',
            loan: result.rows[0]
        });
    } catch (error) {
        console.error('Error creating loan:', error.message);
        res.status(500).json({ error: 'Failed to create loan' });
    }
});

// Update loan status
router.put('/:id/status', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const validStatuses = ['active', 'paid', 'defaulted', 'pending'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status. Must be: ' + validStatuses.join(', ') });
        }

        const result = await pool.query(
            `UPDATE loans SET status = $1, updated_at = CURRENT_TIMESTAMP 
             WHERE loan_id = $2 RETURNING *`,
            [status, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Loan not found' });
        }

        res.json({ message: 'Loan updated', loan: result.rows[0] });
    } catch (error) {
        console.error('Error updating loan:', error.message);
        res.status(500).json({ error: 'Failed to update loan' });
    }
});

// Get single loan
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT l.*, 
                    b.full_name as borrower_name, 
                    b.address as borrower_address,
                    b.phone as borrower_phone,
                    u.name as collector_name
             FROM loans l
             JOIN borrowers b ON l.borrower_id = b.borrower_id
             LEFT JOIN users u ON b.collector_id = u.user_id
             WHERE l.loan_id = $1`,
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Loan not found' });
        }

        // Get payment history for this loan
        const payments = await pool.query(
            `SELECT p.*, u.name as collector_name
             FROM payments p
             LEFT JOIN users u ON p.collector_id = u.user_id
             WHERE p.loan_id = $1
             ORDER BY p.payment_date DESC`,
            [req.params.id]
        );

        res.json({
            ...result.rows[0],
            payments: payments.rows
        });
    } catch (error) {
        console.error('Error fetching loan:', error.message);
        res.status(500).json({ error: 'Failed to fetch loan' });
    }
});

module.exports = router;

const express = require('express');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const pool = require('../config/database');

const router = express.Router();

// Get all loans
router.get('/', authenticateToken, async (req, res) => {
    try {
        let query;
        let params = [];
        
        if (req.user.role === 'admin') {
            query = `
                SELECT l.*, b.full_name as borrower_name, u.name as collector_name
                FROM loans l
                JOIN borrowers b ON l.borrower_id = b.borrower_id
                LEFT JOIN users u ON b.collector_id = u.user_id
                ORDER BY l.created_at DESC
            `;
        } else if (req.user.role === 'collector') {
            // Get loans for borrowers assigned to this collector
            query = `
                SELECT l.*, b.full_name as borrower_name
                FROM loans l
                JOIN borrowers b ON l.borrower_id = b.borrower_id
                WHERE b.collector_id = $1
                ORDER BY l.created_at DESC
            `;
            params = [req.user.user_id];
        } else if (req.user.role === 'borrower') {
            query = `
                SELECT l.*, b.full_name as borrower_name
                FROM loans l
                JOIN borrowers b ON l.borrower_id = b.borrower_id
                WHERE b.user_id = $1
                ORDER BY l.created_at DESC
            `;
            params = [req.user.user_id];
        }
        
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Debug: Get all loans with borrower info (admin only)
router.get('/debug', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT l.*, b.full_name as borrower_name, b.user_id as borrower_user_id,
                   u.name as collector_name, b.collector_id
            FROM loans l
            JOIN borrowers b ON l.borrower_id = b.borrower_id
            LEFT JOIN users u ON b.collector_id = u.user_id
            ORDER BY l.created_at DESC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Create loan (Admin)
// Create loan (Admin only)
router.post('/', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    try {
        const { borrower_id, loan_amount, interest_rate, due_date } = req.body;

        // Validate required fields
        if (!borrower_id || !loan_amount || !interest_rate || !due_date) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Validate borrower exists
        const borrowerCheck = await pool.query(
            'SELECT * FROM borrowers WHERE borrower_id = $1',
            [borrower_id]
        );

        if (borrowerCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Borrower not found' });
        }

        // Check if borrower has any active loans
        const activeLoanCheck = await pool.query(
            "SELECT * FROM loans WHERE borrower_id = $1 AND status = 'active'",
            [borrower_id]
        );

        // You can uncomment this if you want to prevent multiple active loans
        // if (activeLoanCheck.rows.length > 0) {
        //     return res.status(400).json({ error: 'Borrower already has an active loan' });
        // }

        const balance = loan_amount; // Initial balance equals loan amount
        
        const result = await pool.query(
            `INSERT INTO loans (borrower_id, loan_amount, interest_rate, due_date, balance, status) 
             VALUES ($1, $2, $3, $4, $5, 'active') 
             RETURNING *`,
            [borrower_id, loan_amount, interest_rate, due_date, balance]
        );

        // Get borrower name for response
        const borrowerInfo = await pool.query(
            `SELECT u.name FROM borrowers b JOIN users u ON b.user_id = u.user_id WHERE b.borrower_id = $1`,
            [borrower_id]
        );

        res.status(201).json({
            message: 'Loan created successfully',
            loan: {
                ...result.rows[0],
                borrower_name: borrowerInfo.rows[0]?.name || 'Unknown'
            }
        });

    } catch (error) {
        console.error('Error creating loan:', error);
        res.status(500).json({ error: 'Failed to create loan. ' + error.message });
    }
});

// Get loan status for borrower
router.get('/status', authenticateToken, authorizeRoles('borrower'), async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT l.*, 
                   COALESCE(SUM(p.amount), 0) as total_paid,
                   l.loan_amount - COALESCE(SUM(p.amount), 0) as outstanding_balance
            FROM loans l
            JOIN borrowers b ON l.borrower_id = b.borrower_id
            LEFT JOIN payments p ON l.loan_id = p.loan_id
            WHERE b.user_id = $1
            GROUP BY l.loan_id
            ORDER BY l.created_at DESC
        `, [req.user.user_id]);
        
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// AI/ML: Predict loan default (simple risk scoring)
router.get('/predict-default/:loan_id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    try {
        const { loan_id } = req.params;
        
        const result = await pool.query(`
            SELECT 
                l.*,
                b.full_name,
                COUNT(p.payment_id) as payment_count,
                COALESCE(SUM(p.amount), 0) as total_paid,
                EXTRACT(DAY FROM (CURRENT_DATE - l.due_date)) as days_overdue
            FROM loans l
            JOIN borrowers b ON l.borrower_id = b.borrower_id
            LEFT JOIN payments p ON l.loan_id = p.loan_id
            WHERE l.loan_id = $1
            GROUP BY l.loan_id, b.full_name
        `, [loan_id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Loan not found' });
        }
        
        const loan = result.rows[0];
        
        // Simple risk calculation
        let riskScore = 0;
        
        if (loan.days_overdue > 0) riskScore += 30;
        if (loan.days_overdue > 30) riskScore += 30;
        if (loan.total_paid === 0) riskScore += 20;
        if (loan.balance / loan.loan_amount > 0.8) riskScore += 20;
        
        const prediction = {
            loan_id: loan.loan_id,
            borrower: loan.full_name,
            risk_score: riskScore,
            risk_level: riskScore > 70 ? 'HIGH' : riskScore > 40 ? 'MEDIUM' : 'LOW',
            days_overdue: loan.days_overdue,
            balance: loan.balance,
            recommendation: riskScore > 70 ? 'Immediate action required' : 
                           riskScore > 40 ? 'Monitor closely' : 'Low risk'
        };
        
        res.json(prediction);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
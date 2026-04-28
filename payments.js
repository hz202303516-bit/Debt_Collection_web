const express = require('express');
const { authenticateToken, authorizeRoles } = require('./middleware/auth');
const pool = require('./database');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Record payment (Collector)
router.post('/', authenticateToken, authorizeRoles('collector'), async (req, res) => {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        const { loan_id, amount, latitude, longitude } = req.body;
        
        // Validate loan exists and get balance
        const loanResult = await client.query(
            'SELECT * FROM loans WHERE loan_id = $1',
            [loan_id]
        );
        
        if (loanResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Loan not found' });
        }
        
        const loan = loanResult.rows[0];
        
        if (amount > loan.balance) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Payment amount exceeds loan balance' });
        }
        
        // Generate receipt number
        const receipt_number = `RCT-${Date.now()}-${uuidv4().slice(0, 8)}`;
        
        // Insert payment
        const paymentResult = await client.query(
            `INSERT INTO payments (loan_id, collector_id, amount, gps_latitude, gps_longitude, receipt_number) 
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [loan_id, req.user.user_id, amount, latitude, longitude, receipt_number]
        );
        
        // Update loan balance
        const newBalance = loan.balance - amount;
        await client.query(
            'UPDATE loans SET balance = $1, updated_at = CURRENT_TIMESTAMP WHERE loan_id = $2',
            [newBalance, loan_id]
        );
        
        // Update loan status if paid in full
        if (newBalance <= 0) {
            await client.query(
                "UPDATE loans SET status = 'paid', updated_at = CURRENT_TIMESTAMP WHERE loan_id = $1",
                [loan_id]
            );
        }
        
        // Save GPS location only if valid coordinates provided
        if (latitude != null && longitude != null && 
            typeof latitude === 'number' && typeof longitude === 'number') {
            const borrowerResult = await client.query(
                'SELECT borrower_id FROM loans WHERE loan_id = $1',
                [loan_id]
            );
            
            if (borrowerResult.rows.length > 0) {
                await client.query(
                    `INSERT INTO gps_logs (collector_id, borrower_id, latitude, longitude) 
                     VALUES ($1, $2, $3, $4)`,
                    [req.user.user_id, borrowerResult.rows[0].borrower_id, latitude, longitude]
                );
            }
        }
        
        await client.query('COMMIT');
        
        res.status(201).json({
            ...paymentResult.rows[0],
            receipt_number,
            new_balance: newBalance
        });
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    } finally {
        client.release();
    }
});

// Get payment history
router.get('/', authenticateToken, async (req, res) => {
    try {
        let query;
        let params = [];
        
        if (req.user.role === 'admin') {
            query = `
                SELECT p.*, u.name as collector_name, l.loan_amount, l.balance as remaining_balance
                FROM payments p
                JOIN users u ON p.collector_id = u.user_id
                JOIN loans l ON p.loan_id = l.loan_id
                ORDER BY p.payment_date DESC
            `;
        } else if (req.user.role === 'collector') {
            query = `
                SELECT p.*, l.loan_amount, l.balance as remaining_balance
                FROM payments p
                JOIN loans l ON p.loan_id = l.loan_id
                WHERE p.collector_id = $1
                ORDER BY p.payment_date DESC
            `;
            params = [req.user.user_id];
        } else if (req.user.role === 'borrower') {
            query = `
                SELECT p.*, l.loan_amount, l.balance as remaining_balance
                FROM payments p
                JOIN loans l ON p.loan_id = l.loan_id
                JOIN borrowers b ON l.borrower_id = b.borrower_id
                WHERE b.user_id = $1
                ORDER BY p.payment_date DESC
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

module.exports = router;
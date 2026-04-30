const express = require('express');
const router = express.Router();
const axios = require('axios');
const pool = require('../config/database');
const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access denied' });
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-in-production');
        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
};

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5001';

// Get risk assessment for a borrower
router.get('/risk-assessment/:borrowerId', authenticateToken, async (req, res) => {
    try {
        const { borrowerId } = req.params;

        // Get borrower data
        const borrowerResult = await pool.query(
            'SELECT * FROM borrowers WHERE borrower_id = $1',
            [borrowerId]
        );

        if (borrowerResult.rows.length === 0) {
            return res.status(404).json({ error: 'Borrower not found' });
        }

        const borrower = borrowerResult.rows[0];

        // Get loan history
        const loansResult = await pool.query(
            'SELECT * FROM loans WHERE borrower_id = $1',
            [borrowerId]
        );

        // Get payment history
        const paymentsResult = await pool.query(`
            SELECT p.* FROM payments p
            JOIN loans l ON p.loan_id = l.loan_id
            WHERE l.borrower_id = $1
        `, [borrowerId]);

        // Call ML service for risk prediction
        try {
            const mlResponse = await axios.post(`${ML_SERVICE_URL}/predict-risk`, {
                borrower: {
                    total_loans: loansResult.rows.length,
                    active_loans: loansResult.rows.filter(l => l.status === 'active').length,
                    total_payments: paymentsResult.rows.length,
                    total_paid: paymentsResult.rows.reduce((sum, p) => sum + parseFloat(p.amount), 0),
                    total_loan_amount: loansResult.rows.reduce((sum, l) => sum + parseFloat(l.loan_amount), 0),
                    on_time_payments: paymentsResult.rows.filter(p => {
                        const paymentDate = new Date(p.payment_date);
                        const dueDate = loansResult.rows.find(l => l.loan_id === p.loan_id)?.due_date;
                        return dueDate && paymentDate <= new Date(dueDate);
                    }).length
                }
            });

            // Store assessment in database
            await pool.query(`
                INSERT INTO risk_assessments (borrower_id, risk_score, risk_level, factors)
                VALUES ($1, $2, $3, $4)
            `, [
                borrowerId,
                mlResponse.data.risk_score,
                mlResponse.data.risk_level,
                JSON.stringify(mlResponse.data.factors || {})
            ]);

            res.json({
                borrower: borrower.full_name,
                ...mlResponse.data,
                loan_summary: {
                    total_loans: loansResult.rows.length,
                    active_loans: loansResult.rows.filter(l => l.status === 'active').length,
                    total_paid: paymentsResult.rows.reduce((sum, p) => sum + parseFloat(p.amount), 0)
                }
            });
        } catch (mlError) {
            console.error('ML service error:', mlError.message);
            // Fallback if ML service is down
            res.json({
                borrower: borrower.full_name,
                risk_score: 50,
                risk_level: 'medium',
                note: 'ML service unavailable, using default assessment',
                loan_summary: {
                    total_loans: loansResult.rows.length,
                    active_loans: loansResult.rows.filter(l => l.status === 'active').length
                }
            });
        }
    } catch (error) {
        console.error('Risk assessment error:', error.message);
        res.status(500).json({ error: 'Failed to get risk assessment' });
    }
});

// Get borrower risk from ML model
router.post('/predict', authenticateToken, async (req, res) => {
    try {
        const response = await axios.post(`${ML_SERVICE_URL}/predict`, req.body);
        res.json(response.data);
    } catch (error) {
        console.error('ML prediction error:', error.message);
        res.status(500).json({ error: 'ML prediction failed' });
    }
});

module.exports = router;

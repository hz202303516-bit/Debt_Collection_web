const express = require('express');
const { authenticateToken, authorizeRoles } = require('./middleware/auth');
const pool = require('./config/database');

const router = express.Router();

// Collection summary report
router.get('/collection-summary', authenticateToken, async (req, res) => {
    try {
        let query;
        let params = [];
        
        if (req.user.role === 'admin') {
            query = `
                SELECT 
                    u.name as collector_name,
                    COUNT(p.payment_id) as total_collections,
                    COALESCE(SUM(p.amount), 0) as total_amount,
                    COUNT(DISTINCT l.borrower_id) as unique_borrowers
                FROM users u
                LEFT JOIN payments p ON u.user_id = p.collector_id
                LEFT JOIN loans l ON p.loan_id = l.loan_id
                WHERE u.role = 'collector'
                GROUP BY u.user_id, u.name
                ORDER BY total_amount DESC
            `;
        } else if (req.user.role === 'collector') {
            query = `
                SELECT 
                    DATE(p.payment_date) as date,
                    COUNT(p.payment_id) as collections,
                    SUM(p.amount) as total_amount
                FROM payments p
                WHERE p.collector_id = $1
                GROUP BY DATE(p.payment_date)
                ORDER BY date DESC
                LIMIT 30
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

// Overdue loans report
router.get('/overdue', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                l.*,
                b.full_name as borrower_name,
                u.name as collector_name,
                EXTRACT(DAY FROM (CURRENT_DATE - l.due_date)) as days_overdue
            FROM loans l
            JOIN borrowers b ON l.borrower_id = b.borrower_id
            LEFT JOIN users u ON b.collector_id = u.user_id
            WHERE l.status = 'active' 
            AND l.due_date < CURRENT_DATE
            ORDER BY days_overdue DESC
        `);
        
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
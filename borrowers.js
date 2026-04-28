const express = require('express');
const { authenticateToken, authorizeRoles } = require('./middleware/auth');
const pool = require('./database');

const router = express.Router();

// Get all borrowers (Admin and Collectors)
router.get('/', authenticateToken, authorizeRoles('admin', 'collector'), async (req, res) => {
    try {
        let query;
        let params = [];

        if (req.user.role === 'collector') {
            query = `
                SELECT b.*, u.name as collector_name 
                FROM borrowers b
                JOIN users u ON b.collector_id = u.user_id
                WHERE b.collector_id = $1
            `;
            params = [req.user.user_id];
        } else {
            query = `
                SELECT b.*, u.name as collector_name 
                FROM borrowers b
                LEFT JOIN users u ON b.collector_id = u.user_id
            `;
        }

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Add borrower (Admin only)
router.post('/', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    try {
        const { user_id, full_name, address, phone, collector_id } = req.body;

        const result = await pool.query(
            `INSERT INTO borrowers (user_id, full_name, address, phone, collector_id) 
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [user_id, full_name, address, phone, collector_id]
        );

        // Create collection assignment
        await pool.query(
            `INSERT INTO collection_assignments (admin_id, collector_id, borrower_id) 
             VALUES ($1, $2, $3)`,
            [req.user.user_id, collector_id, result.rows[0].borrower_id]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get borrower's assigned collectors (for admin and collector view)
router.get('/assigned', authenticateToken, authorizeRoles('admin', 'collector'), async (req, res) => {
    try {
        let query;
        let params = [];

        if (req.user.role === 'collector') {
            query = `
                SELECT b.*, u.name as borrower_name, u.email as borrower_email
                FROM collection_assignments ca
                JOIN borrowers b ON ca.borrower_id = b.borrower_id
                JOIN users u ON b.user_id = u.user_id
                WHERE ca.collector_id = $1 AND ca.status = 'assigned'
            `;
            params = [req.user.user_id];
        } else {
            query = `
                SELECT b.*, u.name as borrower_name, c.name as collector_name
                FROM collection_assignments ca
                JOIN borrowers b ON ca.borrower_id = b.borrower_id
                JOIN users u ON b.user_id = u.user_id
                JOIN users c ON ca.collector_id = c.user_id
                WHERE ca.status = 'assigned'
            `;
        }

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching assigned:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Debug: Get all borrowers and assignments (for testing)
router.get('/debug', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    try {
        const borrowers = await pool.query(`
            SELECT b.*, u.name as user_name, u.email as user_email, 
                   c.name as collector_name
            FROM borrowers b
            LEFT JOIN users u ON b.user_id = u.user_id
            LEFT JOIN users c ON b.collector_id = c.user_id
        `);
        
        const assignments = await pool.query(`
            SELECT ca.*, u1.name as borrower_name, u2.name as collector_name
            FROM collection_assignments ca
            LEFT JOIN borrowers b ON ca.borrower_id = b.borrower_id
            LEFT JOIN users u1 ON b.user_id = u1.user_id
            LEFT JOIN users u2 ON ca.collector_id = u2.user_id
        `);
        
        res.json({
            borrowers: borrowers.rows,
            assignments: assignments.rows
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
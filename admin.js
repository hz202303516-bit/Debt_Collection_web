const express = require('express');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const pool = require('../config/database');

const router = express.Router();

router.use(authenticateToken);
router.use(authorizeRoles('admin'));

// Get all users (except admin)
router.get('/users', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                u.*,
                b.collector_id,
                c.name as assigned_collector,
                COALESCE(u.status, 'pending') as status,
                COALESCE(u.role, 'pending_user') as role
            FROM users u
            LEFT JOIN borrowers b ON u.user_id = b.user_id
            LEFT JOIN users c ON b.collector_id = c.user_id
            WHERE u.role != 'admin'
            ORDER BY u.created_at DESC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Approve user
router.put('/users/:userId/approve', async (req, res) => {
    try {
        const { userId } = req.params;
        await pool.query(
            `UPDATE users SET status = 'approved', updated_at = CURRENT_TIMESTAMP WHERE user_id = $1`,
            [userId]
        );
        res.json({ message: 'User approved successfully' });
    } catch (error) {
        console.error('Error approving user:', error);
        res.status(500).json({ error: 'Failed to approve user' });
    }
});

// Reject user
router.put('/users/:userId/reject', async (req, res) => {
    try {
        const { userId } = req.params;
        await pool.query(
            `UPDATE users SET status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE user_id = $1`,
            [userId]
        );
        res.json({ message: 'User rejected' });
    } catch (error) {
        console.error('Error rejecting user:', error);
        res.status(500).json({ error: 'Failed to reject user' });
    }
});

// Assign role to user
router.put('/users/:userId/assign-role', async (req, res) => {
    const client = await pool.connect();
    try {
        const { userId } = req.params;
        const { role } = req.body;

        if (!['borrower', 'collector'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role. Must be borrower or collector.' });
        }

        await client.query('BEGIN');

        // Update user role
        await client.query(
            `UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2`,
            [role, userId]
        );

        // If borrower, create borrower record
        if (role === 'borrower') {
            const userResult = await client.query(
                'SELECT * FROM users WHERE user_id = $1',
                [userId]
            );
            
            const existingBorrower = await client.query(
                'SELECT * FROM borrowers WHERE user_id = $1',
                [userId]
            );

            if (existingBorrower.rows.length === 0) {
                await client.query(
                    `INSERT INTO borrowers (user_id, full_name, address, phone) 
                     VALUES ($1, $2, $3, $4)`,
                    [userId, userResult.rows[0].name, userResult.rows[0].address, userResult.rows[0].phone]
                );
            }
        }

        await client.query('COMMIT');
        res.json({ message: `Role "${role}" assigned successfully` });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error assigning role:', error);
        res.status(500).json({ error: 'Failed to assign role' });
    } finally {
        client.release();
    }
});

// Assign collector to borrower
router.post('/assign-collector', async (req, res) => {
    try {
        const { borrower_user_id, collector_id } = req.body;

        // Get borrower record
        let borrowerResult = await pool.query(
            'SELECT borrower_id FROM borrowers WHERE user_id = $1',
            [borrower_user_id]
        );

        // Create borrower record if not exists
        if (borrowerResult.rows.length === 0) {
            const userResult = await pool.query(
                'SELECT * FROM users WHERE user_id = $1',
                [borrower_user_id]
            );
            borrowerResult = await pool.query(
                `INSERT INTO borrowers (user_id, full_name) 
                 VALUES ($1, $2) 
                 RETURNING borrower_id`,
                [borrower_user_id, userResult.rows[0].name]
            );
        }

        // Update borrower's collector
        await pool.query(
            'UPDATE borrowers SET collector_id = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2',
            [collector_id, borrower_user_id]
        );

        // Create assignment record
        await pool.query(
            `INSERT INTO collection_assignments (admin_id, collector_id, borrower_id) 
             VALUES ($1, $2, $3)`,
            [req.user.user_id, collector_id, borrowerResult.rows[0].borrower_id]
        );

        res.json({ message: 'Collector assigned successfully' });
    } catch (error) {
        console.error('Error assigning collector:', error);
        res.status(500).json({ error: 'Failed to assign collector' });
    }
});

// Get assignments
router.get('/assignments', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                ca.*,
                u1.name as borrower_name,
                u2.name as collector_name
            FROM collection_assignments ca
            JOIN borrowers b ON ca.borrower_id = b.borrower_id
            JOIN users u1 ON b.user_id = u1.user_id
            JOIN users u2 ON ca.collector_id = u2.user_id
            ORDER BY ca.assigned_date DESC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching assignments:', error);
        res.status(500).json({ error: 'Failed to fetch assignments' });
    }
});

// Get borrower details by user_id
router.get('/borrower-details/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Get borrower record using user_id
        const result = await pool.query(
            `SELECT b.*, u.name, u.email 
             FROM borrowers b 
             JOIN users u ON b.user_id = u.user_id 
             WHERE b.user_id = $1`,
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Borrower record not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching borrower details:', error);
        res.status(500).json({ error: 'Failed to fetch borrower details' });
    }
});

module.exports = router;
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Get all users (admin only)
router.get('/', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT user_id, name, email, role, status, phone, address, created_at FROM users ORDER BY created_at DESC'
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching users:', error.message);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Get single user
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        // Users can only see their own profile, admins can see any
        if (req.user.role !== 'admin' && req.user.userId != req.params.id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const result = await pool.query(
            'SELECT user_id, name, email, role, status, phone, address, created_at FROM users WHERE user_id = $1',
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching user:', error.message);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});

// Update user status (admin only)
router.put('/:id/status', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    try {
        const { status } = req.body;
        const userId = req.params.id;

        if (!['pending', 'approved', 'rejected'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status value' });
        }

        // If approving a pending_user, update their role to borrower
        let updateQuery = 'UPDATE users SET status = $1, updated_at = CURRENT_TIMESTAMP';
        const params = [status];

        if (status === 'approved') {
            const userResult = await pool.query('SELECT role FROM users WHERE user_id = $1', [userId]);
            if (userResult.rows.length > 0 && userResult.rows[0].role === 'pending_user') {
                updateQuery += ', role = $' + (params.length + 1);
                params.push('borrower');
            }
        }

        updateQuery += ' WHERE user_id = $' + (params.length + 1) + ' RETURNING user_id, name, email, role, status';
        params.push(userId);

        const result = await pool.query(updateQuery, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ message: 'User updated successfully', user: result.rows[0] });
    } catch (error) {
        console.error('Error updating user:', error.message);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// Delete user (admin only)
router.delete('/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    try {
        const result = await pool.query(
            'DELETE FROM users WHERE user_id = $1 RETURNING user_id',
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error.message);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

module.exports = router;const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Get all users (admin only)
router.get('/', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT user_id, name, email, role, status, phone, address, created_at FROM users ORDER BY created_at DESC'
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching users:', error.message);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Get single user
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        // Users can only see their own profile, admins can see any
        if (req.user.role !== 'admin' && req.user.userId != req.params.id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const result = await pool.query(
            'SELECT user_id, name, email, role, status, phone, address, created_at FROM users WHERE user_id = $1',
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching user:', error.message);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});

// Update user status (admin only)
router.put('/:id/status', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    try {
        const { status } = req.body;
        const userId = req.params.id;

        if (!['pending', 'approved', 'rejected'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status value' });
        }

        // If approving a pending_user, update their role to borrower
        let updateQuery = 'UPDATE users SET status = $1, updated_at = CURRENT_TIMESTAMP';
        const params = [status];

        if (status === 'approved') {
            const userResult = await pool.query('SELECT role FROM users WHERE user_id = $1', [userId]);
            if (userResult.rows.length > 0 && userResult.rows[0].role === 'pending_user') {
                updateQuery += ', role = $' + (params.length + 1);
                params.push('borrower');
            }
        }

        updateQuery += ' WHERE user_id = $' + (params.length + 1) + ' RETURNING user_id, name, email, role, status';
        params.push(userId);

        const result = await pool.query(updateQuery, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ message: 'User updated successfully', user: result.rows[0] });
    } catch (error) {
        console.error('Error updating user:', error.message);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// Delete user (admin only)
router.delete('/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    try {
        const result = await pool.query(
            'DELETE FROM users WHERE user_id = $1 RETURNING user_id',
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error.message);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

module.exports = router;

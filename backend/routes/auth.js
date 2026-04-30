const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

// Login route
router.post('/login', async (req, res) => {
    console.log('Login attempt for:', req.body.email);
    
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Find user
        const result = await pool.query(
            'SELECT * FROM users WHERE LOWER(email) = LOWER($1)',
            [email.trim()]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const user = result.rows[0];

        // Check if user is approved
        if (user.status !== 'approved') {
            return res.status(403).json({ error: 'Account pending approval. Please wait for admin approval.' });
        }

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { userId: user.user_id, role: user.role },
            process.env.JWT_SECRET || 'your-secret-key-change-in-production',
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user: {
                user_id: user.user_id,
                name: user.name,
                email: user.email,
                role: user.role,
                status: user.status
            }
        });

    } catch (error) {
        console.error('Login error:', error.message);
        res.status(500).json({ error: 'Server error during login' });
    }
});

// Register route
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, phone, street, barangay, city, province, zip_code } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email, and password are required' });
        }

        // Check if user exists
        const existingUser = await pool.query(
            'SELECT * FROM users WHERE LOWER(email) = LOWER($1)',
            [email.trim()]
        );

        if (existingUser.rows.length > 0) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Combine address
        const address = [street, barangay, city, province, zip_code]
            .filter(Boolean)
            .join(', ');

        // Insert user
        const result = await pool.query(
            `INSERT INTO users (name, email, password, role, status, phone, address) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) 
             RETURNING user_id, name, email, role, status`,
            [name, email.trim(), hashedPassword, 'pending_user', 'pending', phone || null, address || null]
        );

        res.status(201).json({
            message: 'Registration successful. Please wait for admin approval.',
            user: result.rows[0]
        });

    } catch (error) {
        console.error('Registration error:', error.message);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Get current user
router.get('/me', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'No token provided' });

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-in-production');
        const result = await pool.query(
            'SELECT user_id, name, email, role, status FROM users WHERE user_id = $1',
            [decoded.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
});

module.exports = router;

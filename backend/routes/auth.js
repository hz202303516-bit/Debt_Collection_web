const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../database'); // Make sure this path is correct

// Login route
router.post('/login', async (req, res) => {
    console.log('Login attempt for:', req.body.email);
    
    try {
        const { email, password } = req.body;

        // Validate input
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

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { userId: user.user_id, role: user.role },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );

        // Send response
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
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error during login' });
    }
});

// Register route
router.post('/register', async (req, res) => {
    console.log('Registration attempt for:', req.body.email);
    
    try {
        const { name, email, password, phone, street, barangay, city, province, zip_code } = req.body;

        // Validate required fields
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
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Test route
router.get('/test', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');
        res.json({ 
            status: 'ok', 
            time: result.rows[0].now,
            database: 'connected'
        });
    } catch (error) {
        res.status(500).json({ 
            status: 'error', 
            message: error.message 
        });
    }
});

module.exports = router;

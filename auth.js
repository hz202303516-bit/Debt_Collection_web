const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const pool = require('./database');

const router = express.Router();

// Register - No role selection, default role is 'pending_user'
router.post('/register', [
    body('name').notEmpty().trim().withMessage('Name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                error: errors.array()[0].msg,
                errors: errors.array() 
            });
        }

        const { name, email, password, phone, address } = req.body;

        // Check if user already exists
        const userExists = await pool.query(
            'SELECT user_id, email FROM users WHERE email = $1',
            [email.toLowerCase()]
        );

        if (userExists.rows.length > 0) {
            return res.status(400).json({ 
                error: 'An account with this email already exists.' 
            });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Insert user with 'pending' status and no role
        const result = await pool.query(
            `INSERT INTO users (name, email, password, role, status, phone, address) 
             VALUES ($1, $2, $3, 'pending_user', 'pending', $4, $5) 
             RETURNING user_id, name, email, role, status, phone, address, created_at`,
            [name, email.toLowerCase(), hashedPassword, phone || null, address || null]
        );

        res.status(201).json({
            message: 'Registration submitted successfully. Please wait for admin approval.',
            user: {
                user_id: result.rows[0].user_id,
                name: result.rows[0].name,
                email: result.rows[0].email,
                status: result.rows[0].status
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        
        if (error.code === '23505') {
            return res.status(400).json({ 
                error: 'An account with this email already exists.' 
            });
        }
        
        res.status(500).json({ 
            error: 'Registration failed due to server error.' 
        });
    }
});

// Login - Checks role and status
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Find user
        const result = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email.toLowerCase()]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const user = result.rows[0];

        // Check if user is approved
        if (user.status !== 'approved') {
            if (user.status === 'pending') {
                return res.status(403).json({ 
                    error: 'Your account is pending approval. Please wait for admin to approve your account.',
                    status: 'pending'
                });
            } else if (user.status === 'rejected') {
                return res.status(403).json({ 
                    error: 'Your account has been rejected. Please contact the administrator.',
                    status: 'rejected'
                });
            }
        }

        // Check if user has a role assigned
        if (user.role === 'pending_user') {
            return res.status(403).json({ 
                error: 'Your account has been approved but no role has been assigned yet. Please wait for admin to assign your role.',
                status: 'no_role'
            });
        }

        // Validate password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Generate token with user info
        const token = jwt.sign(
            { 
                user_id: user.user_id, 
                email: user.email, 
                role: user.role,
                name: user.name,
                status: user.status
            },
            process.env.JWT_SECRET || 'my_super_secret_jwt_key_2024',
            { expiresIn: '24h' }
        );

        // Return user with role info for frontend routing
        res.json({
            message: 'Login successful',
            token,
            user: {
                user_id: user.user_id,
                name: user.name,
                email: user.email,
                role: user.role,
                status: user.status
            },
            redirectTo: getRedirectPath(user.role)
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed due to server error' });
    }
});

// Helper function to determine redirect path based on role
function getRedirectPath(role) {
    switch(role) {
        case 'admin':
            return '/admin';
        case 'collector':
            return '/collector';
        case 'borrower':
            return '/borrower';
        default:
            return '/login';
    }
}

// Create initial admin account (one-time use)
router.post('/create-admin', async (req, res) => {
    try {
        const { adminSecret, name, email, password } = req.body;
        
        const ADMIN_SECRET = process.env.ADMIN_SECRET || 'create-admin-secret-key-2024';
        
        if (adminSecret !== ADMIN_SECRET) {
            return res.status(403).json({ error: 'Invalid admin secret key' });
        }

        // Check if admin already exists
        const adminExists = await pool.query(
            "SELECT user_id FROM users WHERE role = 'admin'"
        );

        if (adminExists.rows.length > 0) {
            return res.status(400).json({ 
                error: 'Admin account already exists. Only one admin is allowed.' 
            });
        }

        const userExists = await pool.query(
            'SELECT user_id FROM users WHERE email = $1',
            [email.toLowerCase()]
        );

        if (userExists.rows.length > 0) {
            return res.status(400).json({ error: 'User with this email already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const result = await pool.query(
            `INSERT INTO users (name, email, password, role, status) 
             VALUES ($1, $2, $3, 'admin', 'approved') 
             RETURNING user_id, name, email, role, status`,
            [name, email.toLowerCase(), hashedPassword]
        );

        res.status(201).json({
            message: 'Admin account created successfully',
            user: result.rows[0]
        });

    } catch (error) {
        console.error('Admin creation error:', error);
        res.status(500).json({ error: 'Failed to create admin account' });
    }
});

module.exports = router;
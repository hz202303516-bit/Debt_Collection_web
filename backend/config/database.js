const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Auto-initialize database tables
async function initializeDatabase() {
    console.log('Checking database tables...');
    
    try {
        // Check if users table exists
        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'users'
            );
        `);
        
        if (!tableCheck.rows[0].exists) {
            console.log('Tables not found. Creating database schema...');
            
            // Create all tables
            await pool.query(`
                CREATE TABLE IF NOT EXISTS users (
                    user_id SERIAL PRIMARY KEY,
                    name VARCHAR(100) NOT NULL,
                    email VARCHAR(100) UNIQUE NOT NULL,
                    password VARCHAR(255) NOT NULL,
                    role VARCHAR(20) CHECK (role IN ('admin', 'collector', 'borrower', 'pending_user')) NOT NULL,
                    status VARCHAR(20) CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
                    phone VARCHAR(20),
                    address TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS borrowers (
                    borrower_id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(user_id),
                    full_name VARCHAR(100) NOT NULL,
                    address TEXT,
                    phone VARCHAR(20),
                    collector_id INTEGER REFERENCES users(user_id),
                    gps_latitude DECIMAL(10, 8),
                    gps_longitude DECIMAL(11, 8),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS loans (
                    loan_id SERIAL PRIMARY KEY,
                    borrower_id INTEGER REFERENCES borrowers(borrower_id),
                    loan_amount DECIMAL(15, 2) NOT NULL,
                    interest_rate DECIMAL(5, 2) NOT NULL,
                    due_date DATE NOT NULL,
                    balance DECIMAL(15, 2) NOT NULL,
                    status VARCHAR(20) CHECK (status IN ('active', 'paid', 'defaulted', 'pending')) DEFAULT 'active',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS payments (
                    payment_id SERIAL PRIMARY KEY,
                    loan_id INTEGER REFERENCES loans(loan_id),
                    collector_id INTEGER REFERENCES users(user_id),
                    amount DECIMAL(15, 2) NOT NULL,
                    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    gps_latitude DECIMAL(10, 8),
                    gps_longitude DECIMAL(11, 8),
                    receipt_number VARCHAR(50) UNIQUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS gps_logs (
                    gps_id SERIAL PRIMARY KEY,
                    collector_id INTEGER REFERENCES users(user_id),
                    borrower_id INTEGER REFERENCES borrowers(borrower_id),
                    latitude DECIMAL(10, 8),
                    longitude DECIMAL(11, 8),
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS collection_assignments (
                    assignment_id SERIAL PRIMARY KEY,
                    admin_id INTEGER REFERENCES users(user_id),
                    collector_id INTEGER REFERENCES users(user_id),
                    borrower_id INTEGER REFERENCES borrowers(borrower_id),
                    assigned_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    status VARCHAR(20) CHECK (status IN ('assigned', 'in_progress', 'completed')) DEFAULT 'assigned'
                );

                CREATE TABLE IF NOT EXISTS risk_assessments (
                    assessment_id SERIAL PRIMARY KEY,
                    borrower_id INTEGER REFERENCES borrowers(borrower_id),
                    risk_score DECIMAL(5, 2),
                    risk_level VARCHAR(20),
                    factors JSONB,
                    assessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                -- Create indexes
                CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
                CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
                CREATE INDEX IF NOT EXISTS idx_borrowers_collector ON borrowers(collector_id);
                CREATE INDEX IF NOT EXISTS idx_loans_borrower ON loans(borrower_id);
                CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
                CREATE INDEX IF NOT EXISTS idx_payments_loan ON payments(loan_id);
                CREATE INDEX IF NOT EXISTS idx_gps_logs_collector ON gps_logs(collector_id);
            `);
            
            console.log('✅ Database tables created successfully!');
            
            // Seed admin user
            const bcrypt = require('bcrypt');
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash('admin123', salt);
            
            await pool.query(`
                INSERT INTO users (name, email, password, role, status)
                VALUES ('Admin', 'admin@system.com', $1, 'admin', 'approved')
                ON CONFLICT (email) DO NOTHING
            `, [hashedPassword]);
            
            console.log('✅ Admin user seeded (admin@system.com / admin123)');
        } else {
            console.log('✅ Database tables already exist');
        }
    } catch (error) {
        console.error('Database initialization error:', error.message);
    }
}

// Test connection and initialize
pool.connect()
    .then(async (client) => {
        console.log('✅ Database connected successfully at:', new Date().toISOString());
        client.release();
        await initializeDatabase();
    })
    .catch(err => {
        console.error('❌ Database connection error:', err.message);
    });

module.exports = pool;

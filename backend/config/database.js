const { Pool } = require('pg');
require('dotenv').config();

// Check if we have a DATABASE_URL (Render) or individual parameters (local)
const pool = new Pool(
    process.env.DATABASE_URL 
        ? {
            // Render/Production configuration
            connectionString: process.env.DATABASE_URL,
            ssl: {
                rejectUnauthorized: false // Required for Render PostgreSQL
            }
        }
        : {
            // Local development configuration
            user: process.env.DB_USER || 'postgres',
            host: process.env.DB_HOST || 'localhost',
            database: process.env.DB_NAME || 'debt_collection',
            password: process.env.DB_PASSWORD || '12345',
            port: process.env.DB_PORT || 5432,
        }
);

// Test connection on startup
pool.query('SELECT NOW()')
    .then(result => {
        console.log('✅ Database connected successfully at:', result.rows[0].now);
    })
    .catch(err => {
        console.error('❌ Database connection failed:', err.message);
        console.error('Connection details:', {
            usingDatabseUrl: !!process.env.DATABASE_URL,
            host: process.env.DATABASE_URL ? 'Render' : (process.env.DB_HOST || 'localhost')
        });
    });

module.exports = pool;
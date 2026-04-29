const { Pool } = require('pg');
require('dotenv').config();

let poolConfig;

if (process.env.DATABASE_URL) {
    // Render or production database
    poolConfig = {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    };
} else {
    // Local development
    poolConfig = {
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'debt_collection',
        password: process.env.DB_PASSWORD || '12345',
        port: process.env.DB_PORT || 5432,
    };
}

const pool = new Pool(poolConfig);

// Test connection
pool.query('SELECT 1')
    .then(() => console.log('Database connected'))
    .catch(err => console.error('Database connection error:', err.message));

module.exports = pool;
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
    try {
        const schemaPath = path.join(__dirname, 'schema.sql');
        if (fs.existsSync(schemaPath)) {
            const schema = fs.readFileSync(schemaPath, 'utf8');
            await pool.query(schema);
            console.log('✅ Database tables initialized successfully');
        } else {
            console.log('Schema file not found at:', schemaPath);
        }
    } catch (error) {
        if (error.message.includes('already exists')) {
            console.log('Tables already exist, continuing...');
        } else {
            console.error('Database initialization error:', error.message);
        }
    }
}

// Test connection first
pool.connect()
    .then(async (client) => {
        console.log('✅ Database connected successfully');
        client.release();
        // Initialize tables after successful connection
        await initializeDatabase();
    })
    .catch(err => {
        console.error('❌ Database connection error:', err.message);
    });

module.exports = pool;

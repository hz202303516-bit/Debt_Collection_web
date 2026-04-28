const { Pool } = require('pg');
const isProduction = process.env.DATABASE_URL ? true : false;
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Use the connection string from Render
  max: 20, // Limit this service to 20 connections [citation:7]
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  // SSL is required for external connections, but Render's internal network handles this automatically
  // ssl: isProduction ? { rejectUnauthorized: false } : false
});

module.exports = pool;
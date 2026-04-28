const express = require('express');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const pool = require('../config/database');

const router = express.Router();

// Update collector's GPS location
router.post('/collector-location', authenticateToken, authorizeRoles('collector'), async (req, res) => {
    try {
        const { latitude, longitude, accuracy } = req.body;
        const collectorId = req.user.user_id;

        await pool.query(
            `INSERT INTO gps_logs (collector_id, latitude, longitude, timestamp) 
             VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
            [collectorId, latitude, longitude]
        );

        res.json({ message: 'Location updated', latitude, longitude });
    } catch (error) {
        console.error('Error updating collector location:', error);
        res.status(500).json({ error: 'Failed to update location' });
    }
});

// Get collector's current location (for admin)
router.get('/collector-location/:collectorId', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    try {
        const { collectorId } = req.params;
        const result = await pool.query(
            `SELECT latitude, longitude, timestamp 
             FROM gps_logs 
             WHERE collector_id = $1 
             ORDER BY timestamp DESC 
             LIMIT 1`,
            [collectorId]
        );

        if (result.rows.length === 0) {
            return res.json({ latitude: null, longitude: null });
        }

        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get location' });
    }
});

// Get all collector locations (for admin map)
router.get('/all-collector-locations', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT DISTINCT ON (gl.collector_id) 
                gl.collector_id, gl.latitude, gl.longitude, gl.timestamp,
                u.name as collector_name
            FROM gps_logs gl
            JOIN users u ON gl.collector_id = u.user_id
            ORDER BY gl.collector_id, gl.timestamp DESC
        `);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get locations' });
    }
});

module.exports = router;
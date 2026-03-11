const express = require('express');
const router = express.Router();
const inflationService = require('../services/inflationService');
const authMiddleware = require('../middleware/auth');
const { requireRole, requireFraudAccess, requireAdmin } = require('../middleware/roleMiddleware');

/**
 * @route   GET /api/analytics/inflation/current
 * @desc    Get current inflation rate
 * @access  Private (Auditor, Administrator)
 */
router.get('/inflation/current', authMiddleware, async (req, res) => {
    try {
        const rate = await inflationService.getCurrentRate();

        res.json({
            success: true,
            data: {
                rate,
                unit: 'percent',
                source: 'World Bank / Philippine Statistics Authority',
                lastUpdated: new Date()
            }
        });
    } catch (error) {
        console.error('Error fetching current inflation rate:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch inflation rate',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/analytics/inflation/history
 * @desc    Get historical inflation rates
 * @access  Private (Auditor, Administrator)
 */
router.get('/inflation/history', authMiddleware, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 12;
        const history = await inflationService.getHistoricalRates(limit);

        res.json({
            success: true,
            data: history.map(record => ({
                month: record.month,
                rate: record.rate,
                source: record.source
            }))
        });
    } catch (error) {
        console.error('Error fetching inflation history:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch inflation history',
            error: error.message
        });
    }
});

/**
 * @route   POST /api/analytics/inflation/manual
 * @desc    Manually set inflation rate (admin only)
 * @access  Private (Administrator only)
 */
router.post('/inflation/manual', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { rate, month } = req.body;

        if (!rate || isNaN(rate)) {
            return res.status(400).json({
                success: false,
                message: 'Valid inflation rate is required'
            });
        }

        const monthDate = month ? new Date(month) : new Date();
        const record = await inflationService.setManualRate(rate, monthDate);

        res.json({
            success: true,
            message: 'Inflation rate updated successfully',
            data: {
                month: record.month,
                rate: record.rate,
                source: record.source
            }
        });
    } catch (error) {
        console.error('Error setting manual inflation rate:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to set inflation rate',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/analytics/inflation/status
 * @desc    Get inflation service status (admin only)
 * @access  Private (Administrator only)
 */
router.get('/inflation/status', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const status = await inflationService.getAdminStatus();

        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        console.error('Error fetching inflation status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch inflation status',
            error: error.message
        });
    }
});

module.exports = router;

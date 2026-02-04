const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const aiController = require('../controllers/aiController');

// Rate limit: 5 requests per 15 minutes
const aiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: {
        success: false,
        error: 'Слишком много запросов. Попробуйте через 15 минут.'
    }
});

// GET /api/ai/status - check if AI is configured
router.get('/status', (req, res) => {
    res.json({
        success: true,
        configured: !!process.env.OPENROUTER_API_KEY,
        keyPreview: process.env.OPENROUTER_API_KEY
            ? process.env.OPENROUTER_API_KEY.substring(0, 8) + '...'
            : null
    });
});

// POST /api/ai/generate-landing
router.post('/generate-landing', aiLimiter, aiController.generateLanding);

module.exports = router;

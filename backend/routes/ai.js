const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const aiController = require('../controllers/aiController');

// Rate limit: 20 requests per 15 minutes
const aiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
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

// POST /api/ai/analyze-business — AI-powered business analysis for project creation
router.post('/analyze-business', aiLimiter, aiController.analyzeBusiness);

// POST /api/ai/generate-landing — start generation job
router.post('/generate-landing', aiLimiter, aiController.generateLanding);

// GET /api/ai/result/:jobId — poll for result
router.get('/result/:jobId', aiController.getResult);

// POST /api/ai/edit-block — AI-assisted block editing
router.post('/edit-block', aiLimiter, aiController.editBlock);

module.exports = router;

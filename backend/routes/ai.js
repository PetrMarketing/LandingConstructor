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

// POST /api/ai/generate-landing
router.post('/generate-landing', aiLimiter, aiController.generateLanding);

module.exports = router;

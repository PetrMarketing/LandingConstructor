const express = require('express');
const router = express.Router();

const authRoutes = require('./auth');
const usersRoutes = require('./users');
const projectsRoutes = require('./projects');
const pagesRoutes = require('./pages');
const aiRoutes = require('./ai');

// API routes
router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/projects', projectsRoutes);
router.use('/pages', pagesRoutes);
router.use('/ai', aiRoutes);

// Health check
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'API is running',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;

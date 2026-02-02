const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const config = require('./config/config');
const { initDatabase } = require('./config/database');
const routes = require('./routes');

// Initialize database
initDatabase();

// Create Express app
const app = express();

// Security middleware
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS
app.use(cors({
    origin: config.CORS_ORIGIN,
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    max: config.RATE_LIMIT_MAX_REQUESTS,
    message: {
        success: false,
        error: 'Слишком много запросов. Попробуйте позже.'
    }
});
app.use('/api', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, config.UPLOAD_DIR)));

// API routes
app.use('/api', routes);

// Serve frontend (if in same project)
app.use(express.static(path.join(__dirname, '../generate_site')));

// Root route
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'CMS API Server',
        version: '1.0.0',
        endpoints: {
            health: '/api/health',
            auth: '/api/auth',
            users: '/api/users',
            projects: '/api/projects'
        }
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found'
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);

    res.status(err.status || 500).json({
        success: false,
        error: config.NODE_ENV === 'development' ? err.message : 'Внутренняя ошибка сервера'
    });
});

// Start server
const PORT = config.PORT;
app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════╗
║           CMS Backend Server                   ║
╠═══════════════════════════════════════════════╣
║  Server running on port: ${PORT}                  ║
║  Environment: ${config.NODE_ENV.padEnd(20)}       ║
║  API: http://localhost:${PORT}/api                ║
╚═══════════════════════════════════════════════╝
    `);
});

module.exports = app;

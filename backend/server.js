const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const config = require('./config/config');
const { initDatabase, getDb } = require('./config/database');
const routes = require('./routes');

// Initialize database and create default admin
async function initApp() {
    initDatabase();

    // Create default admin if no owner exists
    const User = require('./models/User');
    const Project = require('./models/Project');

    const existingOwner = getDb().prepare("SELECT * FROM users WHERE role = 'owner' LIMIT 1").get();

    if (!existingOwner) {
        console.log('Creating default admin user...');
        const owner = await User.create({
            email: 'admin@example.com',
            password: 'admin123',
            name: 'Администратор',
            role: 'owner'
        });

        Project.create({
            name: 'Мой проект',
            description: 'Основной проект',
            owner_id: owner.id
        });

        console.log('Default admin created: admin@example.com / admin123');
    }
}

initApp().catch(err => console.error('Init error:', err));

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
        message: 'PK Business API Server',
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
║         PK Business API Server                 ║
╠═══════════════════════════════════════════════╣
║  Server running on port: ${PORT}                  ║
║  Environment: ${config.NODE_ENV.padEnd(20)}       ║
║  API: http://localhost:${PORT}/api                ║
╚═══════════════════════════════════════════════╝
    `);
});

module.exports = app;

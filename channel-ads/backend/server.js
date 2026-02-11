require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const { initDatabase } = require('./config/database');
const { initBot, getWebhookCallback } = require('./bot');
const { getMaxApi } = require('./services/maxApi');

// Initialize database
initDatabase();

// Initialize bot
const bot = initBot();

// Create Express app
const app = express();

// Security
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false
}));

// CORS
app.use(cors({
    origin: '*',
    credentials: true
}));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Telegram webhook (production only; in dev we use polling)
if (bot && process.env.NODE_ENV === 'production') {
    app.use('/webhook/telegram', getWebhookCallback());
}

// API Routes
app.use('/api/channels', require('./routes/channels'));
app.use('/api/links', require('./routes/links'));
app.use('/api/track', require('./routes/tracking'));
app.use('/api/max', require('./routes/max'));

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Channel Ads API',
        botConnected: !!bot
    });
});

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../frontend')));

// 404 for API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({ success: false, error: 'Endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'development' ? err.message : 'Внутренняя ошибка сервера'
    });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, async () => {
    console.log(`
╔═══════════════════════════════════════════════╗
║       Channel Ads Tracker Backend             ║
╠═══════════════════════════════════════════════╣
║  Server running on port: ${PORT}                  ║
║  Bot: ${bot ? 'Connected' : 'Not configured'}                          ║
╚═══════════════════════════════════════════════╝
    `);

    // Set webhook for bot (if in production)
    if (bot && process.env.NODE_ENV === 'production' && process.env.APP_URL) {
        try {
            await bot.api.setWebhook(`${process.env.APP_URL}/webhook/telegram`);
            console.log('Telegram webhook set');
        } catch (e) {
            console.error('Failed to set webhook:', e.message);
        }
    } else if (bot) {
        // Start polling in development
        bot.start();
        console.log('Bot started in polling mode');
    }

    // Set up MAX webhook (if configured)
    const maxApi = getMaxApi();
    if (maxApi && process.env.NODE_ENV === 'production' && process.env.APP_URL) {
        try {
            const webhookUrl = `${process.env.APP_URL}/api/max/webhook`;
            const result = await maxApi.subscribeWebhook(webhookUrl, [
                'bot_added',
                'bot_removed',
                'chat_member_joined',
                'message_created'
            ]);

            if (result.success) {
                console.log('MAX webhook registered:', webhookUrl);
            } else {
                console.error('Failed to register MAX webhook:', result.error);
            }
        } catch (e) {
            console.error('Failed to set MAX webhook:', e.message);
        }
    } else if (maxApi) {
        console.log('MAX bot configured (webhook not set in dev mode)');
    }
});

module.exports = app;

const express = require('express');
const router = express.Router();
const { getDb } = require('../config/database');

// Получить все ссылки канала
router.get('/:trackingCode', (req, res) => {
    const db = getDb();

    const channel = db.prepare(`
        SELECT id FROM channels WHERE tracking_code = ?
    `).get(req.params.trackingCode);

    if (!channel) {
        return res.status(404).json({ success: false, error: 'Канал не найден' });
    }

    const links = db.prepare(`
        SELECT l.*,
            (SELECT COUNT(*) FROM visits WHERE tracking_link_id = l.id) as visits_count,
            (SELECT COUNT(*) FROM subscriptions s
             JOIN visits v ON v.id = s.visit_id
             WHERE v.tracking_link_id = l.id) as subscribers_count
        FROM tracking_links l
        WHERE l.channel_id = ?
        ORDER BY l.created_at DESC
    `).all(channel.id);

    res.json({ success: true, links });
});

// Generate platform-specific tracking URL
function generateTrackingUrl(shortCode, platform) {
    const botUsername = process.env.BOT_USERNAME || 'PKmarketingBot';
    const miniAppName = process.env.MINIAPP_NAME || 'subscribe';
    const maxBotUsername = process.env.MAX_BOT_USERNAME || 'PKmarketingBot';

    if (platform === 'max') {
        // MAX Mini App URL format
        // Note: MAX uses a similar deep link structure
        return `https://max.ru/app/${maxBotUsername}?startapp=${shortCode}`;
    }

    // Telegram Mini App URL
    return `https://t.me/${botUsername}/${miniAppName}?startapp=${shortCode}`;
}

// Создать новую ссылку
router.post('/:trackingCode', (req, res) => {
    const { name, utm_source, utm_medium, utm_campaign, utm_content, utm_term } = req.body;
    const db = getDb();

    const channel = db.prepare(`
        SELECT id, username, platform FROM channels WHERE tracking_code = ?
    `).get(req.params.trackingCode);

    if (!channel) {
        return res.status(404).json({ success: false, error: 'Канал не найден' });
    }

    if (!name || !utm_source) {
        return res.status(400).json({ success: false, error: 'Укажите название и utm_source' });
    }

    // Генерируем короткий код
    const shortCode = generateShortCode();

    const result = db.prepare(`
        INSERT INTO tracking_links (channel_id, name, utm_source, utm_medium, utm_campaign, utm_content, utm_term, short_code)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(channel.id, name, utm_source, utm_medium || null, utm_campaign || null, utm_content || null, utm_term || null, shortCode);

    const link = db.prepare('SELECT * FROM tracking_links WHERE id = ?').get(result.lastInsertRowid);

    // Generate platform-specific URL
    const platform = channel.platform || 'telegram';
    const fullUrl = generateTrackingUrl(shortCode, platform);

    res.json({
        success: true,
        link: {
            ...link,
            full_url: fullUrl,
            platform: platform
        }
    });
});

// Удалить ссылку
router.delete('/:trackingCode/:linkId', (req, res) => {
    const db = getDb();

    const channel = db.prepare(`
        SELECT id FROM channels WHERE tracking_code = ?
    `).get(req.params.trackingCode);

    if (!channel) {
        return res.status(404).json({ success: false, error: 'Канал не найден' });
    }

    const result = db.prepare(`
        DELETE FROM tracking_links WHERE id = ? AND channel_id = ?
    `).run(req.params.linkId, channel.id);

    if (result.changes === 0) {
        return res.status(404).json({ success: false, error: 'Ссылка не найдена' });
    }

    res.json({ success: true, message: 'Ссылка удалена' });
});

function generateShortCode() {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 10; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

module.exports = router;

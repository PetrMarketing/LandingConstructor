const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { getDb } = require('../config/database');
const { getMaxApi } = require('../services/maxApi');

// Generate unique tracking code
function generateTrackingCode() {
    return crypto.randomBytes(8).toString('hex');
}

// Получить информацию о MAX боте
router.get('/status', async (req, res) => {
    const maxApi = getMaxApi();

    if (!maxApi) {
        return res.json({
            success: true,
            configured: false,
            message: 'MAX_BOT_TOKEN не настроен'
        });
    }

    try {
        const result = await maxApi.getMe();

        if (result.success) {
            res.json({
                success: true,
                configured: true,
                bot: result.data
            });
        } else {
            res.json({
                success: false,
                configured: true,
                error: result.error
            });
        }
    } catch (error) {
        console.error('[MAX] Status error:', error);
        res.json({
            success: false,
            error: error.message
        });
    }
});

// Получить список чатов MAX бота
router.get('/chats', async (req, res) => {
    const maxApi = getMaxApi();

    if (!maxApi) {
        return res.status(400).json({
            success: false,
            error: 'MAX_BOT_TOKEN не настроен'
        });
    }

    try {
        const result = await maxApi.getChats();

        if (result.success) {
            res.json({
                success: true,
                chats: result.data.chats || []
            });
        } else {
            res.json({
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        console.error('[MAX] Get chats error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Подключить MAX канал к Telegram каналу
router.post('/connect/:trackingCode', async (req, res) => {
    const { maxChatId } = req.body;
    const { trackingCode } = req.params;
    const db = getDb();
    const maxApi = getMaxApi();

    if (!maxApi) {
        return res.status(400).json({
            success: false,
            error: 'MAX_BOT_TOKEN не настроен'
        });
    }

    // Проверяем канал
    const channel = db.prepare(`
        SELECT id FROM channels WHERE tracking_code = ?
    `).get(trackingCode);

    if (!channel) {
        return res.status(404).json({
            success: false,
            error: 'Канал не найден'
        });
    }

    // Проверяем что MAX чат существует и бот имеет к нему доступ
    try {
        const chatResult = await maxApi.getChat(maxChatId);

        if (!chatResult.success) {
            return res.status(400).json({
                success: false,
                error: 'Не удалось получить информацию о MAX канале. Убедитесь что бот добавлен в канал.'
            });
        }

        // Сохраняем связь
        db.prepare(`
            UPDATE channels SET max_chat_id = ?, max_connected = 1
            WHERE id = ?
        `).run(maxChatId, channel.id);

        res.json({
            success: true,
            message: 'MAX канал успешно подключен',
            maxChat: chatResult.data
        });

    } catch (error) {
        console.error('[MAX] Connect error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Отключить MAX канал
router.delete('/disconnect/:trackingCode', (req, res) => {
    const { trackingCode } = req.params;
    const db = getDb();

    const result = db.prepare(`
        UPDATE channels SET max_chat_id = NULL, max_connected = 0
        WHERE tracking_code = ?
    `).run(trackingCode);

    if (result.changes === 0) {
        return res.status(404).json({
            success: false,
            error: 'Канал не найден'
        });
    }

    res.json({
        success: true,
        message: 'MAX канал отключен'
    });
});

// Discover new MAX channels (poll for channels where bot is admin)
router.get('/discover', async (req, res) => {
    const maxApi = getMaxApi();
    const db = getDb();

    if (!maxApi) {
        return res.status(400).json({
            success: false,
            error: 'MAX_BOT_TOKEN не настроен'
        });
    }

    try {
        const result = await maxApi.getChats();

        if (!result.success) {
            return res.json({
                success: false,
                error: result.error
            });
        }

        const chats = result.data.chats || [];
        const newChannels = [];

        for (const chat of chats) {
            // Only process channels/groups where bot can manage
            if (chat.type !== 'channel' && chat.type !== 'chat') continue;

            const chatId = chat.chat_id?.toString();
            if (!chatId) continue;

            // Check if channel already exists
            const existing = db.prepare(`
                SELECT id FROM channels WHERE max_chat_id = ? OR (channel_id = ? AND platform = 'max')
            `).get(chatId, chatId);

            if (!existing) {
                // Register new MAX channel
                const trackingCode = generateTrackingCode();

                try {
                    db.prepare(`
                        INSERT INTO channels (channel_id, title, username, max_chat_id, max_connected, tracking_code, platform, is_active)
                        VALUES (?, ?, ?, ?, 1, ?, 'max', 1)
                    `).run(
                        chatId,
                        chat.title || 'MAX Channel',
                        chat.link || null,
                        chatId,
                        trackingCode
                    );

                    newChannels.push({
                        chat_id: chatId,
                        title: chat.title,
                        tracking_code: trackingCode
                    });

                    console.log(`[MAX] New channel registered: ${chat.title} (${chatId})`);
                } catch (e) {
                    if (!e.message.includes('UNIQUE constraint')) {
                        console.error('[MAX] Error registering channel:', e.message);
                    }
                }
            }
        }

        res.json({
            success: true,
            discovered: newChannels,
            total_chats: chats.length
        });

    } catch (error) {
        console.error('[MAX] Discover error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Webhook для MAX событий
router.post('/webhook', async (req, res) => {
    const { update_type, timestamp, message, chat_member } = req.body;
    const db = getDb();

    console.log('[MAX Webhook] Received:', update_type, JSON.stringify(req.body).slice(0, 200));

    try {
        // Handle bot_added event - auto-register MAX channel
        if (update_type === 'bot_added') {
            const chatId = req.body.chat_id?.toString() || req.body.chat?.chat_id?.toString();
            const chatTitle = req.body.chat?.title || req.body.title || 'MAX Channel';
            const chatLink = req.body.chat?.link || req.body.link;

            if (chatId) {
                // Check if channel already exists
                const existing = db.prepare(`
                    SELECT id FROM channels WHERE max_chat_id = ? OR (channel_id = ? AND platform = 'max')
                `).get(chatId, chatId);

                if (!existing) {
                    const trackingCode = generateTrackingCode();

                    db.prepare(`
                        INSERT INTO channels (channel_id, title, username, max_chat_id, max_connected, tracking_code, platform, is_active)
                        VALUES (?, ?, ?, ?, 1, ?, 'max', 1)
                    `).run(chatId, chatTitle, chatLink, chatId, trackingCode);

                    console.log(`[MAX Webhook] Channel registered via bot_added: ${chatTitle} (${chatId})`);
                } else {
                    // Reactivate if it was deactivated
                    db.prepare(`
                        UPDATE channels SET is_active = 1, max_connected = 1 WHERE id = ?
                    `).run(existing.id);

                    console.log(`[MAX Webhook] Channel reactivated: ${chatId}`);
                }
            }
        }

        // Handle bot_removed event - deactivate MAX channel
        if (update_type === 'bot_removed') {
            const chatId = req.body.chat_id?.toString() || req.body.chat?.chat_id?.toString();

            if (chatId) {
                db.prepare(`
                    UPDATE channels SET is_active = 0, max_connected = 0
                    WHERE max_chat_id = ? OR (channel_id = ? AND platform = 'max')
                `).run(chatId, chatId);

                console.log(`[MAX Webhook] Channel deactivated via bot_removed: ${chatId}`);
            }
        }

        // Handle chat_member_joined event - track subscription
        if (update_type === 'chat_member_joined' && chat_member) {
            const maxChatId = chat_member.chat_id?.toString();
            const userId = chat_member.user?.user_id?.toString();
            const username = chat_member.user?.username;
            const firstName = chat_member.user?.name;

            // Find MAX channel (either linked or standalone)
            const channel = db.prepare(`
                SELECT id, platform FROM channels
                WHERE max_chat_id = ? OR (channel_id = ? AND platform = 'max')
            `).get(maxChatId, maxChatId);

            if (channel) {
                // Look for recent visit by this user (by max_user_id or username)
                let visit = null;
                if (userId) {
                    visit = db.prepare(`
                        SELECT id FROM visits
                        WHERE channel_id = ? AND (max_user_id = ? OR username = ?)
                        AND visited_at > datetime('now', '-7 days')
                        ORDER BY visited_at DESC
                        LIMIT 1
                    `).get(channel.id, userId, username);
                }

                // Record subscription
                try {
                    db.prepare(`
                        INSERT INTO subscriptions (channel_id, telegram_id, max_user_id, username, first_name, visit_id, platform)
                        VALUES (?, ?, ?, ?, ?, ?, 'max')
                    `).run(channel.id, null, userId, username, firstName, visit?.id || null);

                    console.log(`[MAX] Subscription recorded: user=${username || userId}, channel=${channel.id}`);
                } catch (e) {
                    if (!e.message.includes('UNIQUE constraint')) {
                        console.error('[MAX] Error saving subscription:', e.message);
                    }
                }
            }
        }

        res.json({ success: true });
    } catch (error) {
        console.error('[MAX Webhook] Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;

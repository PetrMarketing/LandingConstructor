const express = require('express');
const router = express.Router();
const { getDb } = require('../config/database');
const { getMaxApi } = require('../services/maxApi');

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

// Webhook для MAX событий
router.post('/webhook', async (req, res) => {
    const { update_type, timestamp, message, chat_member } = req.body;
    const db = getDb();

    console.log('[MAX Webhook] Received:', update_type);

    try {
        // Обрабатываем событие подписки на канал
        if (update_type === 'chat_member_joined' && chat_member) {
            const maxChatId = chat_member.chat_id?.toString();
            const userId = chat_member.user?.user_id;
            const username = chat_member.user?.username;
            const firstName = chat_member.user?.name;

            // Находим связанный Telegram канал
            const channel = db.prepare(`
                SELECT id FROM channels WHERE max_chat_id = ?
            `).get(maxChatId);

            if (channel) {
                // Ищем визит этого пользователя (по username если есть)
                let visit = null;
                if (username) {
                    visit = db.prepare(`
                        SELECT id FROM visits
                        WHERE channel_id = ? AND username = ?
                        AND visited_at > datetime('now', '-7 days')
                        ORDER BY visited_at DESC
                        LIMIT 1
                    `).get(channel.id, username);
                }

                // Записываем подписку
                try {
                    db.prepare(`
                        INSERT INTO subscriptions (channel_id, telegram_id, username, first_name, visit_id)
                        VALUES (?, ?, ?, ?, ?)
                    `).run(channel.id, userId, username, firstName, visit?.id || null);

                    console.log(`[MAX] Subscription recorded: user=${username}, channel=${channel.id}`);
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

const express = require('express');
const router = express.Router();
const { getDb } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

// ============================================================
// INTEGRATIONS & WEBHOOKS (amoCRM-like)
// ============================================================

// Get all integrations
router.get('/:projectId', (req, res) => {
    try {
        const db = getDb();
        const { type, is_active } = req.query;

        let query = `
            SELECT * FROM lead_sources
            WHERE project_id = ?
        `;
        const params = [req.params.projectId];

        if (type) {
            query += ` AND type = ?`;
            params.push(type);
        }
        if (is_active !== undefined) {
            query += ` AND is_active = ?`;
            params.push(is_active === 'true' ? 1 : 0);
        }

        query += ` ORDER BY created_at DESC`;

        const integrations = db.prepare(query).all(...params);

        res.json({
            success: true,
            integrations: integrations.map(i => ({
                ...i,
                settings: JSON.parse(i.settings || '{}')
            }))
        });
    } catch (error) {
        console.error('Get integrations error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create integration
router.post('/:projectId', (req, res) => {
    try {
        const db = getDb();
        const id = uuidv4();
        const { name, type, settings, external_id } = req.body;

        if (!name || !type) {
            return res.status(400).json({ success: false, error: 'Название и тип обязательны' });
        }

        // Validate type
        const validTypes = [
            'web_form',      // Веб-форма
            'widget',        // Виджет на сайте
            'telegram',      // Telegram бот
            'whatsapp',      // WhatsApp
            'vk',            // VK сообщества
            'facebook',      // Facebook
            'email',         // Email интеграция
            'telephony',     // Телефония
            'api',           // API интеграция
            'zapier',        // Zapier
            'webhook'        // Входящий webhook
        ];

        if (!validTypes.includes(type)) {
            return res.status(400).json({
                success: false,
                error: `Неверный тип. Допустимые: ${validTypes.join(', ')}`
            });
        }

        // Generate webhook token for incoming webhooks
        let integrationSettings = settings || {};
        if (type === 'webhook' || type === 'api') {
            integrationSettings.webhook_token = crypto.randomBytes(32).toString('hex');
            integrationSettings.webhook_url = `/api/integrations/${req.params.projectId}/webhook/${id}`;
        }

        db.prepare(`
            INSERT INTO lead_sources (id, project_id, name, type, external_id, settings)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(id, req.params.projectId, name, type, external_id, JSON.stringify(integrationSettings));

        const integration = db.prepare('SELECT * FROM lead_sources WHERE id = ?').get(id);

        res.json({
            success: true,
            integration: {
                ...integration,
                settings: JSON.parse(integration.settings || '{}')
            }
        });
    } catch (error) {
        console.error('Create integration error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update integration
router.put('/:projectId/:integrationId', (req, res) => {
    try {
        const db = getDb();
        const { name, settings, is_active } = req.body;

        db.prepare(`
            UPDATE lead_sources SET
                name = COALESCE(?, name),
                settings = COALESCE(?, settings),
                is_active = COALESCE(?, is_active)
            WHERE id = ? AND project_id = ?
        `).run(
            name,
            settings ? JSON.stringify(settings) : null,
            is_active !== undefined ? (is_active ? 1 : 0) : null,
            req.params.integrationId, req.params.projectId
        );

        const integration = db.prepare('SELECT * FROM lead_sources WHERE id = ?').get(req.params.integrationId);

        res.json({
            success: true,
            integration: {
                ...integration,
                settings: JSON.parse(integration.settings || '{}')
            }
        });
    } catch (error) {
        console.error('Update integration error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete integration
router.delete('/:projectId/:integrationId', (req, res) => {
    try {
        const db = getDb();
        db.prepare('DELETE FROM lead_sources WHERE id = ? AND project_id = ?')
            .run(req.params.integrationId, req.params.projectId);

        res.json({ success: true });
    } catch (error) {
        console.error('Delete integration error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Incoming webhook handler
router.post('/:projectId/webhook/:integrationId', async (req, res) => {
    try {
        const db = getDb();
        const { integrationId, projectId } = req.params;
        const { token } = req.query;

        // Get integration
        const integration = db.prepare(`
            SELECT * FROM lead_sources WHERE id = ? AND project_id = ?
        `).get(integrationId, projectId);

        if (!integration) {
            return res.status(404).json({ success: false, error: 'Интеграция не найдена' });
        }

        const settings = JSON.parse(integration.settings || '{}');

        // Validate token
        if (settings.webhook_token && settings.webhook_token !== token) {
            return res.status(401).json({ success: false, error: 'Неверный токен' });
        }

        if (!integration.is_active) {
            return res.status(400).json({ success: false, error: 'Интеграция неактивна' });
        }

        // Process incoming data
        const data = req.body;
        let result = { success: true };

        // Extract lead data based on integration type
        let leadData = {};

        switch (integration.type) {
            case 'web_form':
            case 'widget':
                leadData = {
                    name: data.name || data.title || `Лид из ${integration.name}`,
                    client: {
                        first_name: data.first_name || data.name?.split(' ')[0],
                        last_name: data.last_name || data.name?.split(' ').slice(1).join(' '),
                        email: data.email,
                        phone: data.phone || data.tel
                    },
                    source: integration.name,
                    utm_source: data.utm_source,
                    utm_medium: data.utm_medium,
                    utm_campaign: data.utm_campaign,
                    notes: data.message || data.comment || data.notes,
                    custom_fields: data.custom_fields || {}
                };
                break;

            case 'telegram':
                leadData = {
                    name: `Telegram: ${data.message?.text?.slice(0, 50) || 'Новое сообщение'}`,
                    client: {
                        first_name: data.message?.from?.first_name,
                        last_name: data.message?.from?.last_name,
                        telegram_id: data.message?.from?.id?.toString(),
                        telegram_username: data.message?.from?.username
                    },
                    source: 'Telegram',
                    notes: data.message?.text
                };
                break;

            case 'email':
                leadData = {
                    name: data.subject || `Email от ${data.from}`,
                    client: {
                        email: data.from || data.sender,
                        first_name: data.from_name
                    },
                    source: 'Email',
                    notes: data.body || data.text
                };
                break;

            default:
                // Generic format
                leadData = {
                    name: data.name || data.title || `Лид от ${integration.name}`,
                    client: data.client || {
                        email: data.email,
                        phone: data.phone,
                        first_name: data.first_name,
                        last_name: data.last_name
                    },
                    source: integration.name,
                    custom_fields: data
                };
        }

        // Create or find client
        let clientId = null;
        if (leadData.client && (leadData.client.email || leadData.client.phone || leadData.client.telegram_id)) {
            // Try to find existing client
            let existingClient = null;
            if (leadData.client.email) {
                existingClient = db.prepare('SELECT id FROM clients WHERE project_id = ? AND email = ?')
                    .get(projectId, leadData.client.email);
            }
            if (!existingClient && leadData.client.phone) {
                existingClient = db.prepare('SELECT id FROM clients WHERE project_id = ? AND phone = ?')
                    .get(projectId, leadData.client.phone);
            }
            if (!existingClient && leadData.client.telegram_id) {
                existingClient = db.prepare('SELECT id FROM clients WHERE project_id = ? AND telegram_id = ?')
                    .get(projectId, leadData.client.telegram_id);
            }

            if (existingClient) {
                clientId = existingClient.id;
            } else {
                // Create new client
                clientId = uuidv4();
                db.prepare(`
                    INSERT INTO clients (id, project_id, email, phone, first_name, last_name, telegram_id, telegram_username, source)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(
                    clientId, projectId,
                    leadData.client.email, leadData.client.phone,
                    leadData.client.first_name, leadData.client.last_name,
                    leadData.client.telegram_id, leadData.client.telegram_username,
                    leadData.source
                );
            }
        }

        // Get default funnel and first stage
        const funnel = db.prepare(`
            SELECT id FROM funnels WHERE project_id = ? AND is_default = 1 LIMIT 1
        `).get(projectId);

        let stageId = null;
        if (funnel) {
            const stage = db.prepare(`
                SELECT id FROM funnel_stages WHERE funnel_id = ? ORDER BY sort_order LIMIT 1
            `).get(funnel.id);
            stageId = stage?.id;
        }

        // Create deal
        const dealId = uuidv4();
        db.prepare(`
            INSERT INTO deals (
                id, project_id, name, client_id, funnel_id, stage_id,
                source, utm_source, utm_medium, utm_campaign,
                notes, custom_fields
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            dealId, projectId, leadData.name, clientId,
            funnel?.id, stageId,
            leadData.source, leadData.utm_source, leadData.utm_medium, leadData.utm_campaign,
            leadData.notes, JSON.stringify(leadData.custom_fields || {})
        );

        // Add to lead queue for distribution
        db.prepare(`
            INSERT INTO lead_queue (id, project_id, deal_id, source, status)
            VALUES (?, ?, ?, ?, 'pending')
        `).run(uuidv4(), projectId, dealId, integration.name);

        // Update integration stats
        db.prepare(`
            UPDATE lead_sources SET stats_leads = stats_leads + 1 WHERE id = ?
        `).run(integrationId);

        result = {
            success: true,
            deal_id: dealId,
            client_id: clientId,
            message: 'Лид создан'
        };

        console.log(`[Webhook] ${integration.name}: Created deal ${dealId}`);

        res.json(result);
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get integration stats
router.get('/:projectId/stats/overview', (req, res) => {
    try {
        const db = getDb();
        const { date_from, date_to } = req.query;

        const start = date_from || new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0];
        const end = date_to || new Date().toISOString().split('T')[0];

        const stats = db.prepare(`
            SELECT
                ls.id,
                ls.name,
                ls.type,
                ls.stats_leads as total_leads,
                ls.stats_conversions as conversions,
                ls.stats_revenue as revenue,
                (SELECT COUNT(*) FROM deals d WHERE d.source = ls.name
                    AND d.created_at >= ? AND d.created_at <= ?) as leads_period,
                (SELECT COUNT(*) FROM deals d WHERE d.source = ls.name
                    AND d.won_at >= ? AND d.won_at <= ?) as won_period,
                (SELECT COALESCE(SUM(amount), 0) FROM deals d WHERE d.source = ls.name
                    AND d.won_at >= ? AND d.won_at <= ?) as revenue_period
            FROM lead_sources ls
            WHERE ls.project_id = ?
            ORDER BY leads_period DESC
        `).all(start, end, start, end, start, end, req.params.projectId);

        res.json({
            success: true,
            stats,
            period: { start, end }
        });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Regenerate webhook token
router.post('/:projectId/:integrationId/regenerate-token', (req, res) => {
    try {
        const db = getDb();

        const integration = db.prepare('SELECT settings FROM lead_sources WHERE id = ?')
            .get(req.params.integrationId);

        if (!integration) {
            return res.status(404).json({ success: false, error: 'Интеграция не найдена' });
        }

        const settings = JSON.parse(integration.settings || '{}');
        settings.webhook_token = crypto.randomBytes(32).toString('hex');

        db.prepare(`
            UPDATE lead_sources SET settings = ? WHERE id = ?
        `).run(JSON.stringify(settings), req.params.integrationId);

        res.json({
            success: true,
            webhook_token: settings.webhook_token
        });
    } catch (error) {
        console.error('Regenerate token error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// OUTGOING WEBHOOKS (for external notifications)
// ============================================================

// Get outgoing webhooks
router.get('/:projectId/outgoing', (req, res) => {
    try {
        const db = getDb();

        const webhooks = db.prepare(`
            SELECT * FROM automations
            WHERE project_id = ? AND action_type = 'webhook'
            ORDER BY created_at DESC
        `).all(req.params.projectId);

        res.json({
            success: true,
            webhooks: webhooks.map(w => ({
                ...w,
                trigger_config: JSON.parse(w.trigger_config || '{}'),
                action_config: JSON.parse(w.action_config || '{}')
            }))
        });
    } catch (error) {
        console.error('Get outgoing webhooks error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create outgoing webhook
router.post('/:projectId/outgoing', (req, res) => {
    try {
        const db = getDb();
        const id = uuidv4();
        const { name, trigger_type, trigger_config, url, headers, method } = req.body;

        if (!name || !trigger_type || !url) {
            return res.status(400).json({
                success: false,
                error: 'Название, триггер и URL обязательны'
            });
        }

        const validTriggers = [
            'deal_created',
            'deal_stage_changed',
            'deal_won',
            'deal_lost',
            'client_created',
            'task_completed',
            'call_completed'
        ];

        if (!validTriggers.includes(trigger_type)) {
            return res.status(400).json({
                success: false,
                error: `Неверный триггер. Допустимые: ${validTriggers.join(', ')}`
            });
        }

        const actionConfig = {
            url,
            method: method || 'POST',
            headers: headers || { 'Content-Type': 'application/json' }
        };

        db.prepare(`
            INSERT INTO automations (id, project_id, name, trigger_type, trigger_config, action_type, action_config)
            VALUES (?, ?, ?, ?, ?, 'webhook', ?)
        `).run(id, req.params.projectId, name, trigger_type, JSON.stringify(trigger_config || {}), JSON.stringify(actionConfig));

        const webhook = db.prepare('SELECT * FROM automations WHERE id = ?').get(id);

        res.json({
            success: true,
            webhook: {
                ...webhook,
                trigger_config: JSON.parse(webhook.trigger_config || '{}'),
                action_config: JSON.parse(webhook.action_config || '{}')
            }
        });
    } catch (error) {
        console.error('Create outgoing webhook error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Test outgoing webhook
router.post('/:projectId/outgoing/:webhookId/test', async (req, res) => {
    try {
        const db = getDb();

        const webhook = db.prepare('SELECT * FROM automations WHERE id = ?').get(req.params.webhookId);

        if (!webhook) {
            return res.status(404).json({ success: false, error: 'Webhook не найден' });
        }

        const actionConfig = JSON.parse(webhook.action_config || '{}');

        const testPayload = {
            event: 'test',
            timestamp: new Date().toISOString(),
            data: {
                message: 'Test webhook from CMS',
                project_id: req.params.projectId
            }
        };

        try {
            const response = await fetch(actionConfig.url, {
                method: actionConfig.method || 'POST',
                headers: actionConfig.headers || { 'Content-Type': 'application/json' },
                body: JSON.stringify(testPayload)
            });

            res.json({
                success: true,
                response: {
                    status: response.status,
                    statusText: response.statusText,
                    ok: response.ok
                }
            });
        } catch (fetchError) {
            res.json({
                success: false,
                error: fetchError.message
            });
        }
    } catch (error) {
        console.error('Test webhook error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// WIDGET EMBED CODE
// ============================================================

// Get widget embed code
router.get('/:projectId/:integrationId/embed', (req, res) => {
    try {
        const db = getDb();

        const integration = db.prepare(`
            SELECT * FROM lead_sources WHERE id = ? AND project_id = ?
        `).get(req.params.integrationId, req.params.projectId);

        if (!integration || integration.type !== 'widget') {
            return res.status(404).json({ success: false, error: 'Виджет не найден' });
        }

        const settings = JSON.parse(integration.settings || '{}');

        // Generate embed code
        const embedCode = `
<!-- ${integration.name} Widget -->
<script>
(function() {
    var w = window;
    var d = document;
    w.CMS_WIDGET = {
        projectId: '${req.params.projectId}',
        widgetId: '${req.params.integrationId}',
        color: '${settings.color || '#8b5cf6'}',
        position: '${settings.position || 'bottom-right'}',
        title: '${settings.title || 'Связаться с нами'}'
    };
    var s = d.createElement('script');
    s.async = true;
    s.src = '${process.env.APP_URL || ''}/widget.js';
    d.head.appendChild(s);
})();
</script>
<!-- End ${integration.name} Widget -->
        `.trim();

        res.json({
            success: true,
            embedCode,
            settings
        });
    } catch (error) {
        console.error('Get embed code error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;

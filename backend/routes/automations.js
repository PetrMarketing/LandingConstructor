const express = require('express');
const router = express.Router();
const { getDb } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// ============================================================
// AUTOMATIONS
// ============================================================

// Get all automations for project
router.get('/:projectId', (req, res) => {
    try {
        const db = getDb();
        const automations = db.prepare(`
            SELECT * FROM automations WHERE project_id = ? ORDER BY created_at DESC
        `).all(req.params.projectId);

        res.json({
            success: true,
            automations: automations.map(a => ({
                ...a,
                trigger_config: JSON.parse(a.trigger_config || '{}'),
                actions: JSON.parse(a.actions || '[]'),
                conditions: JSON.parse(a.conditions || '[]')
            }))
        });
    } catch (error) {
        console.error('Get automations error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get single automation
router.get('/:projectId/:automationId', (req, res) => {
    try {
        const db = getDb();
        const automation = db.prepare(`
            SELECT * FROM automations WHERE id = ? AND project_id = ?
        `).get(req.params.automationId, req.params.projectId);

        if (!automation) {
            return res.status(404).json({ success: false, error: 'Автоматизация не найдена' });
        }

        res.json({
            success: true,
            automation: {
                ...automation,
                trigger_config: JSON.parse(automation.trigger_config || '{}'),
                actions: JSON.parse(automation.actions || '[]'),
                conditions: JSON.parse(automation.conditions || '[]')
            }
        });
    } catch (error) {
        console.error('Get automation error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create automation
router.post('/:projectId', (req, res) => {
    try {
        const db = getDb();
        const id = uuidv4();
        const { name, trigger_type, trigger_config, conditions, actions, is_active } = req.body;

        if (!name || !trigger_type) {
            return res.status(400).json({ success: false, error: 'Название и триггер обязательны' });
        }

        db.prepare(`
            INSERT INTO automations (id, project_id, name, trigger_type, trigger_config, conditions, actions, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            id, req.params.projectId, name, trigger_type,
            JSON.stringify(trigger_config || {}),
            JSON.stringify(conditions || []),
            JSON.stringify(actions || []),
            is_active !== false ? 1 : 0
        );

        const automation = db.prepare('SELECT * FROM automations WHERE id = ?').get(id);

        res.json({
            success: true,
            automation: {
                ...automation,
                trigger_config: JSON.parse(automation.trigger_config || '{}'),
                actions: JSON.parse(automation.actions || '[]'),
                conditions: JSON.parse(automation.conditions || '[]')
            }
        });
    } catch (error) {
        console.error('Create automation error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update automation
router.put('/:projectId/:automationId', (req, res) => {
    try {
        const db = getDb();
        const { name, trigger_type, trigger_config, conditions, actions, is_active } = req.body;

        db.prepare(`
            UPDATE automations SET
                name = COALESCE(?, name),
                trigger_type = COALESCE(?, trigger_type),
                trigger_config = COALESCE(?, trigger_config),
                conditions = COALESCE(?, conditions),
                actions = COALESCE(?, actions),
                is_active = COALESCE(?, is_active),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND project_id = ?
        `).run(
            name, trigger_type,
            trigger_config ? JSON.stringify(trigger_config) : null,
            conditions ? JSON.stringify(conditions) : null,
            actions ? JSON.stringify(actions) : null,
            is_active !== undefined ? (is_active ? 1 : 0) : null,
            req.params.automationId, req.params.projectId
        );

        const automation = db.prepare('SELECT * FROM automations WHERE id = ?').get(req.params.automationId);

        res.json({
            success: true,
            automation: {
                ...automation,
                trigger_config: JSON.parse(automation.trigger_config || '{}'),
                actions: JSON.parse(automation.actions || '[]'),
                conditions: JSON.parse(automation.conditions || '[]')
            }
        });
    } catch (error) {
        console.error('Update automation error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Toggle automation status
router.patch('/:projectId/:automationId/toggle', (req, res) => {
    try {
        const db = getDb();

        const current = db.prepare('SELECT is_active FROM automations WHERE id = ?').get(req.params.automationId);
        const newStatus = current?.is_active ? 0 : 1;

        db.prepare('UPDATE automations SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(newStatus, req.params.automationId);

        res.json({ success: true, is_active: !!newStatus });
    } catch (error) {
        console.error('Toggle automation error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete automation
router.delete('/:projectId/:automationId', (req, res) => {
    try {
        const db = getDb();
        db.prepare('DELETE FROM automations WHERE id = ? AND project_id = ?')
            .run(req.params.automationId, req.params.projectId);

        res.json({ success: true });
    } catch (error) {
        console.error('Delete automation error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Test automation (dry run)
router.post('/:projectId/:automationId/test', (req, res) => {
    try {
        const db = getDb();
        const automation = db.prepare('SELECT * FROM automations WHERE id = ?').get(req.params.automationId);

        if (!automation) {
            return res.status(404).json({ success: false, error: 'Автоматизация не найдена' });
        }

        const actions = JSON.parse(automation.actions || '[]');
        const testResults = [];

        for (const action of actions) {
            testResults.push({
                action: action.type,
                status: 'simulated',
                description: getActionDescription(action)
            });
        }

        res.json({
            success: true,
            testResults
        });
    } catch (error) {
        console.error('Test automation error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get available triggers
router.get('/:projectId/config/triggers', (req, res) => {
    res.json({
        success: true,
        triggers: [
            { type: 'deal_created', name: 'Создана сделка', category: 'deals' },
            { type: 'deal_stage_changed', name: 'Сделка перешла на этап', category: 'deals' },
            { type: 'deal_won', name: 'Сделка выиграна', category: 'deals' },
            { type: 'deal_lost', name: 'Сделка проиграна', category: 'deals' },
            { type: 'client_created', name: 'Создан клиент', category: 'clients' },
            { type: 'order_created', name: 'Создан заказ', category: 'orders' },
            { type: 'order_status_changed', name: 'Статус заказа изменен', category: 'orders' },
            { type: 'order_paid', name: 'Заказ оплачен', category: 'orders' },
            { type: 'task_overdue', name: 'Задача просрочена', category: 'tasks' },
            { type: 'form_submitted', name: 'Отправлена форма', category: 'forms' },
            { type: 'schedule', name: 'По расписанию', category: 'system' }
        ]
    });
});

// Get available actions
router.get('/:projectId/config/actions', (req, res) => {
    res.json({
        success: true,
        actions: [
            { type: 'send_email', name: 'Отправить email', category: 'communication' },
            { type: 'send_sms', name: 'Отправить SMS', category: 'communication' },
            { type: 'send_telegram', name: 'Отправить в Telegram', category: 'communication' },
            { type: 'create_task', name: 'Создать задачу', category: 'tasks' },
            { type: 'assign_manager', name: 'Назначить менеджера', category: 'assignments' },
            { type: 'add_to_segment', name: 'Добавить в сегмент', category: 'segments' },
            { type: 'add_tag', name: 'Добавить тег', category: 'tags' },
            { type: 'update_field', name: 'Обновить поле', category: 'data' },
            { type: 'add_loyalty_points', name: 'Начислить баллы', category: 'loyalty' },
            { type: 'webhook', name: 'Вызвать webhook', category: 'integrations' },
            { type: 'delay', name: 'Задержка', category: 'flow' }
        ]
    });
});

function getActionDescription(action) {
    const descriptions = {
        send_email: `Отправить email: ${action.config?.template || 'шаблон не указан'}`,
        send_sms: `Отправить SMS: ${action.config?.message?.slice(0, 50) || 'сообщение'}...`,
        create_task: `Создать задачу: ${action.config?.title || 'без названия'}`,
        assign_manager: `Назначить менеджера: ${action.config?.manager_id || 'автоматически'}`,
        add_to_segment: `Добавить в сегмент: ${action.config?.segment_id || 'не указан'}`,
        add_tag: `Добавить тег: ${action.config?.tag || 'не указан'}`,
        add_loyalty_points: `Начислить баллов: ${action.config?.points || 0}`,
        webhook: `Вызвать: ${action.config?.url || 'URL не указан'}`,
        delay: `Подождать: ${action.config?.duration || 0} мин`
    };
    return descriptions[action.type] || action.type;
}

module.exports = router;

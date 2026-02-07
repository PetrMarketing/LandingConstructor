const express = require('express');
const router = express.Router();
const { getDb } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// ============================================================
// REGULATIONS (SLA - amoCRM-like)
// ============================================================

// Get all regulations for project
router.get('/:projectId', (req, res) => {
    try {
        const db = getDb();
        const { funnel_id, entity_type, is_active } = req.query;

        let query = `
            SELECT r.*,
                f.name as funnel_name,
                fs.name as stage_name
            FROM regulations r
            LEFT JOIN funnels f ON f.id = r.funnel_id
            LEFT JOIN funnel_stages fs ON fs.id = r.stage_id
            WHERE r.project_id = ?
        `;
        const params = [req.params.projectId];

        if (funnel_id) {
            query += ` AND r.funnel_id = ?`;
            params.push(funnel_id);
        }
        if (entity_type) {
            query += ` AND r.entity_type = ?`;
            params.push(entity_type);
        }
        if (is_active !== undefined) {
            query += ` AND r.is_active = ?`;
            params.push(is_active === 'true' ? 1 : 0);
        }

        query += ` ORDER BY r.priority DESC, r.created_at DESC`;

        const regulations = db.prepare(query).all(...params);

        res.json({
            success: true,
            regulations: regulations.map(r => ({
                ...r,
                action_config: JSON.parse(r.action_config || '{}'),
                notification_employees: JSON.parse(r.notification_employees || '[]'),
                content: r.content ? (typeof r.content === 'string' ? JSON.parse(r.content) : r.content) : [],
                access: r.access ? (typeof r.access === 'string' ? JSON.parse(r.access) : r.access) : [],
                access_all: r.access_all !== undefined ? !!r.access_all : true
            }))
        });
    } catch (error) {
        console.error('Get regulations error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get single regulation with logs
router.get('/:projectId/:regulationId', (req, res) => {
    try {
        const db = getDb();
        const regulation = db.prepare(`
            SELECT r.*,
                f.name as funnel_name,
                fs.name as stage_name
            FROM regulations r
            LEFT JOIN funnels f ON f.id = r.funnel_id
            LEFT JOIN funnel_stages fs ON fs.id = r.stage_id
            WHERE r.id = ? AND r.project_id = ?
        `).get(req.params.regulationId, req.params.projectId);

        if (!regulation) {
            return res.status(404).json({ success: false, error: 'Регламент не найден' });
        }

        // Get recent logs
        const logs = db.prepare(`
            SELECT * FROM regulation_logs
            WHERE regulation_id = ?
            ORDER BY executed_at DESC
            LIMIT 50
        `).all(regulation.id);

        res.json({
            success: true,
            regulation: {
                ...regulation,
                action_config: JSON.parse(regulation.action_config || '{}'),
                notification_employees: JSON.parse(regulation.notification_employees || '[]')
            },
            logs
        });
    } catch (error) {
        console.error('Get regulation error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create regulation
router.post('/:projectId', (req, res) => {
    try {
        const db = getDb();
        const id = uuidv4();
        const {
            name, description, entity_type, funnel_id, stage_id, condition_type, condition_value,
            condition_unit, action_type, action_config, notification_employees, priority,
            content, access, access_all, updated_at
        } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                error: 'Название обязательно'
            });
        }

        // Document-style regulation (Notion-like editor)
        if (content !== undefined) {
            db.prepare(`
                INSERT INTO regulations (
                    id, project_id, name, description, content, access, access_all,
                    condition_type, condition_value, action_type, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, '', 0, '', ?)
            `).run(
                id, req.params.projectId, name, description || '',
                typeof content === 'string' ? content : JSON.stringify(content || []),
                typeof access === 'string' ? access : JSON.stringify(access || []),
                access_all !== undefined ? (access_all ? 1 : 0) : 1,
                updated_at || new Date().toISOString()
            );
        } else {
            // SLA-style regulation (legacy)
            if (!condition_type || !condition_value || !action_type) {
                return res.status(400).json({
                    success: false,
                    error: 'Название, условие и действие обязательны'
                });
            }

            db.prepare(`
                INSERT INTO regulations (
                    id, project_id, name, entity_type, funnel_id, stage_id,
                    condition_type, condition_value, condition_unit, action_type,
                    action_config, notification_employees, priority
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                id, req.params.projectId, name, entity_type || 'deal',
                funnel_id, stage_id, condition_type, condition_value,
                condition_unit || 'hours', action_type,
                JSON.stringify(action_config || {}),
                JSON.stringify(notification_employees || []),
                priority || 0
            );
        }

        const regulation = db.prepare('SELECT * FROM regulations WHERE id = ?').get(id);

        res.json({
            success: true,
            regulation: {
                ...regulation,
                action_config: JSON.parse(regulation.action_config || '{}'),
                notification_employees: JSON.parse(regulation.notification_employees || '[]')
            }
        });
    } catch (error) {
        console.error('Create regulation error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update regulation
router.put('/:projectId/:regulationId', (req, res) => {
    try {
        const db = getDb();
        const {
            name, description, entity_type, funnel_id, stage_id, condition_type, condition_value,
            condition_unit, action_type, action_config, notification_employees, priority, is_active,
            content, access, access_all, updated_at
        } = req.body;

        // Document-style update
        if (content !== undefined) {
            db.prepare(`
                UPDATE regulations SET
                    name = COALESCE(?, name),
                    description = COALESCE(?, description),
                    content = ?,
                    access = ?,
                    access_all = ?,
                    updated_at = COALESCE(?, CURRENT_TIMESTAMP)
                WHERE id = ? AND project_id = ?
            `).run(
                name, description || '',
                typeof content === 'string' ? content : JSON.stringify(content || []),
                typeof access === 'string' ? access : JSON.stringify(access || []),
                access_all !== undefined ? (access_all ? 1 : 0) : 1,
                updated_at || new Date().toISOString(),
                req.params.regulationId, req.params.projectId
            );
        } else {
            // SLA-style update
            db.prepare(`
                UPDATE regulations SET
                    name = COALESCE(?, name),
                    entity_type = COALESCE(?, entity_type),
                    funnel_id = COALESCE(?, funnel_id),
                    stage_id = COALESCE(?, stage_id),
                    condition_type = COALESCE(?, condition_type),
                    condition_value = COALESCE(?, condition_value),
                    condition_unit = COALESCE(?, condition_unit),
                    action_type = COALESCE(?, action_type),
                    action_config = COALESCE(?, action_config),
                    notification_employees = COALESCE(?, notification_employees),
                    priority = COALESCE(?, priority),
                    is_active = COALESCE(?, is_active),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND project_id = ?
            `).run(
                name, entity_type, funnel_id, stage_id, condition_type, condition_value,
                condition_unit, action_type,
                action_config ? JSON.stringify(action_config) : null,
                notification_employees ? JSON.stringify(notification_employees) : null,
                priority, is_active !== undefined ? (is_active ? 1 : 0) : null,
                req.params.regulationId, req.params.projectId
            );
        }

        const regulation = db.prepare('SELECT * FROM regulations WHERE id = ?').get(req.params.regulationId);

        res.json({
            success: true,
            regulation: {
                ...regulation,
                action_config: JSON.parse(regulation.action_config || '{}'),
                notification_employees: JSON.parse(regulation.notification_employees || '[]')
            }
        });
    } catch (error) {
        console.error('Update regulation error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete regulation
router.delete('/:projectId/:regulationId', (req, res) => {
    try {
        const db = getDb();
        db.prepare('DELETE FROM regulations WHERE id = ? AND project_id = ?')
            .run(req.params.regulationId, req.params.projectId);

        res.json({ success: true });
    } catch (error) {
        console.error('Delete regulation error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Check and execute regulations (to be called by cron)
router.post('/:projectId/check', async (req, res) => {
    try {
        const db = getDb();
        const executed = [];

        // Get all active regulations
        const regulations = db.prepare(`
            SELECT * FROM regulations
            WHERE project_id = ? AND is_active = 1
            ORDER BY priority DESC
        `).all(req.params.projectId);

        for (const regulation of regulations) {
            const actionConfig = JSON.parse(regulation.action_config || '{}');
            let entitiesQuery = '';
            const queryParams = [req.params.projectId];

            // Build query based on condition
            switch (regulation.condition_type) {
                case 'time_in_stage':
                    // Deals that have been in the same stage for too long
                    const stageHours = regulation.condition_unit === 'days'
                        ? regulation.condition_value * 24
                        : regulation.condition_value;
                    entitiesQuery = `
                        SELECT d.* FROM deals d
                        WHERE d.project_id = ?
                        AND d.stage_id = ?
                        AND d.won_at IS NULL AND d.lost_at IS NULL
                        AND datetime(d.updated_at, '+${stageHours} hours') < datetime('now')
                    `;
                    queryParams.push(regulation.stage_id);
                    break;

                case 'time_since_created':
                    const createdHours = regulation.condition_unit === 'days'
                        ? regulation.condition_value * 24
                        : regulation.condition_value;
                    entitiesQuery = `
                        SELECT d.* FROM deals d
                        WHERE d.project_id = ?
                        AND d.won_at IS NULL AND d.lost_at IS NULL
                        AND datetime(d.created_at, '+${createdHours} hours') < datetime('now')
                        ${regulation.stage_id ? 'AND d.stage_id = ?' : ''}
                    `;
                    if (regulation.stage_id) queryParams.push(regulation.stage_id);
                    break;

                case 'no_activity':
                    const activityHours = regulation.condition_unit === 'days'
                        ? regulation.condition_value * 24
                        : regulation.condition_value;
                    entitiesQuery = `
                        SELECT d.* FROM deals d
                        WHERE d.project_id = ?
                        AND d.won_at IS NULL AND d.lost_at IS NULL
                        AND datetime(d.updated_at, '+${activityHours} hours') < datetime('now')
                        AND NOT EXISTS (
                            SELECT 1 FROM client_interactions ci
                            WHERE ci.deal_id = d.id
                            AND datetime(ci.created_at, '+${activityHours} hours') > datetime('now')
                        )
                        ${regulation.stage_id ? 'AND d.stage_id = ?' : ''}
                    `;
                    if (regulation.stage_id) queryParams.push(regulation.stage_id);
                    break;

                case 'no_tasks':
                    entitiesQuery = `
                        SELECT d.* FROM deals d
                        WHERE d.project_id = ?
                        AND d.won_at IS NULL AND d.lost_at IS NULL
                        AND NOT EXISTS (
                            SELECT 1 FROM tasks t
                            WHERE t.deal_id = d.id AND t.status != 'completed'
                        )
                        ${regulation.stage_id ? 'AND d.stage_id = ?' : ''}
                    `;
                    if (regulation.stage_id) queryParams.push(regulation.stage_id);
                    break;

                default:
                    continue;
            }

            if (!entitiesQuery) continue;

            const entities = db.prepare(entitiesQuery).all(...queryParams);

            for (const entity of entities) {
                // Check if already executed recently (avoid duplicates)
                const recentLog = db.prepare(`
                    SELECT id FROM regulation_logs
                    WHERE regulation_id = ? AND entity_id = ?
                    AND datetime(executed_at, '+1 day') > datetime('now')
                `).get(regulation.id, entity.id);

                if (recentLog) continue;

                // Execute action
                let actionResult = 'pending';
                try {
                    switch (regulation.action_type) {
                        case 'create_task':
                            const taskId = uuidv4();
                            db.prepare(`
                                INSERT INTO tasks (id, project_id, title, deal_id, assignee_id, priority, due_date)
                                VALUES (?, ?, ?, ?, ?, ?, datetime('now', '+1 day'))
                            `).run(
                                taskId, req.params.projectId,
                                actionConfig.task_title || `[Регламент] ${regulation.name}`,
                                entity.id, entity.assigned_to, actionConfig.priority || 'high'
                            );
                            actionResult = 'task_created';
                            break;

                        case 'move_stage':
                            if (actionConfig.target_stage_id) {
                                db.prepare(`
                                    UPDATE deals SET stage_id = ?, updated_at = CURRENT_TIMESTAMP
                                    WHERE id = ?
                                `).run(actionConfig.target_stage_id, entity.id);
                                actionResult = 'stage_moved';
                            }
                            break;

                        case 'add_tag':
                            if (actionConfig.tag) {
                                const currentTags = JSON.parse(entity.tags || '[]');
                                if (!currentTags.includes(actionConfig.tag)) {
                                    currentTags.push(actionConfig.tag);
                                    db.prepare(`
                                        UPDATE deals SET tags = ?, updated_at = CURRENT_TIMESTAMP
                                        WHERE id = ?
                                    `).run(JSON.stringify(currentTags), entity.id);
                                }
                                actionResult = 'tag_added';
                            }
                            break;

                        case 'notify_employee':
                        case 'notify_manager':
                            // Create notification
                            const notifId = uuidv4();
                            const recipientId = regulation.action_type === 'notify_manager'
                                ? actionConfig.manager_id
                                : entity.assigned_to;

                            if (recipientId) {
                                db.prepare(`
                                    INSERT INTO notifications (id, project_id, recipient_type, recipient_id, type, title, message, link)
                                    VALUES (?, ?, 'employee', ?, 'regulation_alert', ?, ?, ?)
                                `).run(
                                    notifId, req.params.projectId, recipientId,
                                    `Регламент: ${regulation.name}`,
                                    actionConfig.message || `Сделка "${entity.name}" требует внимания`,
                                    `/deals/${entity.id}`
                                );
                            }
                            actionResult = 'notified';
                            break;
                    }
                } catch (e) {
                    actionResult = `error: ${e.message}`;
                }

                // Log execution
                db.prepare(`
                    INSERT INTO regulation_logs (id, regulation_id, entity_type, entity_id, action_taken, result)
                    VALUES (?, ?, ?, ?, ?, ?)
                `).run(uuidv4(), regulation.id, regulation.entity_type, entity.id, regulation.action_type, actionResult);

                executed.push({
                    regulation_id: regulation.id,
                    regulation_name: regulation.name,
                    entity_id: entity.id,
                    entity_name: entity.name,
                    action: regulation.action_type,
                    result: actionResult
                });
            }
        }

        res.json({ success: true, executed, count: executed.length });
    } catch (error) {
        console.error('Check regulations error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get regulation templates
router.get('/:projectId/templates/list', (req, res) => {
    const templates = [
        {
            name: 'Сделка зависла на этапе',
            entity_type: 'deal',
            condition_type: 'time_in_stage',
            condition_value: 24,
            condition_unit: 'hours',
            action_type: 'notify_employee',
            description: 'Уведомить менеджера, если сделка на этапе более 24 часов'
        },
        {
            name: 'Нет активности по сделке',
            entity_type: 'deal',
            condition_type: 'no_activity',
            condition_value: 3,
            condition_unit: 'days',
            action_type: 'create_task',
            description: 'Создать задачу "Связаться с клиентом", если нет активности 3 дня'
        },
        {
            name: 'Сделка без задач',
            entity_type: 'deal',
            condition_type: 'no_tasks',
            condition_value: 1,
            condition_unit: 'days',
            action_type: 'create_task',
            description: 'Создать задачу, если у сделки нет активных задач'
        },
        {
            name: 'Эскалация руководителю',
            entity_type: 'deal',
            condition_type: 'time_in_stage',
            condition_value: 7,
            condition_unit: 'days',
            action_type: 'notify_manager',
            description: 'Уведомить руководителя, если сделка на этапе более 7 дней'
        }
    ];

    res.json({ success: true, templates });
});

module.exports = router;

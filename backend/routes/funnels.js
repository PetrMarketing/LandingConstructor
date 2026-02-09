const express = require('express');
const router = express.Router();
const { getDb } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// ============================================================
// FUNNELS
// ============================================================

// Get all funnels for project
router.get('/:projectId', (req, res) => {
    try {
        const db = getDb();
        const funnels = db.prepare(`
            SELECT f.*,
                (SELECT COUNT(*) FROM deals WHERE funnel_id = f.id) as deals_count,
                (SELECT SUM(amount) FROM deals WHERE funnel_id = f.id AND won_at IS NOT NULL) as won_amount
            FROM funnels f
            WHERE f.project_id = ?
            ORDER BY f.is_default DESC, f.name
        `).all(req.params.projectId);

        // Get stages for each funnel
        const funnelsWithStages = funnels.map(funnel => {
            const stages = db.prepare(`
                SELECT fs.*,
                    (SELECT COUNT(*) FROM deals WHERE stage_id = fs.id) as deals_count,
                    (SELECT SUM(amount) FROM deals WHERE stage_id = fs.id) as total_amount
                FROM funnel_stages fs
                WHERE fs.funnel_id = ?
                ORDER BY fs.sort_order
            `).all(funnel.id);

            return {
                ...funnel,
                stages: stages.map(s => ({
                    ...s,
                    auto_actions: JSON.parse(s.auto_actions || '[]')
                }))
            };
        });

        res.json({ success: true, funnels: funnelsWithStages });
    } catch (error) {
        console.error('Get funnels error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get single funnel with stages and deals
router.get('/:projectId/:funnelId', (req, res) => {
    try {
        const db = getDb();
        const funnel = db.prepare(`
            SELECT * FROM funnels WHERE id = ? AND project_id = ?
        `).get(req.params.funnelId, req.params.projectId);

        if (!funnel) {
            return res.status(404).json({ success: false, error: 'Воронка не найдена' });
        }

        const stages = db.prepare(`
            SELECT * FROM funnel_stages WHERE funnel_id = ? ORDER BY sort_order
        `).all(funnel.id);

        const deals = db.prepare(`
            SELECT d.*,
                c.first_name as client_first_name, c.last_name as client_last_name, c.email as client_email,
                e.first_name as assignee_first_name, e.last_name as assignee_last_name
            FROM deals d
            LEFT JOIN clients c ON c.id = d.client_id
            LEFT JOIN employees e ON e.id = d.assigned_to
            WHERE d.funnel_id = ?
            ORDER BY d.updated_at DESC
        `).all(funnel.id);

        res.json({
            success: true,
            funnel: {
                ...funnel,
                stages: stages.map(s => ({
                    ...s,
                    auto_actions: JSON.parse(s.auto_actions || '[]'),
                    deals: deals.filter(d => d.stage_id === s.id).map(d => ({
                        ...d,
                        tags: JSON.parse(d.tags || '[]'),
                        custom_fields: JSON.parse(d.custom_fields || '{}')
                    }))
                }))
            }
        });
    } catch (error) {
        console.error('Get funnel error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create funnel
router.post('/:projectId', (req, res) => {
    try {
        const db = getDb();
        const id = uuidv4();
        const { name, slug, description, is_default, stages } = req.body;

        if (!name) {
            return res.status(400).json({ success: false, error: 'Название воронки обязательно' });
        }

        // If setting as default, unset other defaults
        if (is_default) {
            db.prepare('UPDATE funnels SET is_default = 0 WHERE project_id = ?').run(req.params.projectId);
        }

        db.prepare(`
            INSERT INTO funnels (id, project_id, name, slug, description, is_default)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(id, req.params.projectId, name, slug || name.toLowerCase().replace(/\s+/g, '-'),
            description, is_default ? 1 : 0);

        // Create default stages if none provided
        const defaultStages = stages || [
            { name: 'Новая', color: '#94a3b8' },
            { name: 'В работе', color: '#3b82f6' },
            { name: 'Переговоры', color: '#f59e0b' },
            { name: 'Успешно', color: '#22c55e', is_won: true },
            { name: 'Отказ', color: '#ef4444', is_lost: true }
        ];

        defaultStages.forEach((stage, index) => {
            db.prepare(`
                INSERT INTO funnel_stages (id, funnel_id, name, color, sort_order, is_won, is_lost)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(uuidv4(), id, stage.name, stage.color, index,
                stage.is_won ? 1 : 0, stage.is_lost ? 1 : 0);
        });

        const funnel = db.prepare('SELECT * FROM funnels WHERE id = ?').get(id);
        const createdStages = db.prepare('SELECT * FROM funnel_stages WHERE funnel_id = ? ORDER BY sort_order').all(id);

        res.json({
            success: true,
            funnel: {
                ...funnel,
                stages: createdStages
            }
        });
    } catch (error) {
        console.error('Create funnel error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update funnel
router.put('/:projectId/:funnelId', (req, res) => {
    try {
        const db = getDb();
        const { name, description, is_default, is_active } = req.body;

        if (is_default) {
            db.prepare('UPDATE funnels SET is_default = 0 WHERE project_id = ?').run(req.params.projectId);
        }

        db.prepare(`
            UPDATE funnels SET
                name = COALESCE(?, name),
                description = COALESCE(?, description),
                is_default = COALESCE(?, is_default),
                is_active = COALESCE(?, is_active),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND project_id = ?
        `).run(name, description, is_default ? 1 : null, is_active !== undefined ? (is_active ? 1 : 0) : null,
            req.params.funnelId, req.params.projectId);

        const funnel = db.prepare('SELECT * FROM funnels WHERE id = ?').get(req.params.funnelId);

        res.json({ success: true, funnel });
    } catch (error) {
        console.error('Update funnel error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete funnel
router.delete('/:projectId/:funnelId', (req, res) => {
    try {
        const db = getDb();

        // Check if has deals
        const { count } = db.prepare('SELECT COUNT(*) as count FROM deals WHERE funnel_id = ?')
            .get(req.params.funnelId);

        if (count > 0) {
            return res.status(400).json({
                success: false,
                error: `Невозможно удалить воронку с ${count} сделками. Сначала переместите или удалите сделки.`
            });
        }

        db.prepare('DELETE FROM funnels WHERE id = ? AND project_id = ?')
            .run(req.params.funnelId, req.params.projectId);

        res.json({ success: true });
    } catch (error) {
        console.error('Delete funnel error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// STAGES
// ============================================================

// Add stage to funnel
router.post('/:projectId/:funnelId/stages', (req, res) => {
    try {
        const db = getDb();
        const id = uuidv4();
        const { name, color, sort_order, is_won, is_lost, auto_actions } = req.body;

        // Get max sort order if not provided
        let order = sort_order;
        if (order === undefined) {
            const max = db.prepare('SELECT MAX(sort_order) as max FROM funnel_stages WHERE funnel_id = ?')
                .get(req.params.funnelId);
            order = (max?.max || 0) + 1;
        }

        db.prepare(`
            INSERT INTO funnel_stages (id, funnel_id, name, color, sort_order, is_won, is_lost, auto_actions)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, req.params.funnelId, name, color || '#94a3b8', order,
            is_won ? 1 : 0, is_lost ? 1 : 0, JSON.stringify(auto_actions || []));

        const stage = db.prepare('SELECT * FROM funnel_stages WHERE id = ?').get(id);

        res.json({
            success: true,
            stage: {
                ...stage,
                auto_actions: JSON.parse(stage.auto_actions || '[]')
            }
        });
    } catch (error) {
        console.error('Create stage error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update stage
router.put('/:projectId/:funnelId/stages/:stageId', (req, res) => {
    try {
        const db = getDb();
        const { name, color, sort_order, is_won, is_lost, auto_actions } = req.body;

        db.prepare(`
            UPDATE funnel_stages SET
                name = COALESCE(?, name),
                color = COALESCE(?, color),
                sort_order = COALESCE(?, sort_order),
                is_won = COALESCE(?, is_won),
                is_lost = COALESCE(?, is_lost),
                auto_actions = COALESCE(?, auto_actions)
            WHERE id = ? AND funnel_id = ?
        `).run(name, color, sort_order, is_won !== undefined ? (is_won ? 1 : 0) : null,
            is_lost !== undefined ? (is_lost ? 1 : 0) : null,
            auto_actions ? JSON.stringify(auto_actions) : null,
            req.params.stageId, req.params.funnelId);

        const stage = db.prepare('SELECT * FROM funnel_stages WHERE id = ?').get(req.params.stageId);

        res.json({
            success: true,
            stage: {
                ...stage,
                auto_actions: JSON.parse(stage.auto_actions || '[]')
            }
        });
    } catch (error) {
        console.error('Update stage error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Reorder stages
router.put('/:projectId/:funnelId/stages/reorder', (req, res) => {
    try {
        const db = getDb();
        const { stages } = req.body; // Array of { id, sort_order }

        const updateStmt = db.prepare('UPDATE funnel_stages SET sort_order = ? WHERE id = ?');
        const updateMany = db.transaction((stages) => {
            for (const stage of stages) {
                updateStmt.run(stage.sort_order, stage.id);
            }
        });

        updateMany(stages);

        res.json({ success: true });
    } catch (error) {
        console.error('Reorder stages error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete stage
router.delete('/:projectId/:funnelId/stages/:stageId', (req, res) => {
    try {
        const db = getDb();
        const { move_deals_to } = req.query;

        // Move deals to another stage if specified
        if (move_deals_to) {
            db.prepare('UPDATE deals SET stage_id = ? WHERE stage_id = ?')
                .run(move_deals_to, req.params.stageId);
        }

        db.prepare('DELETE FROM funnel_stages WHERE id = ? AND funnel_id = ?')
            .run(req.params.stageId, req.params.funnelId);

        res.json({ success: true });
    } catch (error) {
        console.error('Delete stage error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// DEALS
// ============================================================

// Get all deals for project
router.get('/:projectId/deals/list', (req, res) => {
    try {
        const db = getDb();
        const { funnel_id, stage_id, assigned_to, client_id, status, limit = 100 } = req.query;

        let query = `
            SELECT d.*,
                c.first_name as client_first_name, c.last_name as client_last_name, c.email as client_email,
                e.first_name as assignee_first_name, e.last_name as assignee_last_name,
                fs.name as stage_name, fs.color as stage_color,
                f.name as funnel_name
            FROM deals d
            LEFT JOIN clients c ON c.id = d.client_id
            LEFT JOIN employees e ON e.id = d.assigned_to
            LEFT JOIN funnel_stages fs ON fs.id = d.stage_id
            LEFT JOIN funnels f ON f.id = d.funnel_id
            WHERE d.project_id = ?
        `;
        const params = [req.params.projectId];

        if (funnel_id) {
            query += ` AND d.funnel_id = ?`;
            params.push(funnel_id);
        }
        if (stage_id) {
            query += ` AND d.stage_id = ?`;
            params.push(stage_id);
        }
        if (assigned_to) {
            query += ` AND d.assigned_to = ?`;
            params.push(assigned_to);
        }
        if (client_id) {
            query += ` AND d.client_id = ?`;
            params.push(client_id);
        }
        if (status === 'won') {
            query += ` AND d.won_at IS NOT NULL`;
        } else if (status === 'lost') {
            query += ` AND d.lost_at IS NOT NULL`;
        } else if (status === 'active') {
            query += ` AND d.won_at IS NULL AND d.lost_at IS NULL`;
        }

        query += ` ORDER BY d.updated_at DESC LIMIT ?`;
        params.push(Number(limit));

        const deals = db.prepare(query).all(...params);

        res.json({
            success: true,
            deals: deals.map(d => ({
                ...d,
                tags: JSON.parse(d.tags || '[]'),
                custom_fields: JSON.parse(d.custom_fields || '{}')
            }))
        });
    } catch (error) {
        console.error('Get deals error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get single deal
router.get('/:projectId/deals/:dealId', (req, res) => {
    try {
        const db = getDb();
        const deal = db.prepare(`
            SELECT d.*,
                c.first_name as client_first_name, c.last_name as client_last_name, c.email as client_email, c.phone as client_phone,
                e.first_name as assignee_first_name, e.last_name as assignee_last_name,
                fs.name as stage_name, fs.color as stage_color,
                f.name as funnel_name
            FROM deals d
            LEFT JOIN clients c ON c.id = d.client_id
            LEFT JOIN employees e ON e.id = d.assigned_to
            LEFT JOIN funnel_stages fs ON fs.id = d.stage_id
            LEFT JOIN funnels f ON f.id = d.funnel_id
            WHERE d.id = ? AND d.project_id = ?
        `).get(req.params.dealId, req.params.projectId);

        if (!deal) {
            return res.status(404).json({ success: false, error: 'Сделка не найдена' });
        }

        // Get stage history
        const history = db.prepare(`
            SELECT dsh.*,
                fs_from.name as from_stage_name,
                fs_to.name as to_stage_name,
                e.first_name as employee_first_name, e.last_name as employee_last_name
            FROM deal_stage_history dsh
            LEFT JOIN funnel_stages fs_from ON fs_from.id = dsh.from_stage_id
            LEFT JOIN funnel_stages fs_to ON fs_to.id = dsh.to_stage_id
            LEFT JOIN employees e ON e.id = dsh.employee_id
            WHERE dsh.deal_id = ?
            ORDER BY dsh.created_at DESC
        `).all(deal.id);

        // Get tasks
        const tasks = db.prepare(`
            SELECT * FROM tasks WHERE deal_id = ? ORDER BY due_date, created_at
        `).all(deal.id);

        res.json({
            success: true,
            deal: {
                ...deal,
                tags: JSON.parse(deal.tags || '[]'),
                custom_fields: JSON.parse(deal.custom_fields || '{}')
            },
            history,
            tasks
        });
    } catch (error) {
        console.error('Get deal error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create deal
router.post('/:projectId/deals', (req, res) => {
    try {
        const db = getDb();
        const id = uuidv4();
        const {
            name, client_id, funnel_id, stage_id, amount, currency,
            probability, expected_close_date, assigned_to, source,
            utm_source, utm_medium, utm_campaign, tags, custom_fields, notes
        } = req.body;

        if (!name) {
            return res.status(400).json({ success: false, error: 'Название сделки обязательно' });
        }

        // Get default funnel and first stage if not specified
        let funnelId = funnel_id;
        let stageId = stage_id;

        if (!funnelId) {
            const defaultFunnel = db.prepare(`
                SELECT id FROM funnels WHERE project_id = ? AND is_default = 1 LIMIT 1
            `).get(req.params.projectId);

            if (!defaultFunnel) {
                const anyFunnel = db.prepare(`
                    SELECT id FROM funnels WHERE project_id = ? LIMIT 1
                `).get(req.params.projectId);
                funnelId = anyFunnel?.id;
            } else {
                funnelId = defaultFunnel.id;
            }
        }

        if (!stageId && funnelId) {
            const firstStage = db.prepare(`
                SELECT id FROM funnel_stages WHERE funnel_id = ? ORDER BY sort_order LIMIT 1
            `).get(funnelId);
            stageId = firstStage?.id;
        }

        db.prepare(`
            INSERT INTO deals (
                id, project_id, name, client_id, funnel_id, stage_id, amount, currency,
                probability, expected_close_date, assigned_to, source,
                utm_source, utm_medium, utm_campaign, tags, custom_fields, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            id, req.params.projectId, name, client_id, funnelId, stageId,
            amount || 0, currency || 'RUB', probability || 50, expected_close_date,
            assigned_to, source, utm_source, utm_medium, utm_campaign,
            JSON.stringify(tags || []), JSON.stringify(custom_fields || {}), notes
        );

        // Log initial stage
        if (stageId) {
            db.prepare(`
                INSERT INTO deal_stage_history (id, deal_id, to_stage_id)
                VALUES (?, ?, ?)
            `).run(uuidv4(), id, stageId);
        }

        const deal = db.prepare('SELECT * FROM deals WHERE id = ?').get(id);

        res.json({
            success: true,
            deal: {
                ...deal,
                tags: JSON.parse(deal.tags || '[]'),
                custom_fields: JSON.parse(deal.custom_fields || '{}')
            }
        });
    } catch (error) {
        console.error('Create deal error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update deal
router.put('/:projectId/deals/:dealId', (req, res) => {
    try {
        const db = getDb();
        const {
            name, client_id, stage_id, amount, currency, probability,
            expected_close_date, assigned_to, tags, custom_fields, notes
        } = req.body;

        const currentDeal = db.prepare('SELECT stage_id FROM deals WHERE id = ?').get(req.params.dealId);

        db.prepare(`
            UPDATE deals SET
                name = COALESCE(?, name),
                client_id = COALESCE(?, client_id),
                stage_id = COALESCE(?, stage_id),
                amount = COALESCE(?, amount),
                currency = COALESCE(?, currency),
                probability = COALESCE(?, probability),
                expected_close_date = COALESCE(?, expected_close_date),
                assigned_to = COALESCE(?, assigned_to),
                tags = COALESCE(?, tags),
                custom_fields = COALESCE(?, custom_fields),
                notes = COALESCE(?, notes),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND project_id = ?
        `).run(
            name, client_id, stage_id, amount, currency, probability,
            expected_close_date, assigned_to,
            tags ? JSON.stringify(tags) : null,
            custom_fields ? JSON.stringify(custom_fields) : null,
            notes, req.params.dealId, req.params.projectId
        );

        // Log stage change
        if (stage_id && currentDeal && stage_id !== currentDeal.stage_id) {
            db.prepare(`
                INSERT INTO deal_stage_history (id, deal_id, from_stage_id, to_stage_id)
                VALUES (?, ?, ?, ?)
            `).run(uuidv4(), req.params.dealId, currentDeal.stage_id, stage_id);

            // Check if new stage is won/lost
            const newStage = db.prepare('SELECT is_won, is_lost FROM funnel_stages WHERE id = ?').get(stage_id);
            if (newStage?.is_won) {
                db.prepare('UPDATE deals SET won_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.dealId);
            } else if (newStage?.is_lost) {
                db.prepare('UPDATE deals SET lost_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.dealId);
            }
        }

        const deal = db.prepare('SELECT * FROM deals WHERE id = ?').get(req.params.dealId);

        res.json({
            success: true,
            deal: {
                ...deal,
                tags: JSON.parse(deal.tags || '[]'),
                custom_fields: JSON.parse(deal.custom_fields || '{}')
            }
        });
    } catch (error) {
        console.error('Update deal error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Move deal to stage
router.post('/:projectId/deals/:dealId/move', (req, res) => {
    try {
        const db = getDb();
        const { stage_id, employee_id, comment, lost_reason } = req.body;

        const currentDeal = db.prepare('SELECT stage_id FROM deals WHERE id = ?').get(req.params.dealId);
        const newStage = db.prepare('SELECT * FROM funnel_stages WHERE id = ?').get(stage_id);

        if (!newStage) {
            return res.status(404).json({ success: false, error: 'Этап не найден' });
        }

        // Update deal
        let updateQuery = `
            UPDATE deals SET
                stage_id = ?,
                updated_at = CURRENT_TIMESTAMP
        `;
        const params = [stage_id];

        if (newStage.is_won) {
            updateQuery += `, won_at = CURRENT_TIMESTAMP`;
        } else if (newStage.is_lost) {
            updateQuery += `, lost_at = CURRENT_TIMESTAMP, lost_reason = ?`;
            params.push(lost_reason);
        }

        updateQuery += ` WHERE id = ?`;
        params.push(req.params.dealId);

        db.prepare(updateQuery).run(...params);

        // Log history
        db.prepare(`
            INSERT INTO deal_stage_history (id, deal_id, from_stage_id, to_stage_id, employee_id, comment)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(uuidv4(), req.params.dealId, currentDeal?.stage_id, stage_id, employee_id, comment);

        const deal = db.prepare('SELECT * FROM deals WHERE id = ?').get(req.params.dealId);

        res.json({
            success: true,
            deal: {
                ...deal,
                tags: JSON.parse(deal.tags || '[]'),
                custom_fields: JSON.parse(deal.custom_fields || '{}')
            }
        });
    } catch (error) {
        console.error('Move deal error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete deal
router.delete('/:projectId/deals/:dealId', (req, res) => {
    try {
        const db = getDb();
        db.prepare('DELETE FROM deals WHERE id = ? AND project_id = ?')
            .run(req.params.dealId, req.params.projectId);

        res.json({ success: true });
    } catch (error) {
        console.error('Delete deal error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Mark deal as won
router.post('/:projectId/deals/:dealId/win', (req, res) => {
    try {
        const db = getDb();
        db.prepare(`
            UPDATE deals SET won_at = datetime('now'), updated_at = datetime('now')
            WHERE id = ? AND project_id = ?
        `).run(req.params.dealId, req.params.projectId);

        const deal = db.prepare('SELECT * FROM deals WHERE id = ?').get(req.params.dealId);
        if (!deal) {
            return res.status(404).json({ success: false, error: 'Сделка не найдена' });
        }

        res.json({
            success: true,
            deal: {
                ...deal,
                tags: JSON.parse(deal.tags || '[]'),
                custom_fields: JSON.parse(deal.custom_fields || '{}')
            }
        });
    } catch (error) {
        console.error('Win deal error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Mark deal as lost
router.post('/:projectId/deals/:dealId/lose', (req, res) => {
    try {
        const db = getDb();
        const { reason } = req.body;

        db.prepare(`
            UPDATE deals SET lost_at = datetime('now'), lost_reason = ?, updated_at = datetime('now')
            WHERE id = ? AND project_id = ?
        `).run(reason || null, req.params.dealId, req.params.projectId);

        const deal = db.prepare('SELECT * FROM deals WHERE id = ?').get(req.params.dealId);
        if (!deal) {
            return res.status(404).json({ success: false, error: 'Сделка не найдена' });
        }

        res.json({
            success: true,
            deal: {
                ...deal,
                tags: JSON.parse(deal.tags || '[]'),
                custom_fields: JSON.parse(deal.custom_fields || '{}')
            }
        });
    } catch (error) {
        console.error('Lose deal error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;

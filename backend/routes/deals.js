const express = require('express');
const router = express.Router();
const { getDb } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// ============================================================
// DEALS
// ============================================================

// Get all deals for project
router.get('/:projectId', (req, res) => {
    try {
        const db = getDb();
        const { funnel_id, stage_id, status, assigned_to, search, limit = 100, offset = 0 } = req.query;

        let query = `
            SELECT d.*,
                c.first_name as client_first_name,
                c.last_name as client_last_name,
                c.email as client_email,
                c.phone as client_phone,
                e.first_name as manager_first_name,
                e.last_name as manager_last_name,
                fs.name as stage_name,
                fs.color as stage_color,
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
        if (status) {
            if (status === 'won') query += ` AND d.won_at IS NOT NULL`;
            else if (status === 'lost') query += ` AND d.lost_at IS NOT NULL`;
            else if (status === 'open') query += ` AND d.won_at IS NULL AND d.lost_at IS NULL`;
            else { query += ` AND 0`; }
        }
        if (assigned_to) {
            query += ` AND d.assigned_to = ?`;
            params.push(assigned_to);
        }
        if (search) {
            query += ` AND (d.title LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ? OR c.email LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }

        query += ` ORDER BY d.created_at DESC LIMIT ? OFFSET ?`;
        params.push(Number(limit), Number(offset));

        const deals = db.prepare(query).all(...params);

        // Get stats
        const stats = db.prepare(`
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN won_at IS NULL AND lost_at IS NULL THEN 1 ELSE 0 END) as open_count,
                SUM(CASE WHEN won_at IS NOT NULL THEN 1 ELSE 0 END) as won_count,
                SUM(CASE WHEN lost_at IS NOT NULL THEN 1 ELSE 0 END) as lost_count,
                SUM(CASE WHEN won_at IS NOT NULL THEN amount ELSE 0 END) as won_amount,
                SUM(CASE WHEN won_at IS NULL AND lost_at IS NULL THEN amount ELSE 0 END) as pipeline_amount
            FROM deals WHERE project_id = ?
        `).get(req.params.projectId);

        res.json({
            success: true,
            deals: deals.map(d => ({
                ...d,
                status: d.won_at ? 'won' : d.lost_at ? 'lost' : 'open',
                title: d.name || d.title,
                tags: JSON.parse(d.tags || '[]'),
                custom_fields: JSON.parse(d.custom_fields || '{}')
            })),
            stats
        });
    } catch (error) {
        console.error('Get deals error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get deals grouped by stages (for kanban)
router.get('/:projectId/kanban/:funnelId', (req, res) => {
    try {
        const db = getDb();

        // Get stages
        const stages = db.prepare(`
            SELECT * FROM funnel_stages WHERE funnel_id = ? ORDER BY sort_order
        `).all(req.params.funnelId);

        // Get deals for each stage
        const result = stages.map(stage => {
            const deals = db.prepare(`
                SELECT d.*,
                    c.first_name as client_first_name,
                    c.last_name as client_last_name,
                    e.first_name as manager_first_name,
                    e.last_name as manager_last_name
                FROM deals d
                LEFT JOIN clients c ON c.id = d.client_id
                LEFT JOIN employees e ON e.id = d.assigned_to
                WHERE d.stage_id = ? AND d.status = 'open'
                ORDER BY d.created_at DESC
            `).all(stage.id);

            return {
                ...stage,
                deals: deals.map(d => ({
                    ...d,
                    tags: JSON.parse(d.tags || '[]')
                })),
                total_amount: deals.reduce((sum, d) => sum + (d.amount || 0), 0)
            };
        });

        res.json({ success: true, stages: result });
    } catch (error) {
        console.error('Get kanban error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get single deal
router.get('/:projectId/:dealId', (req, res) => {
    try {
        const db = getDb();
        const deal = db.prepare(`
            SELECT d.*,
                c.first_name as client_first_name,
                c.last_name as client_last_name,
                c.email as client_email,
                c.phone as client_phone,
                e.first_name as manager_first_name,
                e.last_name as manager_last_name,
                fs.name as stage_name,
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
            SELECT dsh.*, fs.name as stage_name, e.first_name, e.last_name
            FROM deal_stage_history dsh
            LEFT JOIN funnel_stages fs ON fs.id = dsh.stage_id
            LEFT JOIN employees e ON e.id = dsh.changed_by
            WHERE dsh.deal_id = ?
            ORDER BY dsh.changed_at DESC
        `).all(deal.id);

        // Get related tasks
        const tasks = db.prepare(`
            SELECT * FROM tasks WHERE related_type = 'deal' AND related_id = ?
            ORDER BY due_date ASC
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
router.post('/:projectId', (req, res) => {
    try {
        const db = getDb();
        const id = uuidv4();
        const {
            title, funnel_id, stage_id, client_id, assigned_to,
            amount, currency, probability, expected_close_date,
            source, tags, custom_fields, notes
        } = req.body;

        if (!title || !funnel_id) {
            return res.status(400).json({ success: false, error: 'Название и воронка обязательны' });
        }

        // If no stage provided, get first stage of funnel
        let actualStageId = stage_id;
        if (!actualStageId) {
            const firstStage = db.prepare('SELECT id FROM funnel_stages WHERE funnel_id = ? ORDER BY sort_order LIMIT 1').get(funnel_id);
            actualStageId = firstStage?.id;
        }

        db.prepare(`
            INSERT INTO deals (
                id, project_id, title, funnel_id, stage_id, client_id, assigned_to,
                amount, currency, probability, expected_close_date,
                source, tags, custom_fields, notes, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open')
        `).run(
            id, req.params.projectId, title, funnel_id, actualStageId, client_id, assigned_to,
            amount || 0, currency || 'RUB', probability || 50, expected_close_date,
            source, JSON.stringify(tags || []), JSON.stringify(custom_fields || {}), notes
        );

        // Record stage history
        db.prepare(`
            INSERT INTO deal_stage_history (deal_id, stage_id, changed_by)
            VALUES (?, ?, ?)
        `).run(id, actualStageId, assigned_to);

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
router.put('/:projectId/:dealId', (req, res) => {
    try {
        const db = getDb();
        const {
            title, stage_id, client_id, assigned_to,
            amount, probability, expected_close_date,
            source, tags, custom_fields, notes, status
        } = req.body;

        // Check if stage changed
        const currentDeal = db.prepare('SELECT stage_id FROM deals WHERE id = ?').get(req.params.dealId);

        db.prepare(`
            UPDATE deals SET
                title = COALESCE(?, title),
                stage_id = COALESCE(?, stage_id),
                client_id = COALESCE(?, client_id),
                assigned_to = COALESCE(?, assigned_to),
                amount = COALESCE(?, amount),
                probability = COALESCE(?, probability),
                expected_close_date = COALESCE(?, expected_close_date),
                source = COALESCE(?, source),
                tags = COALESCE(?, tags),
                custom_fields = COALESCE(?, custom_fields),
                notes = COALESCE(?, notes),
                status = COALESCE(?, status),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND project_id = ?
        `).run(
            title, stage_id, client_id, assigned_to,
            amount, probability, expected_close_date,
            source, tags ? JSON.stringify(tags) : null,
            custom_fields ? JSON.stringify(custom_fields) : null,
            notes, status,
            req.params.dealId, req.params.projectId
        );

        // Record stage change
        if (stage_id && currentDeal && currentDeal.stage_id !== stage_id) {
            db.prepare(`
                INSERT INTO deal_stage_history (deal_id, stage_id, changed_by)
                VALUES (?, ?, ?)
            `).run(req.params.dealId, stage_id, assigned_to);
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

// Move deal to stage (quick action for kanban)
router.patch('/:projectId/:dealId/stage', (req, res) => {
    try {
        const db = getDb();
        const { stage_id, changed_by } = req.body;

        db.prepare(`
            UPDATE deals SET stage_id = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND project_id = ?
        `).run(stage_id, req.params.dealId, req.params.projectId);

        // Record stage change
        db.prepare(`
            INSERT INTO deal_stage_history (deal_id, stage_id, changed_by)
            VALUES (?, ?, ?)
        `).run(req.params.dealId, stage_id, changed_by);

        res.json({ success: true });
    } catch (error) {
        console.error('Move deal error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Mark deal as won
router.patch('/:projectId/:dealId/won', (req, res) => {
    try {
        const db = getDb();
        const { final_amount } = req.body;

        db.prepare(`
            UPDATE deals SET
                status = 'won',
                amount = COALESCE(?, amount),
                closed_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND project_id = ?
        `).run(final_amount, req.params.dealId, req.params.projectId);

        res.json({ success: true });
    } catch (error) {
        console.error('Win deal error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Mark deal as lost
router.patch('/:projectId/:dealId/lost', (req, res) => {
    try {
        const db = getDb();
        const { loss_reason } = req.body;

        db.prepare(`
            UPDATE deals SET
                status = 'lost',
                loss_reason = ?,
                closed_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND project_id = ?
        `).run(loss_reason, req.params.dealId, req.params.projectId);

        res.json({ success: true });
    } catch (error) {
        console.error('Lose deal error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete deal
router.delete('/:projectId/:dealId', (req, res) => {
    try {
        const db = getDb();
        // Delete stage history
        db.prepare('DELETE FROM deal_stage_history WHERE deal_id = ?').run(req.params.dealId);
        // Delete deal
        db.prepare('DELETE FROM deals WHERE id = ? AND project_id = ?')
            .run(req.params.dealId, req.params.projectId);

        res.json({ success: true });
    } catch (error) {
        console.error('Delete deal error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;

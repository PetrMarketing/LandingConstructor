const express = require('express');
const router = express.Router();
const { getDb } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// ============================================================
// EMPLOYEE ANALYTICS (amoCRM-like)
// ============================================================

// Get overview for all employees
router.get('/:projectId/overview', (req, res) => {
    try {
        const db = getDb();
        const { date_from, date_to } = req.query;

        // Default to current month
        const start = date_from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
        const end = date_to || new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0];

        const employees = db.prepare(`
            SELECT
                e.id,
                e.first_name,
                e.last_name,
                e.position,
                e.avatar_url,
                e.is_active,

                -- Deals stats
                (SELECT COUNT(*) FROM deals d WHERE d.assigned_to = e.id
                    AND d.created_at >= ? AND d.created_at <= ?) as deals_created,
                (SELECT COUNT(*) FROM deals d WHERE d.assigned_to = e.id
                    AND d.won_at >= ? AND d.won_at <= ?) as deals_won,
                (SELECT COUNT(*) FROM deals d WHERE d.assigned_to = e.id
                    AND d.lost_at >= ? AND d.lost_at <= ?) as deals_lost,
                (SELECT COALESCE(SUM(amount), 0) FROM deals d WHERE d.assigned_to = e.id
                    AND d.won_at >= ? AND d.won_at <= ?) as revenue,
                (SELECT COUNT(*) FROM deals d WHERE d.assigned_to = e.id
                    AND d.won_at IS NULL AND d.lost_at IS NULL) as active_deals,

                -- Calls stats
                (SELECT COUNT(*) FROM calls c WHERE c.employee_id = e.id
                    AND c.created_at >= ? AND c.created_at <= ?) as calls_total,
                (SELECT COUNT(*) FROM calls c WHERE c.employee_id = e.id
                    AND c.direction = 'outgoing' AND c.created_at >= ? AND c.created_at <= ?) as calls_outgoing,
                (SELECT COALESCE(SUM(duration), 0) FROM calls c WHERE c.employee_id = e.id
                    AND c.status = 'completed' AND c.created_at >= ? AND c.created_at <= ?) as calls_duration,

                -- Tasks stats
                (SELECT COUNT(*) FROM tasks t WHERE t.assignee_id = e.id
                    AND t.completed_at >= ? AND t.completed_at <= ?) as tasks_completed,
                (SELECT COUNT(*) FROM tasks t WHERE t.assignee_id = e.id
                    AND t.status != 'completed' AND t.due_date < date('now')) as tasks_overdue,

                -- Interactions
                (SELECT COUNT(*) FROM client_interactions ci WHERE ci.employee_id = e.id
                    AND ci.created_at >= ? AND ci.created_at <= ?) as interactions

            FROM employees e
            WHERE e.project_id = ?
            ORDER BY revenue DESC
        `).all(
            start, end, // deals_created
            start, end, // deals_won
            start, end, // deals_lost
            start, end, // revenue
            start, end, // calls_total
            start, end, // calls_outgoing
            start, end, // calls_duration
            start, end, // tasks_completed
            start, end, // interactions
            req.params.projectId
        );

        // Calculate conversion rates
        const employeesWithRates = employees.map(e => ({
            ...e,
            conversion_rate: e.deals_created > 0
                ? Math.round((e.deals_won / e.deals_created) * 100)
                : 0,
            avg_deal_value: e.deals_won > 0
                ? Math.round(e.revenue / e.deals_won)
                : 0,
            calls_per_day: Math.round(e.calls_total / Math.max(1, Math.ceil((new Date(end) - new Date(start)) / (1000 * 60 * 60 * 24))))
        }));

        res.json({
            success: true,
            employees: employeesWithRates,
            period: { start, end }
        });
    } catch (error) {
        console.error('Get employee overview error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get employee performance list
router.get('/:projectId/performance', (req, res) => {
    try {
        const db = getDb();
        const employees = db.prepare(`
            SELECT e.id, e.first_name, e.last_name, e.position, e.avatar_url,
                (SELECT COUNT(*) FROM deals WHERE assigned_to = e.id AND won_at IS NOT NULL) as deals_count,
                (SELECT COALESCE(SUM(amount), 0) FROM deals WHERE assigned_to = e.id AND won_at IS NOT NULL) as revenue,
                (SELECT COUNT(*) FROM calls WHERE employee_id = e.id) as calls_count
            FROM employees e
            WHERE e.project_id = ?
            ORDER BY revenue DESC
        `).all(req.params.projectId);

        res.json({ success: true, employees });
    } catch (error) {
        console.error('Get performance error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get detailed stats for single employee
router.get('/:projectId/:employeeId', (req, res) => {
    try {
        const db = getDb();
        const { date_from, date_to } = req.query;

        const start = date_from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
        const end = date_to || new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0];

        // Get employee info
        const employee = db.prepare(`
            SELECT * FROM employees WHERE id = ? AND project_id = ?
        `).get(req.params.employeeId, req.params.projectId);

        if (!employee) {
            return res.status(404).json({ success: false, error: 'Сотрудник не найден' });
        }

        // Deals by funnel
        const dealsByFunnel = db.prepare(`
            SELECT
                f.id as funnel_id,
                f.name as funnel_name,
                COUNT(d.id) as total,
                SUM(CASE WHEN d.won_at IS NOT NULL THEN 1 ELSE 0 END) as won,
                SUM(CASE WHEN d.lost_at IS NOT NULL THEN 1 ELSE 0 END) as lost,
                SUM(CASE WHEN d.won_at IS NULL AND d.lost_at IS NULL THEN 1 ELSE 0 END) as active,
                COALESCE(SUM(CASE WHEN d.won_at IS NOT NULL THEN d.amount ELSE 0 END), 0) as revenue
            FROM funnels f
            LEFT JOIN deals d ON d.funnel_id = f.id AND d.assigned_to = ?
                AND d.created_at >= ? AND d.created_at <= ?
            WHERE f.project_id = ?
            GROUP BY f.id
        `).all(req.params.employeeId, start, end, req.params.projectId);

        // Daily activity
        const dailyActivity = db.prepare(`
            SELECT
                date(created_at) as date,
                COUNT(*) as actions
            FROM employee_activity_log
            WHERE employee_id = ? AND created_at >= ? AND created_at <= ?
            GROUP BY date(created_at)
            ORDER BY date DESC
            LIMIT 30
        `).all(req.params.employeeId, start, end);

        // Activity breakdown by type
        const activityByType = db.prepare(`
            SELECT
                action_type,
                COUNT(*) as count
            FROM employee_activity_log
            WHERE employee_id = ? AND created_at >= ? AND created_at <= ?
            GROUP BY action_type
            ORDER BY count DESC
        `).all(req.params.employeeId, start, end);

        // Response time to leads
        const responseTime = db.prepare(`
            SELECT
                AVG(
                    CASE WHEN status = 'accepted'
                    THEN (julianday(assigned_at) - julianday(created_at)) * 24 * 60
                    END
                ) as avg_minutes,
                MIN(
                    CASE WHEN status = 'accepted'
                    THEN (julianday(assigned_at) - julianday(created_at)) * 24 * 60
                    END
                ) as min_minutes,
                MAX(
                    CASE WHEN status = 'accepted'
                    THEN (julianday(assigned_at) - julianday(created_at)) * 24 * 60
                    END
                ) as max_minutes,
                COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted,
                COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired
            FROM lead_queue
            WHERE assigned_to = ? AND created_at >= ? AND created_at <= ?
        `).get(req.params.employeeId, start, end);

        // Calls by hour of day
        const callsByHour = db.prepare(`
            SELECT
                CAST(strftime('%H', created_at) AS INTEGER) as hour,
                COUNT(*) as count,
                SUM(CASE WHEN status = 'completed' THEN duration ELSE 0 END) as duration
            FROM calls
            WHERE employee_id = ? AND created_at >= ? AND created_at <= ?
            GROUP BY hour
            ORDER BY hour
        `).all(req.params.employeeId, start, end);

        // Recent deals
        const recentDeals = db.prepare(`
            SELECT
                d.id, d.name, d.amount, d.created_at, d.won_at, d.lost_at,
                fs.name as stage_name, fs.color as stage_color,
                c.first_name as client_first_name, c.last_name as client_last_name
            FROM deals d
            LEFT JOIN funnel_stages fs ON fs.id = d.stage_id
            LEFT JOIN clients c ON c.id = d.client_id
            WHERE d.assigned_to = ? AND d.project_id = ?
            ORDER BY d.created_at DESC
            LIMIT 10
        `).all(req.params.employeeId, req.params.projectId);

        // Goals progress
        const goals = db.prepare(`
            SELECT * FROM sales_goals
            WHERE employee_id = ?
            AND period_start <= ? AND period_end >= ?
        `).all(req.params.employeeId, end, start);

        res.json({
            success: true,
            employee: {
                ...employee,
                permissions: JSON.parse(employee.permissions || '{}')
            },
            stats: {
                dealsByFunnel,
                dailyActivity,
                activityByType,
                responseTime,
                callsByHour,
                goals
            },
            recentDeals,
            period: { start, end }
        });
    } catch (error) {
        console.error('Get employee analytics error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Log employee activity
router.post('/:projectId/log', (req, res) => {
    try {
        const db = getDb();
        const id = uuidv4();
        const { employee_id, action_type, entity_type, entity_id, metadata } = req.body;

        if (!employee_id || !action_type) {
            return res.status(400).json({ success: false, error: 'employee_id и action_type обязательны' });
        }

        db.prepare(`
            INSERT INTO employee_activity_log (id, project_id, employee_id, action_type, entity_type, entity_id, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            id, req.params.projectId, employee_id, action_type,
            entity_type, entity_id, JSON.stringify(metadata || {})
        );

        res.json({ success: true, id });
    } catch (error) {
        console.error('Log activity error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update employee status
router.put('/:projectId/:employeeId/status', (req, res) => {
    try {
        const db = getDb();
        const { status, status_message } = req.body;

        // Check if status record exists
        const existing = db.prepare(`
            SELECT id FROM employee_status WHERE employee_id = ?
        `).get(req.params.employeeId);

        if (existing) {
            db.prepare(`
                UPDATE employee_status SET
                    status = COALESCE(?, status),
                    status_message = ?,
                    last_activity_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE employee_id = ?
            `).run(status, status_message, req.params.employeeId);
        } else {
            db.prepare(`
                INSERT INTO employee_status (id, employee_id, status, status_message, last_activity_at)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            `).run(uuidv4(), req.params.employeeId, status || 'online', status_message);
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Update status error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get online employees
router.get('/:projectId/online', (req, res) => {
    try {
        const db = getDb();

        const online = db.prepare(`
            SELECT
                e.id,
                e.first_name,
                e.last_name,
                e.avatar_url,
                es.status,
                es.status_message,
                es.last_activity_at
            FROM employees e
            JOIN employee_status es ON es.employee_id = e.id
            WHERE e.project_id = ?
            AND es.status IN ('online', 'busy')
            AND datetime(es.last_activity_at, '+15 minutes') > datetime('now')
            ORDER BY es.last_activity_at DESC
        `).all(req.params.projectId);

        res.json({ success: true, employees: online });
    } catch (error) {
        console.error('Get online employees error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get comparison between employees
router.get('/:projectId/compare', (req, res) => {
    try {
        const db = getDb();
        const { employee_ids, date_from, date_to } = req.query;

        if (!employee_ids) {
            return res.status(400).json({ success: false, error: 'employee_ids обязателен' });
        }

        const ids = employee_ids.split(',');
        const start = date_from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
        const end = date_to || new Date().toISOString().split('T')[0];

        const comparison = db.prepare(`
            SELECT
                e.id,
                e.first_name,
                e.last_name,

                (SELECT COUNT(*) FROM deals WHERE assigned_to = e.id
                    AND won_at >= ? AND won_at <= ?) as deals_won,
                (SELECT COALESCE(SUM(amount), 0) FROM deals WHERE assigned_to = e.id
                    AND won_at >= ? AND won_at <= ?) as revenue,
                (SELECT COUNT(*) FROM calls WHERE employee_id = e.id
                    AND created_at >= ? AND created_at <= ?) as calls,
                (SELECT COUNT(*) FROM tasks WHERE assignee_id = e.id
                    AND completed_at >= ? AND completed_at <= ?) as tasks

            FROM employees e
            WHERE e.id IN (${ids.map(() => '?').join(',')})
        `).all(
            start, end, // deals_won
            start, end, // revenue
            start, end, // calls
            start, end, // tasks
            ...ids
        );

        res.json({
            success: true,
            comparison,
            period: { start, end }
        });
    } catch (error) {
        console.error('Compare employees error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// DEAL COMMENTS
// ============================================================

// Get comments for deal
router.get('/:projectId/deals/:dealId/comments', (req, res) => {
    try {
        const db = getDb();

        const comments = db.prepare(`
            SELECT c.*,
                e.first_name,
                e.last_name,
                e.avatar_url
            FROM deal_comments c
            LEFT JOIN employees e ON e.id = c.employee_id
            WHERE c.deal_id = ?
            ORDER BY c.is_pinned DESC, c.created_at DESC
        `).all(req.params.dealId);

        res.json({
            success: true,
            comments: comments.map(c => ({
                ...c,
                attachments: JSON.parse(c.attachments || '[]')
            }))
        });
    } catch (error) {
        console.error('Get comments error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Add comment to deal
router.post('/:projectId/deals/:dealId/comments', (req, res) => {
    try {
        const db = getDb();
        const id = uuidv4();
        const { employee_id, content, attachments } = req.body;

        if (!content) {
            return res.status(400).json({ success: false, error: 'Текст комментария обязателен' });
        }

        db.prepare(`
            INSERT INTO deal_comments (id, deal_id, employee_id, content, attachments)
            VALUES (?, ?, ?, ?, ?)
        `).run(id, req.params.dealId, employee_id, content, JSON.stringify(attachments || []));

        // Update deal updated_at
        db.prepare(`UPDATE deals SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(req.params.dealId);

        // Log activity
        if (employee_id) {
            db.prepare(`
                INSERT INTO employee_activity_log (id, project_id, employee_id, action_type, entity_type, entity_id)
                VALUES (?, ?, ?, 'comment_added', 'deal', ?)
            `).run(uuidv4(), req.params.projectId, employee_id, req.params.dealId);
        }

        const comment = db.prepare(`
            SELECT c.*, e.first_name, e.last_name, e.avatar_url
            FROM deal_comments c
            LEFT JOIN employees e ON e.id = c.employee_id
            WHERE c.id = ?
        `).get(id);

        res.json({
            success: true,
            comment: {
                ...comment,
                attachments: JSON.parse(comment.attachments || '[]')
            }
        });
    } catch (error) {
        console.error('Add comment error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update comment
router.put('/:projectId/deals/:dealId/comments/:commentId', (req, res) => {
    try {
        const db = getDb();
        const { content, is_pinned } = req.body;

        db.prepare(`
            UPDATE deal_comments SET
                content = COALESCE(?, content),
                is_pinned = COALESCE(?, is_pinned),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND deal_id = ?
        `).run(content, is_pinned !== undefined ? (is_pinned ? 1 : 0) : null, req.params.commentId, req.params.dealId);

        res.json({ success: true });
    } catch (error) {
        console.error('Update comment error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete comment
router.delete('/:projectId/deals/:dealId/comments/:commentId', (req, res) => {
    try {
        const db = getDb();
        db.prepare('DELETE FROM deal_comments WHERE id = ? AND deal_id = ?')
            .run(req.params.commentId, req.params.dealId);

        res.json({ success: true });
    } catch (error) {
        console.error('Delete comment error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// LOSS REASONS
// ============================================================

// Get loss reasons
router.get('/:projectId/loss-reasons', (req, res) => {
    try {
        const db = getDb();
        const reasons = db.prepare(`
            SELECT * FROM loss_reasons
            WHERE project_id = ? AND is_active = 1
            ORDER BY sort_order, name
        `).all(req.params.projectId);

        res.json({ success: true, reasons });
    } catch (error) {
        console.error('Get loss reasons error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create loss reason
router.post('/:projectId/loss-reasons', (req, res) => {
    try {
        const db = getDb();
        const id = uuidv4();
        const { name, sort_order } = req.body;

        if (!name) {
            return res.status(400).json({ success: false, error: 'Название обязательно' });
        }

        db.prepare(`
            INSERT INTO loss_reasons (id, project_id, name, sort_order)
            VALUES (?, ?, ?, ?)
        `).run(id, req.params.projectId, name, sort_order || 0);

        const reason = db.prepare('SELECT * FROM loss_reasons WHERE id = ?').get(id);

        res.json({ success: true, reason });
    } catch (error) {
        console.error('Create loss reason error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update loss reason
router.put('/:projectId/loss-reasons/:reasonId', (req, res) => {
    try {
        const db = getDb();
        const { name, sort_order, is_active } = req.body;

        db.prepare(`
            UPDATE loss_reasons SET
                name = COALESCE(?, name),
                sort_order = COALESCE(?, sort_order),
                is_active = COALESCE(?, is_active)
            WHERE id = ? AND project_id = ?
        `).run(name, sort_order, is_active !== undefined ? (is_active ? 1 : 0) : null, req.params.reasonId, req.params.projectId);

        res.json({ success: true });
    } catch (error) {
        console.error('Update loss reason error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete loss reason
router.delete('/:projectId/loss-reasons/:reasonId', (req, res) => {
    try {
        const db = getDb();
        db.prepare('DELETE FROM loss_reasons WHERE id = ? AND project_id = ?')
            .run(req.params.reasonId, req.params.projectId);

        res.json({ success: true });
    } catch (error) {
        console.error('Delete loss reason error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get loss reason stats
router.get('/:projectId/loss-reasons/stats', (req, res) => {
    try {
        const db = getDb();
        const { date_from, date_to } = req.query;

        let query = `
            SELECT
                lr.id,
                lr.name,
                COUNT(d.id) as count,
                COALESCE(SUM(d.amount), 0) as lost_amount
            FROM loss_reasons lr
            LEFT JOIN deals d ON d.lost_reason = lr.name
                AND d.project_id = ?
                ${date_from ? 'AND d.lost_at >= ?' : ''}
                ${date_to ? 'AND d.lost_at <= ?' : ''}
            WHERE lr.project_id = ?
            GROUP BY lr.id
            ORDER BY count DESC
        `;
        const params = [
            req.params.projectId,
            ...(date_from ? [date_from] : []),
            ...(date_to ? [date_to] : []),
            req.params.projectId
        ];

        const stats = db.prepare(query).all(...params);

        res.json({ success: true, stats });
    } catch (error) {
        console.error('Get loss reason stats error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;

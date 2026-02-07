const express = require('express');
const router = express.Router();
const { getDb } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// ============================================================
// SALES GOALS / KPI (amoCRM-like)
// ============================================================

// Get all goals for project
router.get('/:projectId', (req, res) => {
    try {
        const db = getDb();
        const { employee_id, period_type, metric_type, period_start, period_end } = req.query;

        let query = `
            SELECT g.*,
                e.first_name,
                e.last_name,
                f.name as funnel_name
            FROM sales_goals g
            LEFT JOIN employees e ON e.id = g.employee_id
            LEFT JOIN funnels f ON f.id = g.funnel_id
            WHERE g.project_id = ?
        `;
        const params = [req.params.projectId];

        if (employee_id) {
            query += ` AND g.employee_id = ?`;
            params.push(employee_id);
        }
        if (period_type) {
            query += ` AND g.period_type = ?`;
            params.push(period_type);
        }
        if (metric_type) {
            query += ` AND g.metric_type = ?`;
            params.push(metric_type);
        }
        if (period_start) {
            query += ` AND g.period_start >= ?`;
            params.push(period_start);
        }
        if (period_end) {
            query += ` AND g.period_end <= ?`;
            params.push(period_end);
        }

        query += ` ORDER BY g.period_start DESC, e.last_name`;

        const goals = db.prepare(query).all(...params);

        // Calculate completion percentage
        const goalsWithProgress = goals.map(g => ({
            ...g,
            progress_percent: g.target_value > 0 ? Math.round((g.current_value / g.target_value) * 100) : 0,
            is_completed: g.current_value >= g.target_value
        }));

        res.json({ success: true, goals: goalsWithProgress });
    } catch (error) {
        console.error('Get goals error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get goals for current period with live stats
router.get('/:projectId/current', (req, res) => {
    try {
        const db = getDb();
        const { employee_id } = req.query;

        const today = new Date().toISOString().split('T')[0];

        let query = `
            SELECT g.*,
                e.first_name,
                e.last_name,
                f.name as funnel_name
            FROM sales_goals g
            LEFT JOIN employees e ON e.id = g.employee_id
            LEFT JOIN funnels f ON f.id = g.funnel_id
            WHERE g.project_id = ?
            AND g.period_start <= ?
            AND g.period_end >= ?
        `;
        const params = [req.params.projectId, today, today];

        if (employee_id) {
            query += ` AND g.employee_id = ?`;
            params.push(employee_id);
        }

        query += ` ORDER BY e.last_name`;

        const goals = db.prepare(query).all(...params);

        // Calculate real-time values for each goal
        const goalsWithRealtime = goals.map(g => {
            let currentValue = 0;

            const baseParams = [req.params.projectId, g.period_start, g.period_end];
            let metricQuery = '';

            switch (g.metric_type) {
                case 'deals_count':
                    metricQuery = `
                        SELECT COUNT(*) as value FROM deals
                        WHERE project_id = ? AND created_at >= ? AND created_at <= ?
                        ${g.employee_id ? 'AND assigned_to = ?' : ''}
                        ${g.funnel_id ? 'AND funnel_id = ?' : ''}
                    `;
                    if (g.employee_id) baseParams.push(g.employee_id);
                    if (g.funnel_id) baseParams.push(g.funnel_id);
                    break;

                case 'deals_won':
                    metricQuery = `
                        SELECT COUNT(*) as value FROM deals
                        WHERE project_id = ? AND won_at >= ? AND won_at <= ?
                        ${g.employee_id ? 'AND assigned_to = ?' : ''}
                        ${g.funnel_id ? 'AND funnel_id = ?' : ''}
                    `;
                    if (g.employee_id) baseParams.push(g.employee_id);
                    if (g.funnel_id) baseParams.push(g.funnel_id);
                    break;

                case 'revenue':
                    metricQuery = `
                        SELECT COALESCE(SUM(amount), 0) as value FROM deals
                        WHERE project_id = ? AND won_at >= ? AND won_at <= ?
                        ${g.employee_id ? 'AND assigned_to = ?' : ''}
                        ${g.funnel_id ? 'AND funnel_id = ?' : ''}
                    `;
                    if (g.employee_id) baseParams.push(g.employee_id);
                    if (g.funnel_id) baseParams.push(g.funnel_id);
                    break;

                case 'calls_count':
                    metricQuery = `
                        SELECT COUNT(*) as value FROM calls
                        WHERE project_id = ? AND created_at >= ? AND created_at <= ?
                        ${g.employee_id ? 'AND employee_id = ?' : ''}
                    `;
                    if (g.employee_id) baseParams.push(g.employee_id);
                    break;

                case 'calls_duration':
                    metricQuery = `
                        SELECT COALESCE(SUM(duration), 0) as value FROM calls
                        WHERE project_id = ? AND created_at >= ? AND created_at <= ?
                        AND status = 'completed'
                        ${g.employee_id ? 'AND employee_id = ?' : ''}
                    `;
                    if (g.employee_id) baseParams.push(g.employee_id);
                    break;

                case 'tasks_completed':
                    metricQuery = `
                        SELECT COUNT(*) as value FROM tasks
                        WHERE project_id = ? AND completed_at >= ? AND completed_at <= ?
                        ${g.employee_id ? 'AND assignee_id = ?' : ''}
                    `;
                    if (g.employee_id) baseParams.push(g.employee_id);
                    break;

                case 'avg_deal_value':
                    metricQuery = `
                        SELECT COALESCE(AVG(amount), 0) as value FROM deals
                        WHERE project_id = ? AND won_at >= ? AND won_at <= ?
                        ${g.employee_id ? 'AND assigned_to = ?' : ''}
                        ${g.funnel_id ? 'AND funnel_id = ?' : ''}
                    `;
                    if (g.employee_id) baseParams.push(g.employee_id);
                    if (g.funnel_id) baseParams.push(g.funnel_id);
                    break;

                case 'conversion_rate':
                    // Calculate conversion rate
                    const wonQuery = db.prepare(`
                        SELECT COUNT(*) as won FROM deals
                        WHERE project_id = ? AND won_at >= ? AND won_at <= ?
                        ${g.employee_id ? 'AND assigned_to = ?' : ''}
                    `).get(...baseParams.slice(0, 3), ...(g.employee_id ? [g.employee_id] : []));

                    const totalQuery = db.prepare(`
                        SELECT COUNT(*) as total FROM deals
                        WHERE project_id = ? AND created_at >= ? AND created_at <= ?
                        ${g.employee_id ? 'AND assigned_to = ?' : ''}
                    `).get(...baseParams.slice(0, 3), ...(g.employee_id ? [g.employee_id] : []));

                    currentValue = totalQuery.total > 0 ? Math.round((wonQuery.won / totalQuery.total) * 100) : 0;
                    break;
            }

            if (metricQuery && g.metric_type !== 'conversion_rate') {
                const result = db.prepare(metricQuery).get(...baseParams);
                currentValue = result?.value || 0;
            }

            // Update current_value in database
            db.prepare(`
                UPDATE sales_goals SET current_value = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(currentValue, g.id);

            return {
                ...g,
                current_value: currentValue,
                progress_percent: g.target_value > 0 ? Math.round((currentValue / g.target_value) * 100) : 0,
                is_completed: currentValue >= g.target_value,
                days_left: Math.ceil((new Date(g.period_end) - new Date()) / (1000 * 60 * 60 * 24))
            };
        });

        res.json({ success: true, goals: goalsWithRealtime });
    } catch (error) {
        console.error('Get current goals error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create goal
router.post('/:projectId', (req, res) => {
    try {
        const db = getDb();
        const id = uuidv4();
        const {
            employee_id, period_type, period_start, period_end,
            metric_type, target_value, funnel_id
        } = req.body;

        if (!period_start || !period_end || !metric_type || !target_value) {
            return res.status(400).json({
                success: false,
                error: 'Период, тип метрики и целевое значение обязательны'
            });
        }

        // Validate metric_type
        const validMetrics = [
            'deals_count',       // Количество сделок
            'deals_won',         // Выигранные сделки
            'revenue',           // Выручка
            'avg_deal_value',    // Средний чек
            'calls_count',       // Количество звонков
            'calls_duration',    // Длительность звонков (минуты)
            'tasks_completed',   // Выполненные задачи
            'conversion_rate'    // Конверсия (%)
        ];

        if (!validMetrics.includes(metric_type)) {
            return res.status(400).json({
                success: false,
                error: `Неверный тип метрики. Допустимые: ${validMetrics.join(', ')}`
            });
        }

        db.prepare(`
            INSERT INTO sales_goals (
                id, project_id, employee_id, period_type, period_start, period_end,
                metric_type, target_value, funnel_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            id, req.params.projectId, employee_id,
            period_type || 'month', period_start, period_end,
            metric_type, target_value, funnel_id
        );

        const goal = db.prepare('SELECT * FROM sales_goals WHERE id = ?').get(id);

        res.json({ success: true, goal });
    } catch (error) {
        console.error('Create goal error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update goal
router.put('/:projectId/:goalId', (req, res) => {
    try {
        const db = getDb();
        const { target_value, period_start, period_end, funnel_id, employee_id } = req.body;

        db.prepare(`
            UPDATE sales_goals SET
                target_value = COALESCE(?, target_value),
                period_start = COALESCE(?, period_start),
                period_end = COALESCE(?, period_end),
                funnel_id = COALESCE(?, funnel_id),
                employee_id = COALESCE(?, employee_id),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND project_id = ?
        `).run(target_value, period_start, period_end, funnel_id, employee_id, req.params.goalId, req.params.projectId);

        const goal = db.prepare('SELECT * FROM sales_goals WHERE id = ?').get(req.params.goalId);

        res.json({ success: true, goal });
    } catch (error) {
        console.error('Update goal error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete goal
router.delete('/:projectId/:goalId', (req, res) => {
    try {
        const db = getDb();
        db.prepare('DELETE FROM sales_goals WHERE id = ? AND project_id = ?')
            .run(req.params.goalId, req.params.projectId);

        res.json({ success: true });
    } catch (error) {
        console.error('Delete goal error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get leaderboard
router.get('/:projectId/leaderboard/:metricType', (req, res) => {
    try {
        const db = getDb();
        const { period_start, period_end } = req.query;
        const { metricType } = req.params;

        // Default to current month
        const start = period_start || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
        const end = period_end || new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString();

        let query = '';
        switch (metricType) {
            case 'revenue':
                query = `
                    SELECT
                        e.id,
                        e.first_name,
                        e.last_name,
                        e.avatar_url,
                        COALESCE(SUM(d.amount), 0) as value,
                        COUNT(DISTINCT CASE WHEN d.won_at IS NOT NULL THEN d.id END) as deals_won
                    FROM employees e
                    LEFT JOIN deals d ON d.assigned_to = e.id
                        AND d.won_at >= ? AND d.won_at <= ?
                    WHERE e.project_id = ? AND e.is_active = 1
                    GROUP BY e.id
                    ORDER BY value DESC
                `;
                break;

            case 'deals_won':
                query = `
                    SELECT
                        e.id,
                        e.first_name,
                        e.last_name,
                        e.avatar_url,
                        COUNT(DISTINCT CASE WHEN d.won_at IS NOT NULL THEN d.id END) as value,
                        COALESCE(SUM(CASE WHEN d.won_at IS NOT NULL THEN d.amount ELSE 0 END), 0) as revenue
                    FROM employees e
                    LEFT JOIN deals d ON d.assigned_to = e.id
                        AND d.created_at >= ? AND d.created_at <= ?
                    WHERE e.project_id = ? AND e.is_active = 1
                    GROUP BY e.id
                    ORDER BY value DESC
                `;
                break;

            case 'calls':
                query = `
                    SELECT
                        e.id,
                        e.first_name,
                        e.last_name,
                        e.avatar_url,
                        COUNT(c.id) as value,
                        COALESCE(SUM(c.duration), 0) as total_duration
                    FROM employees e
                    LEFT JOIN calls c ON c.employee_id = e.id
                        AND c.created_at >= ? AND c.created_at <= ?
                    WHERE e.project_id = ? AND e.is_active = 1
                    GROUP BY e.id
                    ORDER BY value DESC
                `;
                break;

            default:
                return res.status(400).json({ success: false, error: 'Неверный тип метрики' });
        }

        const leaderboard = db.prepare(query).all(start, end, req.params.projectId);

        // Add rank
        const ranked = leaderboard.map((item, index) => ({
            ...item,
            rank: index + 1
        }));

        res.json({ success: true, leaderboard: ranked, period: { start, end } });
    } catch (error) {
        console.error('Get leaderboard error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get goal templates
router.get('/:projectId/templates/list', (req, res) => {
    const templates = [
        {
            name: 'План по выручке',
            metric_type: 'revenue',
            period_type: 'month',
            description: 'Сумма выигранных сделок за месяц'
        },
        {
            name: 'Количество сделок',
            metric_type: 'deals_won',
            period_type: 'month',
            description: 'Количество выигранных сделок за месяц'
        },
        {
            name: 'План по звонкам',
            metric_type: 'calls_count',
            period_type: 'week',
            description: 'Количество звонков за неделю'
        },
        {
            name: 'Конверсия в продажу',
            metric_type: 'conversion_rate',
            period_type: 'month',
            description: 'Процент выигранных сделок от созданных'
        },
        {
            name: 'Средний чек',
            metric_type: 'avg_deal_value',
            period_type: 'month',
            description: 'Средняя сумма выигранной сделки'
        }
    ];

    res.json({ success: true, templates });
});

module.exports = router;

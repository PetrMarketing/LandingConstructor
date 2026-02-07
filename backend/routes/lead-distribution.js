const express = require('express');
const router = express.Router();
const { getDb } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// ============================================================
// LEAD DISTRIBUTION (amoCRM-like)
// ============================================================

// Get distribution settings
router.get('/:projectId/settings', (req, res) => {
    try {
        const db = getDb();
        const { funnel_id } = req.query;

        let query = `
            SELECT s.*,
                f.name as funnel_name
            FROM lead_distribution_settings s
            LEFT JOIN funnels f ON f.id = s.funnel_id
            WHERE s.project_id = ?
        `;
        const params = [req.params.projectId];

        if (funnel_id) {
            query += ` AND s.funnel_id = ?`;
            params.push(funnel_id);
        }

        const settings = db.prepare(query).all(...params);

        res.json({
            success: true,
            settings: settings.map(s => ({
                ...s,
                employee_ids: JSON.parse(s.employee_ids || '[]')
            }))
        });
    } catch (error) {
        console.error('Get distribution settings error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create/Update distribution settings
router.post('/:projectId/settings', (req, res) => {
    try {
        const db = getDb();
        const {
            funnel_id, distribution_type, employee_ids, max_leads_per_employee,
            response_timeout_minutes, auto_reassign, working_hours_only,
            working_hours_start, working_hours_end
        } = req.body;

        // Check if settings exist for this funnel
        const existing = db.prepare(`
            SELECT id FROM lead_distribution_settings
            WHERE project_id = ? AND (funnel_id = ? OR (funnel_id IS NULL AND ? IS NULL))
        `).get(req.params.projectId, funnel_id, funnel_id);

        if (existing) {
            // Update
            db.prepare(`
                UPDATE lead_distribution_settings SET
                    distribution_type = COALESCE(?, distribution_type),
                    employee_ids = COALESCE(?, employee_ids),
                    max_leads_per_employee = COALESCE(?, max_leads_per_employee),
                    response_timeout_minutes = COALESCE(?, response_timeout_minutes),
                    auto_reassign = COALESCE(?, auto_reassign),
                    working_hours_only = COALESCE(?, working_hours_only),
                    working_hours_start = COALESCE(?, working_hours_start),
                    working_hours_end = COALESCE(?, working_hours_end)
                WHERE id = ?
            `).run(
                distribution_type,
                employee_ids ? JSON.stringify(employee_ids) : null,
                max_leads_per_employee,
                response_timeout_minutes,
                auto_reassign !== undefined ? (auto_reassign ? 1 : 0) : null,
                working_hours_only !== undefined ? (working_hours_only ? 1 : 0) : null,
                working_hours_start,
                working_hours_end,
                existing.id
            );

            const settings = db.prepare('SELECT * FROM lead_distribution_settings WHERE id = ?').get(existing.id);
            return res.json({
                success: true,
                settings: {
                    ...settings,
                    employee_ids: JSON.parse(settings.employee_ids || '[]')
                }
            });
        }

        // Create new
        const id = uuidv4();
        db.prepare(`
            INSERT INTO lead_distribution_settings (
                id, project_id, funnel_id, distribution_type, employee_ids,
                max_leads_per_employee, response_timeout_minutes, auto_reassign,
                working_hours_only, working_hours_start, working_hours_end
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            id, req.params.projectId, funnel_id,
            distribution_type || 'round_robin',
            JSON.stringify(employee_ids || []),
            max_leads_per_employee,
            response_timeout_minutes || 30,
            auto_reassign !== undefined ? (auto_reassign ? 1 : 0) : 1,
            working_hours_only !== undefined ? (working_hours_only ? 1 : 0) : 1,
            working_hours_start || '09:00',
            working_hours_end || '18:00'
        );

        const settings = db.prepare('SELECT * FROM lead_distribution_settings WHERE id = ?').get(id);

        res.json({
            success: true,
            settings: {
                ...settings,
                employee_ids: JSON.parse(settings.employee_ids || '[]')
            }
        });
    } catch (error) {
        console.error('Save distribution settings error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get lead queue
router.get('/:projectId/queue', (req, res) => {
    try {
        const db = getDb();
        const { status, limit = 50, offset = 0 } = req.query;

        let query = `
            SELECT q.*,
                d.name as deal_name,
                d.amount as deal_amount,
                c.first_name as client_first_name,
                c.last_name as client_last_name,
                c.phone as client_phone,
                e.first_name as assigned_first_name,
                e.last_name as assigned_last_name
            FROM lead_queue q
            JOIN deals d ON d.id = q.deal_id
            LEFT JOIN clients c ON c.id = d.client_id
            LEFT JOIN employees e ON e.id = q.assigned_to
            WHERE q.project_id = ?
        `;
        const params = [req.params.projectId];

        if (status) {
            query += ` AND q.status = ?`;
            params.push(status);
        }

        query += ` ORDER BY q.priority DESC, q.created_at ASC LIMIT ? OFFSET ?`;
        params.push(Number(limit), Number(offset));

        const queue = db.prepare(query).all(...params);

        // Get stats
        const stats = db.prepare(`
            SELECT
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
                COUNT(CASE WHEN status = 'assigned' THEN 1 END) as assigned,
                COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired,
                COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted
            FROM lead_queue WHERE project_id = ?
        `).get(req.params.projectId);

        res.json({ success: true, queue, stats });
    } catch (error) {
        console.error('Get lead queue error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Add deal to queue (unassigned lead)
router.post('/:projectId/queue', (req, res) => {
    try {
        const db = getDb();
        const id = uuidv4();
        const { deal_id, source, priority } = req.body;

        if (!deal_id) {
            return res.status(400).json({ success: false, error: 'deal_id обязателен' });
        }

        // Check if deal exists and is unassigned
        const deal = db.prepare('SELECT * FROM deals WHERE id = ? AND project_id = ?')
            .get(deal_id, req.params.projectId);

        if (!deal) {
            return res.status(404).json({ success: false, error: 'Сделка не найдена' });
        }

        if (deal.assigned_to) {
            return res.status(400).json({ success: false, error: 'Сделка уже назначена' });
        }

        // Check if already in queue
        const existing = db.prepare('SELECT id FROM lead_queue WHERE deal_id = ? AND status = ?')
            .get(deal_id, 'pending');

        if (existing) {
            return res.status(400).json({ success: false, error: 'Сделка уже в очереди' });
        }

        db.prepare(`
            INSERT INTO lead_queue (id, project_id, deal_id, source, priority, status)
            VALUES (?, ?, ?, ?, ?, 'pending')
        `).run(id, req.params.projectId, deal_id, source, priority || 0);

        const queueItem = db.prepare('SELECT * FROM lead_queue WHERE id = ?').get(id);

        res.json({ success: true, queueItem });
    } catch (error) {
        console.error('Add to queue error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Distribute next lead from queue
router.post('/:projectId/distribute', (req, res) => {
    try {
        const db = getDb();
        const { funnel_id } = req.body;

        // Get settings
        const settings = db.prepare(`
            SELECT * FROM lead_distribution_settings
            WHERE project_id = ? AND (funnel_id = ? OR funnel_id IS NULL)
            AND is_active = 1
            ORDER BY funnel_id DESC NULLS LAST
            LIMIT 1
        `).get(req.params.projectId, funnel_id);

        if (!settings) {
            return res.status(400).json({ success: false, error: 'Настройки распределения не найдены' });
        }

        const employeeIds = JSON.parse(settings.employee_ids || '[]');
        if (employeeIds.length === 0) {
            return res.status(400).json({ success: false, error: 'Нет сотрудников для распределения' });
        }

        // Get next pending lead
        const pendingLead = db.prepare(`
            SELECT q.*, d.funnel_id FROM lead_queue q
            JOIN deals d ON d.id = q.deal_id
            WHERE q.project_id = ? AND q.status = 'pending'
            ${funnel_id ? 'AND d.funnel_id = ?' : ''}
            ORDER BY q.priority DESC, q.created_at ASC
            LIMIT 1
        `).get(req.params.projectId, ...(funnel_id ? [funnel_id] : []));

        if (!pendingLead) {
            return res.json({ success: true, message: 'Нет лидов для распределения', distributed: null });
        }

        // Select employee based on distribution type
        let selectedEmployee = null;

        switch (settings.distribution_type) {
            case 'round_robin': {
                // Get employee with least recently assigned lead
                const lastAssignments = db.prepare(`
                    SELECT assigned_to, MAX(assigned_at) as last_assigned
                    FROM lead_queue
                    WHERE project_id = ? AND assigned_to IN (${employeeIds.map(() => '?').join(',')})
                    GROUP BY assigned_to
                `).all(req.params.projectId, ...employeeIds);

                // Find employees who haven't been assigned yet
                const assignedIds = lastAssignments.map(a => a.assigned_to);
                const unassigned = employeeIds.filter(id => !assignedIds.includes(id));

                if (unassigned.length > 0) {
                    selectedEmployee = unassigned[0];
                } else {
                    // Sort by last assignment and pick the one with oldest assignment
                    lastAssignments.sort((a, b) => new Date(a.last_assigned) - new Date(b.last_assigned));
                    selectedEmployee = lastAssignments[0]?.assigned_to || employeeIds[0];
                }
                break;
            }

            case 'load_balanced': {
                // Get employee with least active deals
                const loads = db.prepare(`
                    SELECT e.id,
                        COUNT(d.id) as active_deals
                    FROM employees e
                    LEFT JOIN deals d ON d.assigned_to = e.id
                        AND d.won_at IS NULL AND d.lost_at IS NULL
                    WHERE e.id IN (${employeeIds.map(() => '?').join(',')})
                    GROUP BY e.id
                    ORDER BY active_deals ASC
                    LIMIT 1
                `).get(...employeeIds);

                selectedEmployee = loads?.id || employeeIds[0];
                break;
            }

            case 'weighted': {
                // TODO: Implement weighted distribution based on employee performance
                selectedEmployee = employeeIds[0];
                break;
            }

            default:
                selectedEmployee = employeeIds[0];
        }

        if (!selectedEmployee) {
            return res.status(400).json({ success: false, error: 'Не удалось выбрать сотрудника' });
        }

        // Check if employee is available (working hours)
        if (settings.working_hours_only) {
            const now = new Date();
            const currentHour = now.getHours();
            const currentMinute = now.getMinutes();
            const currentTime = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;

            if (currentTime < settings.working_hours_start || currentTime > settings.working_hours_end) {
                return res.json({
                    success: true,
                    message: 'Вне рабочего времени',
                    distributed: null
                });
            }
        }

        // Assign lead
        const expiresAt = new Date(Date.now() + settings.response_timeout_minutes * 60 * 1000).toISOString();

        db.prepare(`
            UPDATE lead_queue SET
                status = 'assigned',
                assigned_to = ?,
                assigned_at = CURRENT_TIMESTAMP,
                expires_at = ?
            WHERE id = ?
        `).run(selectedEmployee, expiresAt, pendingLead.id);

        // Update deal
        db.prepare(`
            UPDATE deals SET assigned_to = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(selectedEmployee, pendingLead.deal_id);

        // Get employee info
        const employee = db.prepare('SELECT first_name, last_name FROM employees WHERE id = ?')
            .get(selectedEmployee);

        // Create notification for employee
        db.prepare(`
            INSERT INTO notifications (id, project_id, recipient_type, recipient_id, type, title, message, link)
            VALUES (?, ?, 'employee', ?, 'new_lead', 'Новый лид', 'Вам назначен новый лид. Время на ответ: ${settings.response_timeout_minutes} мин.', ?)
        `).run(uuidv4(), req.params.projectId, selectedEmployee, `/deals/${pendingLead.deal_id}`);

        res.json({
            success: true,
            distributed: {
                queue_id: pendingLead.id,
                deal_id: pendingLead.deal_id,
                assigned_to: selectedEmployee,
                employee_name: `${employee.first_name} ${employee.last_name}`,
                expires_at: expiresAt
            }
        });
    } catch (error) {
        console.error('Distribute lead error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Accept assigned lead
router.post('/:projectId/queue/:queueId/accept', (req, res) => {
    try {
        const db = getDb();
        const { employee_id } = req.body;

        const queueItem = db.prepare(`
            SELECT * FROM lead_queue WHERE id = ? AND project_id = ?
        `).get(req.params.queueId, req.params.projectId);

        if (!queueItem) {
            return res.status(404).json({ success: false, error: 'Лид не найден в очереди' });
        }

        if (queueItem.status !== 'assigned') {
            return res.status(400).json({ success: false, error: 'Лид не назначен' });
        }

        if (queueItem.assigned_to !== employee_id) {
            return res.status(403).json({ success: false, error: 'Лид назначен другому сотруднику' });
        }

        db.prepare(`
            UPDATE lead_queue SET status = 'accepted'
            WHERE id = ?
        `).run(req.params.queueId);

        res.json({ success: true });
    } catch (error) {
        console.error('Accept lead error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Reject assigned lead (return to queue)
router.post('/:projectId/queue/:queueId/reject', (req, res) => {
    try {
        const db = getDb();
        const { employee_id, reason } = req.body;

        const queueItem = db.prepare(`
            SELECT * FROM lead_queue WHERE id = ? AND project_id = ?
        `).get(req.params.queueId, req.params.projectId);

        if (!queueItem) {
            return res.status(404).json({ success: false, error: 'Лид не найден в очереди' });
        }

        if (queueItem.assigned_to !== employee_id) {
            return res.status(403).json({ success: false, error: 'Лид назначен другому сотруднику' });
        }

        // Return to pending
        db.prepare(`
            UPDATE lead_queue SET
                status = 'pending',
                assigned_to = NULL,
                assigned_at = NULL,
                expires_at = NULL
            WHERE id = ?
        `).run(req.params.queueId);

        // Remove assignment from deal
        db.prepare(`
            UPDATE deals SET assigned_to = NULL, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(queueItem.deal_id);

        res.json({ success: true });
    } catch (error) {
        console.error('Reject lead error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Check for expired assignments and reassign
router.post('/:projectId/check-expired', (req, res) => {
    try {
        const db = getDb();

        // Get expired assignments
        const expired = db.prepare(`
            SELECT q.*, s.auto_reassign
            FROM lead_queue q
            LEFT JOIN lead_distribution_settings s ON s.project_id = q.project_id
            WHERE q.project_id = ?
            AND q.status = 'assigned'
            AND q.expires_at < datetime('now')
        `).all(req.params.projectId);

        const results = [];

        for (const item of expired) {
            if (item.auto_reassign) {
                // Return to queue
                db.prepare(`
                    UPDATE lead_queue SET
                        status = 'pending',
                        assigned_to = NULL,
                        assigned_at = NULL,
                        expires_at = NULL
                    WHERE id = ?
                `).run(item.id);

                db.prepare(`
                    UPDATE deals SET assigned_to = NULL
                    WHERE id = ?
                `).run(item.deal_id);

                results.push({ id: item.id, action: 'returned_to_queue' });
            } else {
                // Just mark as expired
                db.prepare(`
                    UPDATE lead_queue SET status = 'expired'
                    WHERE id = ?
                `).run(item.id);

                results.push({ id: item.id, action: 'marked_expired' });
            }
        }

        res.json({ success: true, processed: results, count: results.length });
    } catch (error) {
        console.error('Check expired error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get distribution stats
router.get('/:projectId/stats', (req, res) => {
    try {
        const db = getDb();
        const { date_from, date_to } = req.query;

        // Employee response times
        const responseTimes = db.prepare(`
            SELECT
                e.id,
                e.first_name,
                e.last_name,
                COUNT(q.id) as total_assigned,
                COUNT(CASE WHEN q.status = 'accepted' THEN 1 END) as accepted,
                COUNT(CASE WHEN q.status = 'expired' THEN 1 END) as expired,
                AVG(
                    CASE WHEN q.status = 'accepted'
                    THEN (julianday(q.assigned_at) - julianday(q.created_at)) * 24 * 60
                    END
                ) as avg_response_minutes
            FROM employees e
            LEFT JOIN lead_queue q ON q.assigned_to = e.id
                AND q.project_id = ?
                ${date_from ? 'AND q.created_at >= ?' : ''}
                ${date_to ? 'AND q.created_at <= ?' : ''}
            WHERE e.project_id = ? AND e.is_active = 1
            GROUP BY e.id
            ORDER BY accepted DESC
        `).all(
            req.params.projectId,
            ...(date_from ? [date_from] : []),
            ...(date_to ? [date_to] : []),
            req.params.projectId
        );

        // Overall stats
        const overall = db.prepare(`
            SELECT
                COUNT(*) as total,
                COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted,
                COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
                AVG(
                    CASE WHEN status = 'accepted'
                    THEN (julianday(assigned_at) - julianday(created_at)) * 24 * 60
                    END
                ) as avg_response_minutes
            FROM lead_queue
            WHERE project_id = ?
            ${date_from ? 'AND created_at >= ?' : ''}
            ${date_to ? 'AND created_at <= ?' : ''}
        `).get(
            req.params.projectId,
            ...(date_from ? [date_from] : []),
            ...(date_to ? [date_to] : [])
        );

        res.json({
            success: true,
            stats: {
                overall,
                byEmployee: responseTimes
            }
        });
    } catch (error) {
        console.error('Get distribution stats error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;

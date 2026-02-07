const express = require('express');
const router = express.Router();
const { getDb } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// ============================================================
// TASKS
// ============================================================

// Get all tasks for project
router.get('/:projectId', (req, res) => {
    try {
        const db = getDb();
        const { status, priority, assigned_to, due_date, search } = req.query;

        let query = `
            SELECT t.*,
                e.first_name as assignee_first_name,
                e.last_name as assignee_last_name,
                c.first_name as creator_first_name,
                c.last_name as creator_last_name
            FROM tasks t
            LEFT JOIN employees e ON e.id = t.assigned_to
            LEFT JOIN employees c ON c.id = t.created_by
            WHERE t.project_id = ?
        `;
        const params = [req.params.projectId];

        if (status) {
            query += ` AND t.status = ?`;
            params.push(status);
        }
        if (priority) {
            query += ` AND t.priority = ?`;
            params.push(priority);
        }
        if (assigned_to) {
            query += ` AND t.assigned_to = ?`;
            params.push(assigned_to);
        }
        if (due_date === 'overdue') {
            query += ` AND t.due_date < datetime('now') AND t.status != 'done'`;
        } else if (due_date === 'today') {
            query += ` AND date(t.due_date) = date('now')`;
        } else if (due_date === 'week') {
            query += ` AND t.due_date BETWEEN datetime('now') AND datetime('now', '+7 days')`;
        }
        if (search) {
            query += ` AND (t.title LIKE ? OR t.description LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`);
        }

        query += ` ORDER BY
            CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
            t.due_date ASC NULLS LAST
        `;

        const tasks = db.prepare(query).all(...params);

        // Get task counts by status
        const counts = db.prepare(`
            SELECT status, COUNT(*) as count FROM tasks WHERE project_id = ? GROUP BY status
        `).all(req.params.projectId);

        res.json({
            success: true,
            tasks,
            counts: counts.reduce((acc, c) => ({ ...acc, [c.status]: c.count }), {})
        });
    } catch (error) {
        console.error('Get tasks error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get single task
router.get('/:projectId/:taskId', (req, res) => {
    try {
        const db = getDb();
        const task = db.prepare(`
            SELECT t.*,
                e.first_name as assignee_first_name,
                e.last_name as assignee_last_name,
                c.first_name as creator_first_name,
                c.last_name as creator_last_name
            FROM tasks t
            LEFT JOIN employees e ON e.id = t.assigned_to
            LEFT JOIN employees c ON c.id = t.created_by
            WHERE t.id = ? AND t.project_id = ?
        `).get(req.params.taskId, req.params.projectId);

        if (!task) {
            return res.status(404).json({ success: false, error: 'Задача не найдена' });
        }

        // Get related entity info
        let relatedEntity = null;
        if (task.related_type && task.related_id) {
            if (task.related_type === 'deal') {
                relatedEntity = db.prepare('SELECT id, title FROM deals WHERE id = ?').get(task.related_id);
            } else if (task.related_type === 'client') {
                relatedEntity = db.prepare('SELECT id, first_name, last_name FROM clients WHERE id = ?').get(task.related_id);
            } else if (task.related_type === 'order') {
                relatedEntity = db.prepare('SELECT id, order_number FROM orders WHERE id = ?').get(task.related_id);
            }
        }

        res.json({
            success: true,
            task,
            relatedEntity
        });
    } catch (error) {
        console.error('Get task error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create task
router.post('/:projectId', (req, res) => {
    try {
        const db = getDb();
        const id = uuidv4();
        const {
            title, description, priority, status, due_date, due_time,
            assigned_to, created_by, related_type, related_id
        } = req.body;

        if (!title) {
            return res.status(400).json({ success: false, error: 'Название задачи обязательно' });
        }

        db.prepare(`
            INSERT INTO tasks (
                id, project_id, title, description, priority, status,
                due_date, due_time, assigned_to, created_by, related_type, related_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            id, req.params.projectId, title, description,
            priority || 'medium', status || 'todo',
            due_date, due_time, assigned_to, created_by,
            related_type, related_id
        );

        const task = db.prepare(`
            SELECT t.*, e.first_name as assignee_first_name, e.last_name as assignee_last_name
            FROM tasks t
            LEFT JOIN employees e ON e.id = t.assigned_to
            WHERE t.id = ?
        `).get(id);

        res.json({ success: true, task });
    } catch (error) {
        console.error('Create task error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update task
router.put('/:projectId/:taskId', (req, res) => {
    try {
        const db = getDb();
        const {
            title, description, priority, status, due_date, due_time,
            assigned_to, related_type, related_id
        } = req.body;

        // If marking as done, set completed_at
        let completedAt = null;
        if (status === 'done') {
            completedAt = new Date().toISOString();
        }

        db.prepare(`
            UPDATE tasks SET
                title = COALESCE(?, title),
                description = COALESCE(?, description),
                priority = COALESCE(?, priority),
                status = COALESCE(?, status),
                due_date = COALESCE(?, due_date),
                due_time = COALESCE(?, due_time),
                assigned_to = COALESCE(?, assigned_to),
                related_type = COALESCE(?, related_type),
                related_id = COALESCE(?, related_id),
                completed_at = COALESCE(?, completed_at),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND project_id = ?
        `).run(
            title, description, priority, status,
            due_date, due_time, assigned_to,
            related_type, related_id, completedAt,
            req.params.taskId, req.params.projectId
        );

        const task = db.prepare(`
            SELECT t.*, e.first_name as assignee_first_name, e.last_name as assignee_last_name
            FROM tasks t
            LEFT JOIN employees e ON e.id = t.assigned_to
            WHERE t.id = ?
        `).get(req.params.taskId);

        res.json({ success: true, task });
    } catch (error) {
        console.error('Update task error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update task status (quick action)
router.patch('/:projectId/:taskId/status', (req, res) => {
    try {
        const db = getDb();
        const { status } = req.body;

        let completedAt = null;
        if (status === 'done') {
            completedAt = new Date().toISOString();
        }

        db.prepare(`
            UPDATE tasks SET
                status = ?,
                completed_at = COALESCE(?, completed_at),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND project_id = ?
        `).run(status, completedAt, req.params.taskId, req.params.projectId);

        res.json({ success: true });
    } catch (error) {
        console.error('Update task status error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete task
router.delete('/:projectId/:taskId', (req, res) => {
    try {
        const db = getDb();
        db.prepare('DELETE FROM tasks WHERE id = ? AND project_id = ?')
            .run(req.params.taskId, req.params.projectId);

        res.json({ success: true });
    } catch (error) {
        console.error('Delete task error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get my tasks (for employee)
router.get('/:projectId/my/:employeeId', (req, res) => {
    try {
        const db = getDb();
        const tasks = db.prepare(`
            SELECT t.*,
                c.first_name as creator_first_name,
                c.last_name as creator_last_name
            FROM tasks t
            LEFT JOIN employees c ON c.id = t.created_by
            WHERE t.project_id = ? AND t.assigned_to = ?
            ORDER BY
                CASE t.status WHEN 'in_progress' THEN 1 WHEN 'todo' THEN 2 ELSE 3 END,
                CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
                t.due_date ASC NULLS LAST
        `).all(req.params.projectId, req.params.employeeId);

        res.json({ success: true, tasks });
    } catch (error) {
        console.error('Get my tasks error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;

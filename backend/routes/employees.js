const express = require('express');
const router = express.Router();
const { getDb } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// ============================================================
// EMPLOYEES
// ============================================================

// Get all employees for project
router.get('/:projectId', (req, res) => {
    try {
        const db = getDb();
        const { department, role, is_active } = req.query;

        let query = `SELECT * FROM employees WHERE project_id = ?`;
        const params = [req.params.projectId];

        if (department) {
            query += ` AND department = ?`;
            params.push(department);
        }
        if (role) {
            query += ` AND role = ?`;
            params.push(role);
        }
        if (is_active !== undefined) {
            query += ` AND is_active = ?`;
            params.push(is_active === 'true' ? 1 : 0);
        }

        query += ` ORDER BY last_name, first_name`;

        const employees = db.prepare(query).all(...params);

        res.json({
            success: true,
            employees: employees.map(e => ({
                ...e,
                permissions: JSON.parse(e.permissions || '{}'),
                password_hash: undefined // Don't expose password
            }))
        });
    } catch (error) {
        console.error('Get employees error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get single employee
router.get('/:projectId/:employeeId', (req, res) => {
    try {
        const db = getDb();
        const employee = db.prepare(`
            SELECT * FROM employees WHERE id = ? AND project_id = ?
        `).get(req.params.employeeId, req.params.projectId);

        if (!employee) {
            return res.status(404).json({ success: false, error: 'Сотрудник не найден' });
        }

        // Get assigned tasks
        const tasks = db.prepare(`
            SELECT * FROM tasks WHERE assignee_id = ? ORDER BY due_date, created_at DESC LIMIT 50
        `).all(employee.id);

        // Get assigned deals
        const deals = db.prepare(`
            SELECT d.*, c.first_name as client_first_name, c.last_name as client_last_name, fs.name as stage_name
            FROM deals d
            LEFT JOIN clients c ON c.id = d.client_id
            LEFT JOIN funnel_stages fs ON fs.id = d.stage_id
            WHERE d.assigned_to = ?
            ORDER BY d.updated_at DESC LIMIT 20
        `).all(employee.id);

        res.json({
            success: true,
            employee: {
                ...employee,
                permissions: JSON.parse(employee.permissions || '{}'),
                password_hash: undefined
            },
            tasks,
            deals
        });
    } catch (error) {
        console.error('Get employee error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create employee
router.post('/:projectId', (req, res) => {
    try {
        const db = getDb();
        const id = uuidv4();
        const {
            email, first_name, last_name, middle_name, phone,
            avatar_url, position, department, role, permissions, telegram_id
        } = req.body;

        if (!email || !first_name || !last_name) {
            return res.status(400).json({ success: false, error: 'Email, имя и фамилия обязательны' });
        }

        db.prepare(`
            INSERT INTO employees (
                id, project_id, email, first_name, last_name, middle_name, phone,
                avatar_url, position, department, role, permissions, telegram_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            id, req.params.projectId, email, first_name, last_name, middle_name, phone,
            avatar_url, position, department, role || 'manager',
            JSON.stringify(permissions || {}), telegram_id
        );

        const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(id);

        res.json({
            success: true,
            employee: {
                ...employee,
                permissions: JSON.parse(employee.permissions || '{}')
            }
        });
    } catch (error) {
        console.error('Create employee error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update employee
router.put('/:projectId/:employeeId', (req, res) => {
    try {
        const db = getDb();
        const {
            email, first_name, last_name, middle_name, phone,
            avatar_url, position, department, role, permissions, telegram_id, is_active
        } = req.body;

        db.prepare(`
            UPDATE employees SET
                email = COALESCE(?, email),
                first_name = COALESCE(?, first_name),
                last_name = COALESCE(?, last_name),
                middle_name = COALESCE(?, middle_name),
                phone = COALESCE(?, phone),
                avatar_url = COALESCE(?, avatar_url),
                position = COALESCE(?, position),
                department = COALESCE(?, department),
                role = COALESCE(?, role),
                permissions = COALESCE(?, permissions),
                telegram_id = COALESCE(?, telegram_id),
                is_active = COALESCE(?, is_active),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND project_id = ?
        `).run(
            email, first_name, last_name, middle_name, phone,
            avatar_url, position, department, role,
            permissions ? JSON.stringify(permissions) : null,
            telegram_id, is_active !== undefined ? (is_active ? 1 : 0) : null,
            req.params.employeeId, req.params.projectId
        );

        const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.employeeId);

        res.json({
            success: true,
            employee: {
                ...employee,
                permissions: JSON.parse(employee.permissions || '{}')
            }
        });
    } catch (error) {
        console.error('Update employee error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete employee
router.delete('/:projectId/:employeeId', (req, res) => {
    try {
        const db = getDb();
        db.prepare('DELETE FROM employees WHERE id = ? AND project_id = ?')
            .run(req.params.employeeId, req.params.projectId);

        res.json({ success: true });
    } catch (error) {
        console.error('Delete employee error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// TASKS
// ============================================================

// Get all tasks for project
router.get('/:projectId/tasks/list', (req, res) => {
    try {
        const db = getDb();
        const { assignee_id, status, priority, client_id, deal_id } = req.query;

        let query = `
            SELECT t.*,
                e.first_name as assignee_first_name, e.last_name as assignee_last_name,
                c.first_name as client_first_name, c.last_name as client_last_name
            FROM tasks t
            LEFT JOIN employees e ON e.id = t.assignee_id
            LEFT JOIN clients c ON c.id = t.client_id
            WHERE t.project_id = ?
        `;
        const params = [req.params.projectId];

        if (assignee_id) {
            query += ` AND t.assignee_id = ?`;
            params.push(assignee_id);
        }
        if (status) {
            query += ` AND t.status = ?`;
            params.push(status);
        }
        if (priority) {
            query += ` AND t.priority = ?`;
            params.push(priority);
        }
        if (client_id) {
            query += ` AND t.client_id = ?`;
            params.push(client_id);
        }
        if (deal_id) {
            query += ` AND t.deal_id = ?`;
            params.push(deal_id);
        }

        query += ` ORDER BY
            CASE t.priority
                WHEN 'urgent' THEN 1
                WHEN 'high' THEN 2
                WHEN 'normal' THEN 3
                WHEN 'low' THEN 4
            END,
            t.due_date NULLS LAST,
            t.created_at DESC`;

        const tasks = db.prepare(query).all(...params);

        res.json({ success: true, tasks });
    } catch (error) {
        console.error('Get tasks error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get single task
router.get('/:projectId/tasks/:taskId', (req, res) => {
    try {
        const db = getDb();
        const task = db.prepare(`
            SELECT t.*,
                e.first_name as assignee_first_name, e.last_name as assignee_last_name,
                cr.first_name as creator_first_name, cr.last_name as creator_last_name,
                c.first_name as client_first_name, c.last_name as client_last_name, c.email as client_email
            FROM tasks t
            LEFT JOIN employees e ON e.id = t.assignee_id
            LEFT JOIN employees cr ON cr.id = t.creator_id
            LEFT JOIN clients c ON c.id = t.client_id
            WHERE t.id = ? AND t.project_id = ?
        `).get(req.params.taskId, req.params.projectId);

        if (!task) {
            return res.status(404).json({ success: false, error: 'Задача не найдена' });
        }

        res.json({ success: true, task });
    } catch (error) {
        console.error('Get task error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create task
router.post('/:projectId/tasks', (req, res) => {
    try {
        const db = getDb();
        const id = uuidv4();
        const {
            title, description, assignee_id, creator_id,
            client_id, deal_id, order_id, priority, due_date
        } = req.body;

        if (!title) {
            return res.status(400).json({ success: false, error: 'Название задачи обязательно' });
        }

        db.prepare(`
            INSERT INTO tasks (
                id, project_id, title, description, assignee_id, creator_id,
                client_id, deal_id, order_id, priority, due_date
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            id, req.params.projectId, title, description, assignee_id, creator_id,
            client_id, deal_id, order_id, priority || 'normal', due_date
        );

        const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);

        res.json({ success: true, task });
    } catch (error) {
        console.error('Create task error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update task
router.put('/:projectId/tasks/:taskId', (req, res) => {
    try {
        const db = getDb();
        const {
            title, description, assignee_id, client_id, deal_id, order_id,
            priority, status, due_date
        } = req.body;

        const currentTask = db.prepare('SELECT status FROM tasks WHERE id = ?').get(req.params.taskId);

        db.prepare(`
            UPDATE tasks SET
                title = COALESCE(?, title),
                description = COALESCE(?, description),
                assignee_id = COALESCE(?, assignee_id),
                client_id = COALESCE(?, client_id),
                deal_id = COALESCE(?, deal_id),
                order_id = COALESCE(?, order_id),
                priority = COALESCE(?, priority),
                status = COALESCE(?, status),
                due_date = COALESCE(?, due_date),
                completed_at = CASE WHEN ? = 'completed' AND ? != 'completed' THEN CURRENT_TIMESTAMP ELSE completed_at END,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND project_id = ?
        `).run(
            title, description, assignee_id, client_id, deal_id, order_id,
            priority, status, due_date,
            status, currentTask?.status,
            req.params.taskId, req.params.projectId
        );

        const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.taskId);

        res.json({ success: true, task });
    } catch (error) {
        console.error('Update task error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete task
router.delete('/:projectId/tasks/:taskId', (req, res) => {
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

module.exports = router;

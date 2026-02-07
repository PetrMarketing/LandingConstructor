const express = require('express');
const router = express.Router();
const { getDb } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// ============================================================
// CLIENT INTERACTIONS
// ============================================================

// Get all interactions for client
router.get('/:projectId/client/:clientId', (req, res) => {
    try {
        const db = getDb();
        const { type, limit = 50, offset = 0 } = req.query;

        let query = `
            SELECT i.*,
                e.first_name as employee_first_name,
                e.last_name as employee_last_name
            FROM client_interactions i
            LEFT JOIN employees e ON e.id = i.employee_id
            WHERE i.client_id = ?
        `;
        const params = [req.params.clientId];

        if (type) {
            query += ` AND i.type = ?`;
            params.push(type);
        }

        query += ` ORDER BY i.created_at DESC LIMIT ? OFFSET ?`;
        params.push(Number(limit), Number(offset));

        const interactions = db.prepare(query).all(...params);

        res.json({
            success: true,
            interactions: interactions.map(i => ({
                ...i,
                metadata: JSON.parse(i.metadata || '{}')
            }))
        });
    } catch (error) {
        console.error('Get client interactions error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get all interactions for project (timeline)
router.get('/:projectId', (req, res) => {
    try {
        const db = getDb();
        const { type, employee_id, date_from, date_to, limit = 100, offset = 0 } = req.query;

        let query = `
            SELECT i.*,
                c.first_name as client_first_name,
                c.last_name as client_last_name,
                e.first_name as employee_first_name,
                e.last_name as employee_last_name
            FROM client_interactions i
            LEFT JOIN clients c ON c.id = i.client_id
            LEFT JOIN employees e ON e.id = i.employee_id
            WHERE c.project_id = ?
        `;
        const params = [req.params.projectId];

        if (type) {
            query += ` AND i.type = ?`;
            params.push(type);
        }
        if (employee_id) {
            query += ` AND i.employee_id = ?`;
            params.push(employee_id);
        }
        if (date_from) {
            query += ` AND i.created_at >= ?`;
            params.push(date_from);
        }
        if (date_to) {
            query += ` AND i.created_at <= ?`;
            params.push(date_to);
        }

        query += ` ORDER BY i.created_at DESC LIMIT ? OFFSET ?`;
        params.push(Number(limit), Number(offset));

        const interactions = db.prepare(query).all(...params);

        // Get stats
        const stats = db.prepare(`
            SELECT type, COUNT(*) as count
            FROM client_interactions i
            JOIN clients c ON c.id = i.client_id
            WHERE c.project_id = ?
            GROUP BY type
        `).all(req.params.projectId);

        res.json({
            success: true,
            interactions: interactions.map(i => ({
                ...i,
                metadata: JSON.parse(i.metadata || '{}')
            })),
            stats: stats.reduce((acc, s) => ({ ...acc, [s.type]: s.count }), {})
        });
    } catch (error) {
        console.error('Get interactions error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create interaction
router.post('/:projectId', (req, res) => {
    try {
        const db = getDb();
        const id = uuidv4();
        const {
            client_id, employee_id, type, channel,
            subject, content, duration, metadata, outcome
        } = req.body;

        if (!client_id || !type) {
            return res.status(400).json({ success: false, error: 'Клиент и тип обязательны' });
        }

        db.prepare(`
            INSERT INTO client_interactions (
                id, client_id, employee_id, type, channel,
                subject, content, duration, metadata, outcome
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            id, client_id, employee_id, type, channel,
            subject, content, duration,
            JSON.stringify(metadata || {}), outcome
        );

        const interaction = db.prepare(`
            SELECT i.*, e.first_name as employee_first_name, e.last_name as employee_last_name
            FROM client_interactions i
            LEFT JOIN employees e ON e.id = i.employee_id
            WHERE i.id = ?
        `).get(id);

        res.json({
            success: true,
            interaction: {
                ...interaction,
                metadata: JSON.parse(interaction.metadata || '{}')
            }
        });
    } catch (error) {
        console.error('Create interaction error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update interaction
router.put('/:projectId/:interactionId', (req, res) => {
    try {
        const db = getDb();
        const { subject, content, outcome, metadata } = req.body;

        db.prepare(`
            UPDATE client_interactions SET
                subject = COALESCE(?, subject),
                content = COALESCE(?, content),
                outcome = COALESCE(?, outcome),
                metadata = COALESCE(?, metadata)
            WHERE id = ?
        `).run(
            subject, content, outcome,
            metadata ? JSON.stringify(metadata) : null,
            req.params.interactionId
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Update interaction error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete interaction
router.delete('/:projectId/:interactionId', (req, res) => {
    try {
        const db = getDb();
        db.prepare('DELETE FROM client_interactions WHERE id = ?').run(req.params.interactionId);

        res.json({ success: true });
    } catch (error) {
        console.error('Delete interaction error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// LOYALTY TRANSACTIONS
// ============================================================

// Get loyalty transactions for client
router.get('/:projectId/loyalty/:clientId', (req, res) => {
    try {
        const db = getDb();
        const transactions = db.prepare(`
            SELECT lt.*,
                o.order_number
            FROM loyalty_transactions lt
            LEFT JOIN orders o ON o.id = lt.order_id
            WHERE lt.client_id = ?
            ORDER BY lt.created_at DESC
        `).all(req.params.clientId);

        // Get current balance
        const client = db.prepare('SELECT loyalty_points FROM clients WHERE id = ?').get(req.params.clientId);

        res.json({
            success: true,
            transactions,
            balance: client?.loyalty_points || 0
        });
    } catch (error) {
        console.error('Get loyalty transactions error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Add loyalty points
router.post('/:projectId/loyalty/:clientId', (req, res) => {
    try {
        const db = getDb();
        const id = uuidv4();
        const { points, type, order_id, description, expires_at } = req.body;

        if (!points) {
            return res.status(400).json({ success: false, error: 'Укажите количество баллов' });
        }

        db.prepare(`
            INSERT INTO loyalty_transactions (id, client_id, points, type, order_id, description, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(id, req.params.clientId, points, type || 'manual', order_id, description, expires_at);

        // Update client balance
        db.prepare(`
            UPDATE clients SET loyalty_points = loyalty_points + ? WHERE id = ?
        `).run(points, req.params.clientId);

        const client = db.prepare('SELECT loyalty_points FROM clients WHERE id = ?').get(req.params.clientId);

        res.json({
            success: true,
            balance: client.loyalty_points
        });
    } catch (error) {
        console.error('Add loyalty points error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Deduct loyalty points
router.post('/:projectId/loyalty/:clientId/deduct', (req, res) => {
    try {
        const db = getDb();
        const id = uuidv4();
        const { points, order_id, description } = req.body;

        if (!points || points <= 0) {
            return res.status(400).json({ success: false, error: 'Укажите количество баллов' });
        }

        // Check balance
        const client = db.prepare('SELECT loyalty_points FROM clients WHERE id = ?').get(req.params.clientId);
        if (client.loyalty_points < points) {
            return res.status(400).json({ success: false, error: 'Недостаточно баллов' });
        }

        db.prepare(`
            INSERT INTO loyalty_transactions (id, client_id, points, type, order_id, description)
            VALUES (?, ?, ?, 'redemption', ?, ?)
        `).run(id, req.params.clientId, -points, order_id, description);

        // Update client balance
        db.prepare(`
            UPDATE clients SET loyalty_points = loyalty_points - ? WHERE id = ?
        `).run(points, req.params.clientId);

        const updatedClient = db.prepare('SELECT loyalty_points FROM clients WHERE id = ?').get(req.params.clientId);

        res.json({
            success: true,
            balance: updatedClient.loyalty_points
        });
    } catch (error) {
        console.error('Deduct loyalty points error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;

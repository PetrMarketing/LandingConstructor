const express = require('express');
const router = express.Router();
const { getDb } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// ============================================================
// CLIENTS
// ============================================================

// Get all clients for project
router.get('/:projectId', (req, res) => {
    try {
        const db = getDb();
        const { search, segment, tag, limit = 50, offset = 0 } = req.query;

        let query = `SELECT * FROM clients WHERE project_id = ?`;
        const params = [req.params.projectId];

        if (search) {
            query += ` AND (email LIKE ? OR phone LIKE ? OR first_name LIKE ? OR last_name LIKE ? OR company LIKE ?)`;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
        }

        if (tag) {
            query += ` AND tags LIKE ?`;
            params.push(`%"${tag}"%`);
        }

        query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
        params.push(Number(limit), Number(offset));

        const clients = db.prepare(query).all(...params);

        // Get total count
        let countQuery = `SELECT COUNT(*) as total FROM clients WHERE project_id = ?`;
        const countParams = [req.params.projectId];
        if (search) {
            countQuery += ` AND (email LIKE ? OR phone LIKE ? OR first_name LIKE ? OR last_name LIKE ? OR company LIKE ?)`;
            const searchTerm = `%${search}%`;
            countParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
        }
        const { total } = db.prepare(countQuery).get(...countParams);

        res.json({
            success: true,
            clients: clients.map(c => ({
                ...c,
                tags: JSON.parse(c.tags || '[]'),
                custom_fields: JSON.parse(c.custom_fields || '{}')
            })),
            total,
            limit: Number(limit),
            offset: Number(offset)
        });
    } catch (error) {
        console.error('Get clients error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get single client
router.get('/:projectId/:clientId', (req, res) => {
    try {
        const db = getDb();
        const client = db.prepare(`
            SELECT * FROM clients WHERE id = ? AND project_id = ?
        `).get(req.params.clientId, req.params.projectId);

        if (!client) {
            return res.status(404).json({ success: false, error: 'Клиент не найден' });
        }

        // Get interactions
        const interactions = db.prepare(`
            SELECT ci.*, e.first_name as employee_first_name, e.last_name as employee_last_name
            FROM client_interactions ci
            LEFT JOIN employees e ON e.id = ci.employee_id
            WHERE ci.client_id = ?
            ORDER BY ci.created_at DESC
            LIMIT 50
        `).all(client.id);

        // Get orders
        const orders = db.prepare(`
            SELECT * FROM orders WHERE customer_id = ? OR customer_email = ?
            ORDER BY created_at DESC LIMIT 20
        `).all(client.user_id || client.id, client.email);

        // Get deals
        const deals = db.prepare(`
            SELECT d.*, fs.name as stage_name, f.name as funnel_name
            FROM deals d
            LEFT JOIN funnel_stages fs ON fs.id = d.stage_id
            LEFT JOIN funnels f ON f.id = d.funnel_id
            WHERE d.client_id = ?
            ORDER BY d.created_at DESC
        `).all(client.id);

        // Get loyalty transactions
        const loyalty = db.prepare(`
            SELECT * FROM loyalty_transactions WHERE client_id = ?
            ORDER BY created_at DESC LIMIT 50
        `).all(client.id);

        res.json({
            success: true,
            client: {
                ...client,
                tags: JSON.parse(client.tags || '[]'),
                custom_fields: JSON.parse(client.custom_fields || '{}')
            },
            interactions,
            orders,
            deals,
            loyalty
        });
    } catch (error) {
        console.error('Get client error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create client
router.post('/:projectId', (req, res) => {
    try {
        const db = getDb();
        const id = uuidv4();
        const {
            email, phone, first_name, last_name, middle_name,
            company, position, telegram_id, telegram_username,
            source, utm_source, utm_medium, utm_campaign,
            tags, custom_fields, notes
        } = req.body;

        db.prepare(`
            INSERT INTO clients (
                id, project_id, email, phone, first_name, last_name, middle_name,
                company, position, telegram_id, telegram_username,
                source, utm_source, utm_medium, utm_campaign,
                tags, custom_fields, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            id, req.params.projectId, email, phone, first_name, last_name, middle_name,
            company, position, telegram_id, telegram_username,
            source, utm_source, utm_medium, utm_campaign,
            JSON.stringify(tags || []), JSON.stringify(custom_fields || {}), notes
        );

        const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);

        res.json({
            success: true,
            client: {
                ...client,
                tags: JSON.parse(client.tags || '[]'),
                custom_fields: JSON.parse(client.custom_fields || '{}')
            }
        });
    } catch (error) {
        console.error('Create client error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update client
router.put('/:projectId/:clientId', (req, res) => {
    try {
        const db = getDb();
        const {
            email, phone, first_name, last_name, middle_name,
            company, position, telegram_id, telegram_username,
            tags, custom_fields, notes, loyalty_points, loyalty_level, is_subscribed
        } = req.body;

        db.prepare(`
            UPDATE clients SET
                email = COALESCE(?, email),
                phone = COALESCE(?, phone),
                first_name = COALESCE(?, first_name),
                last_name = COALESCE(?, last_name),
                middle_name = COALESCE(?, middle_name),
                company = COALESCE(?, company),
                position = COALESCE(?, position),
                telegram_id = COALESCE(?, telegram_id),
                telegram_username = COALESCE(?, telegram_username),
                tags = COALESCE(?, tags),
                custom_fields = COALESCE(?, custom_fields),
                notes = COALESCE(?, notes),
                loyalty_points = COALESCE(?, loyalty_points),
                loyalty_level = COALESCE(?, loyalty_level),
                is_subscribed = COALESCE(?, is_subscribed),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND project_id = ?
        `).run(
            email, phone, first_name, last_name, middle_name,
            company, position, telegram_id, telegram_username,
            tags ? JSON.stringify(tags) : null,
            custom_fields ? JSON.stringify(custom_fields) : null,
            notes, loyalty_points, loyalty_level, is_subscribed,
            req.params.clientId, req.params.projectId
        );

        const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.clientId);

        res.json({
            success: true,
            client: {
                ...client,
                tags: JSON.parse(client.tags || '[]'),
                custom_fields: JSON.parse(client.custom_fields || '{}')
            }
        });
    } catch (error) {
        console.error('Update client error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete client
router.delete('/:projectId/:clientId', (req, res) => {
    try {
        const db = getDb();
        db.prepare('DELETE FROM clients WHERE id = ? AND project_id = ?')
            .run(req.params.clientId, req.params.projectId);

        res.json({ success: true });
    } catch (error) {
        console.error('Delete client error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Add interaction
router.post('/:projectId/:clientId/interactions', (req, res) => {
    try {
        const db = getDb();
        const id = uuidv4();
        const { type, direction, subject, content, result, employee_id, deal_id, duration } = req.body;

        db.prepare(`
            INSERT INTO client_interactions (id, client_id, type, direction, subject, content, result, employee_id, deal_id, duration)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, req.params.clientId, type, direction, subject, content, result, employee_id, deal_id, duration);

        const interaction = db.prepare('SELECT * FROM client_interactions WHERE id = ?').get(id);

        res.json({ success: true, interaction });
    } catch (error) {
        console.error('Add interaction error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Add loyalty points
router.post('/:projectId/:clientId/loyalty', (req, res) => {
    try {
        const db = getDb();
        const id = uuidv4();
        const { points, type, description, order_id, employee_id, expires_at } = req.body;

        db.prepare(`
            INSERT INTO loyalty_transactions (id, client_id, points, type, description, order_id, employee_id, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, req.params.clientId, points, type, description, order_id, employee_id, expires_at);

        // Update client total points
        db.prepare(`
            UPDATE clients SET loyalty_points = loyalty_points + ? WHERE id = ?
        `).run(points, req.params.clientId);

        const transaction = db.prepare('SELECT * FROM loyalty_transactions WHERE id = ?').get(id);
        const client = db.prepare('SELECT loyalty_points FROM clients WHERE id = ?').get(req.params.clientId);

        res.json({ success: true, transaction, new_balance: client.loyalty_points });
    } catch (error) {
        console.error('Add loyalty error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// SEGMENTS
// ============================================================

// Get all segments
router.get('/:projectId/segments/list', (req, res) => {
    try {
        const db = getDb();
        const segments = db.prepare(`
            SELECT * FROM client_segments WHERE project_id = ? ORDER BY name
        `).all(req.params.projectId);

        res.json({
            success: true,
            segments: segments.map(s => ({
                ...s,
                conditions: JSON.parse(s.conditions || '[]')
            }))
        });
    } catch (error) {
        console.error('Get segments error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create segment
router.post('/:projectId/segments', (req, res) => {
    try {
        const db = getDb();
        const id = uuidv4();
        const { name, slug, description, conditions, color, is_dynamic } = req.body;

        db.prepare(`
            INSERT INTO client_segments (id, project_id, name, slug, description, conditions, color, is_dynamic)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, req.params.projectId, name, slug || name.toLowerCase().replace(/\s+/g, '-'),
            description, JSON.stringify(conditions || []), color, is_dynamic ? 1 : 0);

        const segment = db.prepare('SELECT * FROM client_segments WHERE id = ?').get(id);

        res.json({
            success: true,
            segment: {
                ...segment,
                conditions: JSON.parse(segment.conditions || '[]')
            }
        });
    } catch (error) {
        console.error('Create segment error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update segment
router.put('/:projectId/segments/:segmentId', (req, res) => {
    try {
        const db = getDb();
        const { name, description, conditions, color, is_dynamic } = req.body;

        db.prepare(`
            UPDATE client_segments SET
                name = COALESCE(?, name),
                description = COALESCE(?, description),
                conditions = COALESCE(?, conditions),
                color = COALESCE(?, color),
                is_dynamic = COALESCE(?, is_dynamic),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND project_id = ?
        `).run(name, description, conditions ? JSON.stringify(conditions) : null, color,
            is_dynamic !== undefined ? (is_dynamic ? 1 : 0) : null,
            req.params.segmentId, req.params.projectId);

        const segment = db.prepare('SELECT * FROM client_segments WHERE id = ?').get(req.params.segmentId);

        res.json({
            success: true,
            segment: {
                ...segment,
                conditions: JSON.parse(segment.conditions || '[]')
            }
        });
    } catch (error) {
        console.error('Update segment error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete segment
router.delete('/:projectId/segments/:segmentId', (req, res) => {
    try {
        const db = getDb();
        db.prepare('DELETE FROM client_segments WHERE id = ? AND project_id = ?')
            .run(req.params.segmentId, req.params.projectId);

        res.json({ success: true });
    } catch (error) {
        console.error('Delete segment error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get clients in segment
router.get('/:projectId/segments/:segmentId/clients', (req, res) => {
    try {
        const db = getDb();
        const segment = db.prepare('SELECT * FROM client_segments WHERE id = ?').get(req.params.segmentId);

        if (!segment) {
            return res.status(404).json({ success: false, error: 'Сегмент не найден' });
        }

        let clients;
        if (segment.is_dynamic) {
            // TODO: Apply dynamic conditions
            clients = db.prepare('SELECT * FROM clients WHERE project_id = ? LIMIT 100').all(req.params.projectId);
        } else {
            clients = db.prepare(`
                SELECT c.* FROM clients c
                JOIN client_segment_members csm ON csm.client_id = c.id
                WHERE csm.segment_id = ?
            `).all(req.params.segmentId);
        }

        res.json({
            success: true,
            clients: clients.map(c => ({
                ...c,
                tags: JSON.parse(c.tags || '[]')
            }))
        });
    } catch (error) {
        console.error('Get segment clients error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Add client to segment
router.post('/:projectId/segments/:segmentId/clients/:clientId', (req, res) => {
    try {
        const db = getDb();
        db.prepare(`
            INSERT OR IGNORE INTO client_segment_members (client_id, segment_id)
            VALUES (?, ?)
        `).run(req.params.clientId, req.params.segmentId);

        // Update segment count
        const { count } = db.prepare(`
            SELECT COUNT(*) as count FROM client_segment_members WHERE segment_id = ?
        `).get(req.params.segmentId);

        db.prepare('UPDATE client_segments SET client_count = ? WHERE id = ?')
            .run(count, req.params.segmentId);

        res.json({ success: true });
    } catch (error) {
        console.error('Add client to segment error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Remove client from segment
router.delete('/:projectId/segments/:segmentId/clients/:clientId', (req, res) => {
    try {
        const db = getDb();
        db.prepare(`
            DELETE FROM client_segment_members WHERE client_id = ? AND segment_id = ?
        `).run(req.params.clientId, req.params.segmentId);

        res.json({ success: true });
    } catch (error) {
        console.error('Remove client from segment error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;

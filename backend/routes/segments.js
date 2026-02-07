const express = require('express');
const router = express.Router();
const { getDb } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// ============================================================
// CLIENT SEGMENTS
// ============================================================

// Get all segments for project
router.get('/:projectId', (req, res) => {
    try {
        const db = getDb();
        const segments = db.prepare(`
            SELECT s.*,
                (SELECT COUNT(*) FROM client_segment_members WHERE segment_id = s.id) as members_count
            FROM client_segments s
            WHERE s.project_id = ?
            ORDER BY s.created_at DESC
        `).all(req.params.projectId);

        res.json({
            success: true,
            segments: segments.map(s => ({
                ...s,
                rules: JSON.parse(s.rules || '[]')
            }))
        });
    } catch (error) {
        console.error('Get segments error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get single segment with members
router.get('/:projectId/:segmentId', (req, res) => {
    try {
        const db = getDb();
        const segment = db.prepare(`
            SELECT * FROM client_segments WHERE id = ? AND project_id = ?
        `).get(req.params.segmentId, req.params.projectId);

        if (!segment) {
            return res.status(404).json({ success: false, error: 'Сегмент не найден' });
        }

        // Get members
        const members = db.prepare(`
            SELECT c.*, csm.added_at
            FROM clients c
            INNER JOIN client_segment_members csm ON csm.client_id = c.id
            WHERE csm.segment_id = ?
            ORDER BY csm.added_at DESC
        `).all(segment.id);

        res.json({
            success: true,
            segment: {
                ...segment,
                rules: JSON.parse(segment.rules || '[]')
            },
            members
        });
    } catch (error) {
        console.error('Get segment error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create segment
router.post('/:projectId', (req, res) => {
    try {
        const db = getDb();
        const id = uuidv4();
        const { name, description, rules, is_dynamic, color } = req.body;

        if (!name) {
            return res.status(400).json({ success: false, error: 'Название сегмента обязательно' });
        }

        db.prepare(`
            INSERT INTO client_segments (id, project_id, name, description, rules, is_dynamic, color)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(id, req.params.projectId, name, description, JSON.stringify(rules || []), is_dynamic ? 1 : 0, color || '#6366f1');

        // If dynamic segment with rules, populate members automatically
        if (is_dynamic && rules && rules.length > 0) {
            populateSegmentMembers(db, req.params.projectId, id, rules);
        }

        const segment = db.prepare('SELECT * FROM client_segments WHERE id = ?').get(id);

        res.json({
            success: true,
            segment: {
                ...segment,
                rules: JSON.parse(segment.rules || '[]')
            }
        });
    } catch (error) {
        console.error('Create segment error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update segment
router.put('/:projectId/:segmentId', (req, res) => {
    try {
        const db = getDb();
        const { name, description, rules, is_dynamic, color } = req.body;

        db.prepare(`
            UPDATE client_segments SET
                name = COALESCE(?, name),
                description = COALESCE(?, description),
                rules = COALESCE(?, rules),
                is_dynamic = COALESCE(?, is_dynamic),
                color = COALESCE(?, color),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND project_id = ?
        `).run(
            name, description,
            rules ? JSON.stringify(rules) : null,
            is_dynamic !== undefined ? (is_dynamic ? 1 : 0) : null,
            color,
            req.params.segmentId, req.params.projectId
        );

        // Refresh members if dynamic
        const segment = db.prepare('SELECT * FROM client_segments WHERE id = ?').get(req.params.segmentId);
        if (segment && segment.is_dynamic && rules) {
            // Clear existing members
            db.prepare('DELETE FROM client_segment_members WHERE segment_id = ?').run(req.params.segmentId);
            populateSegmentMembers(db, req.params.projectId, req.params.segmentId, rules);
        }

        res.json({
            success: true,
            segment: {
                ...segment,
                rules: JSON.parse(segment.rules || '[]')
            }
        });
    } catch (error) {
        console.error('Update segment error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete segment
router.delete('/:projectId/:segmentId', (req, res) => {
    try {
        const db = getDb();
        // Remove members first
        db.prepare('DELETE FROM client_segment_members WHERE segment_id = ?').run(req.params.segmentId);
        db.prepare('DELETE FROM client_segments WHERE id = ? AND project_id = ?')
            .run(req.params.segmentId, req.params.projectId);

        res.json({ success: true });
    } catch (error) {
        console.error('Delete segment error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Add client to segment manually
router.post('/:projectId/:segmentId/members', (req, res) => {
    try {
        const db = getDb();
        const { client_ids } = req.body;

        if (!client_ids || !client_ids.length) {
            return res.status(400).json({ success: false, error: 'Укажите клиентов' });
        }

        const stmt = db.prepare(`
            INSERT OR IGNORE INTO client_segment_members (segment_id, client_id)
            VALUES (?, ?)
        `);

        for (const clientId of client_ids) {
            stmt.run(req.params.segmentId, clientId);
        }

        res.json({ success: true, added: client_ids.length });
    } catch (error) {
        console.error('Add segment members error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Remove client from segment
router.delete('/:projectId/:segmentId/members/:clientId', (req, res) => {
    try {
        const db = getDb();
        db.prepare('DELETE FROM client_segment_members WHERE segment_id = ? AND client_id = ?')
            .run(req.params.segmentId, req.params.clientId);

        res.json({ success: true });
    } catch (error) {
        console.error('Remove segment member error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Refresh dynamic segment
router.post('/:projectId/:segmentId/refresh', (req, res) => {
    try {
        const db = getDb();
        const segment = db.prepare('SELECT * FROM client_segments WHERE id = ? AND project_id = ?')
            .get(req.params.segmentId, req.params.projectId);

        if (!segment) {
            return res.status(404).json({ success: false, error: 'Сегмент не найден' });
        }

        const rules = JSON.parse(segment.rules || '[]');

        // Clear existing members
        db.prepare('DELETE FROM client_segment_members WHERE segment_id = ?').run(req.params.segmentId);

        // Repopulate
        const count = populateSegmentMembers(db, req.params.projectId, req.params.segmentId, rules);

        res.json({ success: true, members_count: count });
    } catch (error) {
        console.error('Refresh segment error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Helper function to populate segment members based on rules
function populateSegmentMembers(db, projectId, segmentId, rules) {
    // Build query based on rules
    let conditions = ['project_id = ?'];
    let params = [projectId];

    for (const rule of rules) {
        switch (rule.field) {
            case 'total_orders':
                if (rule.operator === 'gt') conditions.push(`(SELECT COUNT(*) FROM orders WHERE client_id = clients.id) > ?`);
                if (rule.operator === 'lt') conditions.push(`(SELECT COUNT(*) FROM orders WHERE client_id = clients.id) < ?`);
                if (rule.operator === 'eq') conditions.push(`(SELECT COUNT(*) FROM orders WHERE client_id = clients.id) = ?`);
                params.push(rule.value);
                break;
            case 'total_spent':
                if (rule.operator === 'gt') conditions.push(`(SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE client_id = clients.id) > ?`);
                if (rule.operator === 'lt') conditions.push(`(SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE client_id = clients.id) < ?`);
                params.push(rule.value);
                break;
            case 'last_order_days':
                conditions.push(`(SELECT MAX(created_at) FROM orders WHERE client_id = clients.id) ${rule.operator === 'gt' ? '<' : '>'} datetime('now', '-${rule.value} days')`);
                break;
            case 'tags':
                conditions.push(`tags LIKE ?`);
                params.push(`%${rule.value}%`);
                break;
            case 'city':
                conditions.push(`city = ?`);
                params.push(rule.value);
                break;
            case 'loyalty_points':
                if (rule.operator === 'gt') conditions.push(`loyalty_points > ?`);
                if (rule.operator === 'lt') conditions.push(`loyalty_points < ?`);
                params.push(rule.value);
                break;
        }
    }

    const query = `SELECT id FROM clients WHERE ${conditions.join(' AND ')}`;
    const clients = db.prepare(query).all(...params);

    const stmt = db.prepare('INSERT OR IGNORE INTO client_segment_members (segment_id, client_id) VALUES (?, ?)');
    for (const client of clients) {
        stmt.run(segmentId, client.id);
    }

    return clients.length;
}

module.exports = router;

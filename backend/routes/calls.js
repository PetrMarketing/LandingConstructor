const express = require('express');
const router = express.Router();
const { getDb } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// ============================================================
// CALLS (amoCRM-like)
// ============================================================

// Get all calls for project
router.get('/:projectId', (req, res) => {
    try {
        const db = getDb();
        const { employee_id, client_id, deal_id, direction, status, date_from, date_to, limit = 100, offset = 0 } = req.query;

        let query = `
            SELECT c.*,
                cl.first_name as client_first_name,
                cl.last_name as client_last_name,
                cl.phone as client_phone,
                e.first_name as employee_first_name,
                e.last_name as employee_last_name,
                d.name as deal_name
            FROM calls c
            LEFT JOIN clients cl ON cl.id = c.client_id
            LEFT JOIN employees e ON e.id = c.employee_id
            LEFT JOIN deals d ON d.id = c.deal_id
            WHERE c.project_id = ?
        `;
        const params = [req.params.projectId];

        if (employee_id) {
            query += ` AND c.employee_id = ?`;
            params.push(employee_id);
        }
        if (client_id) {
            query += ` AND c.client_id = ?`;
            params.push(client_id);
        }
        if (deal_id) {
            query += ` AND c.deal_id = ?`;
            params.push(deal_id);
        }
        if (direction) {
            query += ` AND c.direction = ?`;
            params.push(direction);
        }
        if (status) {
            query += ` AND c.status = ?`;
            params.push(status);
        }
        if (date_from) {
            query += ` AND c.created_at >= ?`;
            params.push(date_from);
        }
        if (date_to) {
            query += ` AND c.created_at <= ?`;
            params.push(date_to);
        }

        query += ` ORDER BY c.created_at DESC LIMIT ? OFFSET ?`;
        params.push(Number(limit), Number(offset));

        const calls = db.prepare(query).all(...params);

        // Get stats
        const stats = db.prepare(`
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN direction = 'outgoing' THEN 1 ELSE 0 END) as outgoing,
                SUM(CASE WHEN direction = 'incoming' THEN 1 ELSE 0 END) as incoming,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'missed' THEN 1 ELSE 0 END) as missed,
                SUM(CASE WHEN status = 'completed' THEN duration ELSE 0 END) as total_duration,
                AVG(CASE WHEN status = 'completed' THEN duration ELSE NULL END) as avg_duration
            FROM calls WHERE project_id = ?
        `).get(req.params.projectId);

        res.json({ success: true, calls, stats });
    } catch (error) {
        console.error('Get calls error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get single call
router.get('/:projectId/:callId', (req, res) => {
    try {
        const db = getDb();
        const call = db.prepare(`
            SELECT c.*,
                cl.first_name as client_first_name,
                cl.last_name as client_last_name,
                cl.phone as client_phone,
                cl.email as client_email,
                e.first_name as employee_first_name,
                e.last_name as employee_last_name,
                d.name as deal_name,
                d.amount as deal_amount
            FROM calls c
            LEFT JOIN clients cl ON cl.id = c.client_id
            LEFT JOIN employees e ON e.id = c.employee_id
            LEFT JOIN deals d ON d.id = c.deal_id
            WHERE c.id = ? AND c.project_id = ?
        `).get(req.params.callId, req.params.projectId);

        if (!call) {
            return res.status(404).json({ success: false, error: 'Звонок не найден' });
        }

        res.json({ success: true, call });
    } catch (error) {
        console.error('Get call error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create call (initiate outgoing or log incoming)
router.post('/:projectId', (req, res) => {
    try {
        const db = getDb();
        const id = uuidv4();
        const {
            client_id, employee_id, deal_id, direction, phone_from, phone_to,
            status, duration, recording_url, result, notes, external_id,
            started_at, answered_at, ended_at
        } = req.body;

        db.prepare(`
            INSERT INTO calls (
                id, project_id, client_id, employee_id, deal_id, direction,
                phone_from, phone_to, status, duration, recording_url,
                result, notes, external_id, started_at, answered_at, ended_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            id, req.params.projectId, client_id, employee_id, deal_id,
            direction || 'outgoing', phone_from, phone_to,
            status || 'initiated', duration || 0, recording_url,
            result, notes, external_id,
            started_at || new Date().toISOString(), answered_at, ended_at
        );

        // Log employee activity
        if (employee_id) {
            db.prepare(`
                INSERT INTO employee_activity_log (id, project_id, employee_id, action_type, entity_type, entity_id, metadata)
                VALUES (?, ?, ?, 'call_initiated', 'call', ?, ?)
            `).run(uuidv4(), req.params.projectId, employee_id, id, JSON.stringify({ direction, phone_to }));
        }

        const call = db.prepare('SELECT * FROM calls WHERE id = ?').get(id);

        res.json({ success: true, call });
    } catch (error) {
        console.error('Create call error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update call (answer, end, add notes)
router.put('/:projectId/:callId', (req, res) => {
    try {
        const db = getDb();
        const {
            status, duration, recording_url, transcription, result, notes,
            answered_at, ended_at, client_id, deal_id
        } = req.body;

        db.prepare(`
            UPDATE calls SET
                status = COALESCE(?, status),
                duration = COALESCE(?, duration),
                recording_url = COALESCE(?, recording_url),
                transcription = COALESCE(?, transcription),
                result = COALESCE(?, result),
                notes = COALESCE(?, notes),
                answered_at = COALESCE(?, answered_at),
                ended_at = COALESCE(?, ended_at),
                client_id = COALESCE(?, client_id),
                deal_id = COALESCE(?, deal_id)
            WHERE id = ? AND project_id = ?
        `).run(
            status, duration, recording_url, transcription, result, notes,
            answered_at, ended_at, client_id, deal_id,
            req.params.callId, req.params.projectId
        );

        const call = db.prepare('SELECT * FROM calls WHERE id = ?').get(req.params.callId);

        res.json({ success: true, call });
    } catch (error) {
        console.error('Update call error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete call
router.delete('/:projectId/:callId', (req, res) => {
    try {
        const db = getDb();
        db.prepare('DELETE FROM calls WHERE id = ? AND project_id = ?')
            .run(req.params.callId, req.params.projectId);

        res.json({ success: true });
    } catch (error) {
        console.error('Delete call error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get call stats by employee
router.get('/:projectId/stats/by-employee', (req, res) => {
    try {
        const db = getDb();
        const { date_from, date_to } = req.query;

        let query = `
            SELECT
                e.id as employee_id,
                e.first_name,
                e.last_name,
                COUNT(c.id) as total_calls,
                SUM(CASE WHEN c.direction = 'outgoing' THEN 1 ELSE 0 END) as outgoing,
                SUM(CASE WHEN c.direction = 'incoming' THEN 1 ELSE 0 END) as incoming,
                SUM(CASE WHEN c.status = 'completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN c.status = 'missed' THEN 1 ELSE 0 END) as missed,
                SUM(CASE WHEN c.status = 'completed' THEN c.duration ELSE 0 END) as total_duration,
                AVG(CASE WHEN c.status = 'completed' THEN c.duration ELSE NULL END) as avg_duration
            FROM employees e
            LEFT JOIN calls c ON c.employee_id = e.id
            WHERE e.project_id = ?
        `;
        const params = [req.params.projectId];

        if (date_from) {
            query += ` AND (c.created_at >= ? OR c.created_at IS NULL)`;
            params.push(date_from);
        }
        if (date_to) {
            query += ` AND (c.created_at <= ? OR c.created_at IS NULL)`;
            params.push(date_to);
        }

        query += ` GROUP BY e.id ORDER BY total_calls DESC`;

        const stats = db.prepare(query).all(...params);

        res.json({ success: true, stats });
    } catch (error) {
        console.error('Get call stats error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Webhook for external telephony
router.post('/:projectId/webhook', (req, res) => {
    try {
        const db = getDb();
        const { event, call_id, external_id, status, duration, recording_url, ...data } = req.body;

        console.log(`[Calls Webhook] Event: ${event}`, { call_id, external_id, status });

        // Handle different events
        switch (event) {
            case 'call.started':
            case 'call.ringing': {
                const id = uuidv4();
                db.prepare(`
                    INSERT INTO calls (id, project_id, external_id, direction, phone_from, phone_to, status, started_at)
                    VALUES (?, ?, ?, ?, ?, ?, 'ringing', ?)
                `).run(id, req.params.projectId, external_id, data.direction, data.phone_from, data.phone_to, new Date().toISOString());
                break;
            }
            case 'call.answered': {
                db.prepare(`
                    UPDATE calls SET status = 'in_progress', answered_at = ?
                    WHERE external_id = ? AND project_id = ?
                `).run(new Date().toISOString(), external_id, req.params.projectId);
                break;
            }
            case 'call.ended':
            case 'call.completed': {
                db.prepare(`
                    UPDATE calls SET status = 'completed', duration = ?, recording_url = ?, ended_at = ?
                    WHERE external_id = ? AND project_id = ?
                `).run(duration || 0, recording_url, new Date().toISOString(), external_id, req.params.projectId);
                break;
            }
            case 'call.missed': {
                db.prepare(`
                    UPDATE calls SET status = 'missed', ended_at = ?
                    WHERE external_id = ? AND project_id = ?
                `).run(new Date().toISOString(), external_id, req.params.projectId);
                break;
            }
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Call webhook error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;

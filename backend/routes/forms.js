const express = require('express');
const router = express.Router();
const { getDb } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// ============================================================
// FORMS
// ============================================================

// Get all forms for project
router.get('/:projectId', (req, res) => {
    try {
        const db = getDb();
        const forms = db.prepare(`
            SELECT f.*,
                (SELECT COUNT(*) FROM submissions WHERE form_name = f.slug OR landing_id = f.id) as submissions_count
            FROM forms f
            WHERE f.project_id = ?
            ORDER BY f.name
        `).all(req.params.projectId);

        res.json({
            success: true,
            forms: forms.map(f => ({
                ...f,
                fields: JSON.parse(f.fields || '[]'),
                settings: JSON.parse(f.settings || '{}'),
                notifications: JSON.parse(f.notifications || '[]')
            }))
        });
    } catch (error) {
        console.error('Get forms error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get single form
router.get('/:projectId/:formId', (req, res) => {
    try {
        const db = getDb();
        const form = db.prepare(`
            SELECT * FROM forms WHERE id = ? AND project_id = ?
        `).get(req.params.formId, req.params.projectId);

        if (!form) {
            return res.status(404).json({ success: false, error: 'Форма не найдена' });
        }

        res.json({
            success: true,
            form: {
                ...form,
                fields: JSON.parse(form.fields || '[]'),
                settings: JSON.parse(form.settings || '{}'),
                notifications: JSON.parse(form.notifications || '[]')
            }
        });
    } catch (error) {
        console.error('Get form error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create form
router.post('/:projectId', (req, res) => {
    try {
        const db = getDb();
        const id = uuidv4();
        const { name, slug, fields, settings, success_message, notifications } = req.body;

        if (!name) {
            return res.status(400).json({ success: false, error: 'Название формы обязательно' });
        }

        db.prepare(`
            INSERT INTO forms (id, project_id, name, slug, fields, settings, success_message, notifications)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            id, req.params.projectId, name, slug || name.toLowerCase().replace(/\s+/g, '-'),
            JSON.stringify(fields || []), JSON.stringify(settings || {}),
            success_message, JSON.stringify(notifications || [])
        );

        const form = db.prepare('SELECT * FROM forms WHERE id = ?').get(id);

        res.json({
            success: true,
            form: {
                ...form,
                fields: JSON.parse(form.fields || '[]'),
                settings: JSON.parse(form.settings || '{}'),
                notifications: JSON.parse(form.notifications || '[]')
            }
        });
    } catch (error) {
        console.error('Create form error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update form
router.put('/:projectId/:formId', (req, res) => {
    try {
        const db = getDb();
        const { name, slug, fields, settings, success_message, notifications } = req.body;

        db.prepare(`
            UPDATE forms SET
                name = COALESCE(?, name),
                slug = COALESCE(?, slug),
                fields = COALESCE(?, fields),
                settings = COALESCE(?, settings),
                success_message = COALESCE(?, success_message),
                notifications = COALESCE(?, notifications),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND project_id = ?
        `).run(
            name, slug,
            fields ? JSON.stringify(fields) : null,
            settings ? JSON.stringify(settings) : null,
            success_message,
            notifications ? JSON.stringify(notifications) : null,
            req.params.formId, req.params.projectId
        );

        const form = db.prepare('SELECT * FROM forms WHERE id = ?').get(req.params.formId);

        res.json({
            success: true,
            form: {
                ...form,
                fields: JSON.parse(form.fields || '[]'),
                settings: JSON.parse(form.settings || '{}'),
                notifications: JSON.parse(form.notifications || '[]')
            }
        });
    } catch (error) {
        console.error('Update form error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete form
router.delete('/:projectId/:formId', (req, res) => {
    try {
        const db = getDb();
        db.prepare('DELETE FROM forms WHERE id = ? AND project_id = ?')
            .run(req.params.formId, req.params.projectId);

        res.json({ success: true });
    } catch (error) {
        console.error('Delete form error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// SUBMISSIONS
// ============================================================

// Get all submissions for project
router.get('/:projectId/submissions/list', (req, res) => {
    try {
        const db = getDb();
        const { form_name, landing_id, status, limit = 50, offset = 0 } = req.query;

        let query = `
            SELECT s.*, l.name as landing_name
            FROM submissions s
            LEFT JOIN landings l ON l.id = s.landing_id
            WHERE s.project_id = ?
        `;
        const params = [req.params.projectId];

        if (form_name) {
            query += ` AND s.form_name = ?`;
            params.push(form_name);
        }
        if (landing_id) {
            query += ` AND s.landing_id = ?`;
            params.push(landing_id);
        }
        if (status) {
            query += ` AND s.status = ?`;
            params.push(status);
        }

        query += ` ORDER BY s.created_at DESC LIMIT ? OFFSET ?`;
        params.push(Number(limit), Number(offset));

        const submissions = db.prepare(query).all(...params);

        // Get counts by status
        const stats = db.prepare(`
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as new_count,
                SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing_count,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_count
            FROM submissions WHERE project_id = ?
        `).get(req.params.projectId);

        res.json({
            success: true,
            submissions: submissions.map(s => ({
                ...s,
                data: JSON.parse(s.data || '{}')
            })),
            stats,
            limit: Number(limit),
            offset: Number(offset)
        });
    } catch (error) {
        console.error('Get submissions error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get single submission
router.get('/:projectId/submissions/:submissionId', (req, res) => {
    try {
        const db = getDb();
        const submission = db.prepare(`
            SELECT s.*, l.name as landing_name
            FROM submissions s
            LEFT JOIN landings l ON l.id = s.landing_id
            WHERE s.id = ? AND s.project_id = ?
        `).get(req.params.submissionId, req.params.projectId);

        if (!submission) {
            return res.status(404).json({ success: false, error: 'Заявка не найдена' });
        }

        res.json({
            success: true,
            submission: {
                ...submission,
                data: JSON.parse(submission.data || '{}')
            }
        });
    } catch (error) {
        console.error('Get submission error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create submission (public endpoint - for forms)
router.post('/:projectId/submissions', (req, res) => {
    try {
        const db = getDb();
        const id = uuidv4();
        const { landing_id, form_name, data, source_url } = req.body;

        db.prepare(`
            INSERT INTO submissions (id, project_id, landing_id, form_name, data, source_url, ip_address, user_agent)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            id, req.params.projectId, landing_id, form_name,
            JSON.stringify(data || {}), source_url,
            req.ip, req.get('User-Agent')
        );

        // Try to create/link client
        if (data?.email || data?.phone) {
            let client = db.prepare(`
                SELECT id FROM clients WHERE project_id = ? AND (email = ? OR phone = ?)
            `).get(req.params.projectId, data.email, data.phone);

            if (!client) {
                const clientId = uuidv4();
                db.prepare(`
                    INSERT INTO clients (id, project_id, email, phone, first_name, source, utm_source, utm_medium, utm_campaign)
                    VALUES (?, ?, ?, ?, ?, 'form', ?, ?, ?)
                `).run(
                    clientId, req.params.projectId, data.email, data.phone,
                    data.name || data.first_name, data.utm_source, data.utm_medium, data.utm_campaign
                );
            }
        }

        const submission = db.prepare('SELECT * FROM submissions WHERE id = ?').get(id);

        res.json({
            success: true,
            submission: {
                ...submission,
                data: JSON.parse(submission.data || '{}')
            }
        });
    } catch (error) {
        console.error('Create submission error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update submission status
router.put('/:projectId/submissions/:submissionId', (req, res) => {
    try {
        const db = getDb();
        const { status } = req.body;

        db.prepare(`
            UPDATE submissions SET status = ? WHERE id = ? AND project_id = ?
        `).run(status, req.params.submissionId, req.params.projectId);

        const submission = db.prepare('SELECT * FROM submissions WHERE id = ?').get(req.params.submissionId);

        res.json({
            success: true,
            submission: {
                ...submission,
                data: JSON.parse(submission.data || '{}')
            }
        });
    } catch (error) {
        console.error('Update submission error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete submission
router.delete('/:projectId/submissions/:submissionId', (req, res) => {
    try {
        const db = getDb();
        db.prepare('DELETE FROM submissions WHERE id = ? AND project_id = ?')
            .run(req.params.submissionId, req.params.projectId);

        res.json({ success: true });
    } catch (error) {
        console.error('Delete submission error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// REVIEWS (moved here for convenience)
// ============================================================

// Get reviews for entity
router.get('/:projectId/reviews/:entityType/:entityId', (req, res) => {
    try {
        const db = getDb();
        const { is_approved, limit = 50 } = req.query;

        let query = `
            SELECT r.*, c.first_name, c.last_name, c.avatar_url
            FROM reviews r
            LEFT JOIN clients c ON c.id = r.client_id
            WHERE r.project_id = ? AND r.entity_type = ? AND r.entity_id = ?
        `;
        const params = [req.params.projectId, req.params.entityType, req.params.entityId];

        if (is_approved !== undefined) {
            query += ` AND r.is_approved = ?`;
            params.push(is_approved === 'true' ? 1 : 0);
        }

        query += ` ORDER BY r.created_at DESC LIMIT ?`;
        params.push(Number(limit));

        const reviews = db.prepare(query).all(...params);

        // Get stats
        const stats = db.prepare(`
            SELECT
                COUNT(*) as total,
                AVG(rating) as avg_rating,
                SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as five_star,
                SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as four_star,
                SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as three_star,
                SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as two_star,
                SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as one_star
            FROM reviews WHERE project_id = ? AND entity_type = ? AND entity_id = ? AND is_approved = 1
        `).get(req.params.projectId, req.params.entityType, req.params.entityId);

        res.json({
            success: true,
            reviews: reviews.map(r => ({
                ...r,
                images: JSON.parse(r.images || '[]')
            })),
            stats
        });
    } catch (error) {
        console.error('Get reviews error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create review
router.post('/:projectId/reviews', (req, res) => {
    try {
        const db = getDb();
        const id = uuidv4();
        const { entity_type, entity_id, client_id, rating, title, content, pros, cons, images } = req.body;

        if (!entity_type || !entity_id || !rating) {
            return res.status(400).json({ success: false, error: 'Тип, ID сущности и рейтинг обязательны' });
        }

        db.prepare(`
            INSERT INTO reviews (id, project_id, entity_type, entity_id, client_id, rating, title, content, pros, cons, images)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            id, req.params.projectId, entity_type, entity_id, client_id,
            rating, title, content, pros, cons, JSON.stringify(images || [])
        );

        const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(id);

        res.json({
            success: true,
            review: {
                ...review,
                images: JSON.parse(review.images || '[]')
            }
        });
    } catch (error) {
        console.error('Create review error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Approve/reject review
router.put('/:projectId/reviews/:reviewId', (req, res) => {
    try {
        const db = getDb();
        const { is_approved, admin_reply } = req.body;

        db.prepare(`
            UPDATE reviews SET
                is_approved = COALESCE(?, is_approved),
                admin_reply = COALESCE(?, admin_reply),
                admin_reply_at = CASE WHEN ? IS NOT NULL THEN CURRENT_TIMESTAMP ELSE admin_reply_at END
            WHERE id = ? AND project_id = ?
        `).run(
            is_approved !== undefined ? (is_approved ? 1 : 0) : null,
            admin_reply, admin_reply,
            req.params.reviewId, req.params.projectId
        );

        // Update entity rating
        const review = db.prepare('SELECT entity_type, entity_id FROM reviews WHERE id = ?').get(req.params.reviewId);
        if (review) {
            const { avg_rating, count } = db.prepare(`
                SELECT AVG(rating) as avg_rating, COUNT(*) as count
                FROM reviews WHERE entity_type = ? AND entity_id = ? AND is_approved = 1
            `).get(review.entity_type, review.entity_id);

            if (review.entity_type === 'product') {
                db.prepare('UPDATE products SET rating = ?, reviews_count = ? WHERE id = ?')
                    .run(avg_rating || 0, count, review.entity_id);
            } else if (review.entity_type === 'course') {
                db.prepare('UPDATE courses SET rating = ?, reviews_count = ? WHERE id = ?')
                    .run(avg_rating || 0, count, review.entity_id);
            }
        }

        const updatedReview = db.prepare('SELECT * FROM reviews WHERE id = ?').get(req.params.reviewId);

        res.json({
            success: true,
            review: {
                ...updatedReview,
                images: JSON.parse(updatedReview.images || '[]')
            }
        });
    } catch (error) {
        console.error('Update review error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete review
router.delete('/:projectId/reviews/:reviewId', (req, res) => {
    try {
        const db = getDb();
        db.prepare('DELETE FROM reviews WHERE id = ? AND project_id = ?')
            .run(req.params.reviewId, req.params.projectId);

        res.json({ success: true });
    } catch (error) {
        console.error('Delete review error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;

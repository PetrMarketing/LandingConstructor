const express = require('express');
const router = express.Router();
const { getDb } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// ============================================================
// SERVICES
// ============================================================

// Get all services for project
router.get('/:projectId', (req, res) => {
    try {
        const db = getDb();
        const { category_id, is_featured, is_visible, search, limit = 50, offset = 0 } = req.query;

        let query = `
            SELECT s.*, c.name as category_name
            FROM services s
            LEFT JOIN categories c ON c.id = s.category_id
            WHERE s.project_id = ?
        `;
        const params = [req.params.projectId];

        if (category_id) {
            query += ` AND s.category_id = ?`;
            params.push(category_id);
        }
        if (is_featured !== undefined) {
            query += ` AND s.is_featured = ?`;
            params.push(is_featured === 'true' ? 1 : 0);
        }
        if (is_visible !== undefined) {
            query += ` AND s.is_visible = ?`;
            params.push(is_visible === 'true' ? 1 : 0);
        }
        if (search) {
            query += ` AND (s.name LIKE ? OR s.description LIKE ?)`;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm);
        }

        query += ` ORDER BY s.sort_order, s.name LIMIT ? OFFSET ?`;
        params.push(Number(limit), Number(offset));

        const services = db.prepare(query).all(...params);

        // Get total count
        let countQuery = `SELECT COUNT(*) as total FROM services WHERE project_id = ?`;
        const countParams = [req.params.projectId];
        if (category_id) {
            countQuery += ` AND category_id = ?`;
            countParams.push(category_id);
        }
        const { total } = db.prepare(countQuery).get(...countParams);

        res.json({
            success: true,
            services: services.map(s => ({
                ...s,
                images: JSON.parse(s.images || '[]'),
                features: JSON.parse(s.features || '[]')
            })),
            total,
            limit: Number(limit),
            offset: Number(offset)
        });
    } catch (error) {
        console.error('Get services error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get single service
router.get('/:projectId/:serviceId', (req, res) => {
    try {
        const db = getDb();
        const service = db.prepare(`
            SELECT s.*, c.name as category_name
            FROM services s
            LEFT JOIN categories c ON c.id = s.category_id
            WHERE s.id = ? AND s.project_id = ?
        `).get(req.params.serviceId, req.params.projectId);

        if (!service) {
            return res.status(404).json({ success: false, error: 'Услуга не найдена' });
        }

        // Get reviews
        const reviews = db.prepare(`
            SELECT r.*, cl.first_name, cl.last_name
            FROM reviews r
            LEFT JOIN clients cl ON cl.id = r.client_id
            WHERE r.entity_type = 'service' AND r.entity_id = ? AND r.is_approved = 1
            ORDER BY r.created_at DESC
            LIMIT 20
        `).all(service.id);

        res.json({
            success: true,
            service: {
                ...service,
                images: JSON.parse(service.images || '[]'),
                features: JSON.parse(service.features || '[]')
            },
            reviews
        });
    } catch (error) {
        console.error('Get service error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create service
router.post('/:projectId', (req, res) => {
    try {
        const db = getDb();
        const id = uuidv4();
        const {
            name, slug, description, short_description, price, price_from, price_to,
            duration, category_id, images, features, meta_title, meta_description,
            is_featured, is_visible, sort_order
        } = req.body;

        if (!name) {
            return res.status(400).json({ success: false, error: 'Название услуги обязательно' });
        }

        db.prepare(`
            INSERT INTO services (
                id, project_id, name, slug, description, short_description,
                price, price_from, price_to, duration, category_id, images, features,
                meta_title, meta_description, is_featured, is_visible, sort_order
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            id, req.params.projectId, name, slug || name.toLowerCase().replace(/\s+/g, '-'),
            description, short_description, price, price_from, price_to, duration,
            category_id, JSON.stringify(images || []), JSON.stringify(features || []),
            meta_title, meta_description, is_featured ? 1 : 0, is_visible !== false ? 1 : 0,
            sort_order || 0
        );

        const service = db.prepare('SELECT * FROM services WHERE id = ?').get(id);

        res.json({
            success: true,
            service: {
                ...service,
                images: JSON.parse(service.images || '[]'),
                features: JSON.parse(service.features || '[]')
            }
        });
    } catch (error) {
        console.error('Create service error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update service
router.put('/:projectId/:serviceId', (req, res) => {
    try {
        const db = getDb();
        const {
            name, slug, description, short_description, price, price_from, price_to,
            duration, category_id, images, features, meta_title, meta_description,
            is_featured, is_visible, sort_order
        } = req.body;

        db.prepare(`
            UPDATE services SET
                name = COALESCE(?, name),
                slug = COALESCE(?, slug),
                description = COALESCE(?, description),
                short_description = COALESCE(?, short_description),
                price = COALESCE(?, price),
                price_from = COALESCE(?, price_from),
                price_to = COALESCE(?, price_to),
                duration = COALESCE(?, duration),
                category_id = COALESCE(?, category_id),
                images = COALESCE(?, images),
                features = COALESCE(?, features),
                meta_title = COALESCE(?, meta_title),
                meta_description = COALESCE(?, meta_description),
                is_featured = COALESCE(?, is_featured),
                is_visible = COALESCE(?, is_visible),
                sort_order = COALESCE(?, sort_order),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND project_id = ?
        `).run(
            name, slug, description, short_description, price, price_from, price_to,
            duration, category_id,
            images ? JSON.stringify(images) : null,
            features ? JSON.stringify(features) : null,
            meta_title, meta_description,
            is_featured !== undefined ? (is_featured ? 1 : 0) : null,
            is_visible !== undefined ? (is_visible ? 1 : 0) : null,
            sort_order,
            req.params.serviceId, req.params.projectId
        );

        const service = db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.serviceId);

        res.json({
            success: true,
            service: {
                ...service,
                images: JSON.parse(service.images || '[]'),
                features: JSON.parse(service.features || '[]')
            }
        });
    } catch (error) {
        console.error('Update service error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete service
router.delete('/:projectId/:serviceId', (req, res) => {
    try {
        const db = getDb();
        db.prepare('DELETE FROM services WHERE id = ? AND project_id = ?')
            .run(req.params.serviceId, req.params.projectId);

        res.json({ success: true });
    } catch (error) {
        console.error('Delete service error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Reorder services
router.put('/:projectId/reorder', (req, res) => {
    try {
        const db = getDb();
        const { services } = req.body; // Array of { id, sort_order }

        const updateStmt = db.prepare('UPDATE services SET sort_order = ? WHERE id = ?');
        const updateMany = db.transaction((services) => {
            for (const service of services) {
                updateStmt.run(service.sort_order, service.id);
            }
        });

        updateMany(services);

        res.json({ success: true });
    } catch (error) {
        console.error('Reorder services error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;

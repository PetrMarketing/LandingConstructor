const express = require('express');
const router = express.Router();
const { getDb } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// ============================================================
// MENUS
// ============================================================

// Get all menus for project
router.get('/:projectId', (req, res) => {
    try {
        const db = getDb();
        const menus = db.prepare(`
            SELECT * FROM menus WHERE project_id = ? ORDER BY name
        `).all(req.params.projectId);

        res.json({
            success: true,
            menus: menus.map(m => ({
                ...m,
                items: JSON.parse(m.items || '[]')
            }))
        });
    } catch (error) {
        console.error('Get menus error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get single menu
router.get('/:projectId/:menuId', (req, res) => {
    try {
        const db = getDb();
        const menu = db.prepare(`
            SELECT * FROM menus WHERE id = ? AND project_id = ?
        `).get(req.params.menuId, req.params.projectId);

        if (!menu) {
            return res.status(404).json({ success: false, error: 'Меню не найдено' });
        }

        res.json({
            success: true,
            menu: {
                ...menu,
                items: JSON.parse(menu.items || '[]')
            }
        });
    } catch (error) {
        console.error('Get menu error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create menu
router.post('/:projectId', (req, res) => {
    try {
        const db = getDb();
        const id = uuidv4();
        const { name, location, items } = req.body;

        if (!name) {
            return res.status(400).json({ success: false, error: 'Название меню обязательно' });
        }

        db.prepare(`
            INSERT INTO menus (id, project_id, name, location, items)
            VALUES (?, ?, ?, ?, ?)
        `).run(id, req.params.projectId, name, location || 'header', JSON.stringify(items || []));

        const menu = db.prepare('SELECT * FROM menus WHERE id = ?').get(id);

        res.json({
            success: true,
            menu: {
                ...menu,
                items: JSON.parse(menu.items || '[]')
            }
        });
    } catch (error) {
        console.error('Create menu error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update menu
router.put('/:projectId/:menuId', (req, res) => {
    try {
        const db = getDb();
        const { name, location, items } = req.body;

        db.prepare(`
            UPDATE menus SET
                name = COALESCE(?, name),
                location = COALESCE(?, location),
                items = COALESCE(?, items),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND project_id = ?
        `).run(name, location, items ? JSON.stringify(items) : null, req.params.menuId, req.params.projectId);

        const menu = db.prepare('SELECT * FROM menus WHERE id = ?').get(req.params.menuId);

        res.json({
            success: true,
            menu: {
                ...menu,
                items: JSON.parse(menu.items || '[]')
            }
        });
    } catch (error) {
        console.error('Update menu error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete menu
router.delete('/:projectId/:menuId', (req, res) => {
    try {
        const db = getDb();
        db.prepare('DELETE FROM menus WHERE id = ? AND project_id = ?')
            .run(req.params.menuId, req.params.projectId);

        res.json({ success: true });
    } catch (error) {
        console.error('Delete menu error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// REDIRECTS (SEO)
// ============================================================

// Get all redirects
router.get('/:projectId/redirects/list', (req, res) => {
    try {
        const db = getDb();
        const redirects = db.prepare(`
            SELECT * FROM redirects WHERE project_id = ? ORDER BY created_at DESC
        `).all(req.params.projectId);

        res.json({ success: true, redirects });
    } catch (error) {
        console.error('Get redirects error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create redirect
router.post('/:projectId/redirects', (req, res) => {
    try {
        const db = getDb();
        const id = uuidv4();
        const { from_path, to_path, redirect_type } = req.body;

        if (!from_path || !to_path) {
            return res.status(400).json({ success: false, error: 'Укажите исходный и целевой путь' });
        }

        db.prepare(`
            INSERT INTO redirects (id, project_id, from_path, to_path, redirect_type)
            VALUES (?, ?, ?, ?, ?)
        `).run(id, req.params.projectId, from_path, to_path, redirect_type || 301);

        const redirect = db.prepare('SELECT * FROM redirects WHERE id = ?').get(id);

        res.json({ success: true, redirect });
    } catch (error) {
        console.error('Create redirect error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete redirect
router.delete('/:projectId/redirects/:redirectId', (req, res) => {
    try {
        const db = getDb();
        db.prepare('DELETE FROM redirects WHERE id = ? AND project_id = ?')
            .run(req.params.redirectId, req.params.projectId);

        res.json({ success: true });
    } catch (error) {
        console.error('Delete redirect error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;

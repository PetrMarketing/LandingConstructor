const express = require('express');
const router = express.Router();
const { getDb } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// ============================================================
// PROJECT SETTINGS
// ============================================================

// Get all settings for project
router.get('/:projectId', (req, res) => {
    try {
        const db = getDb();
        const { group_name } = req.query;

        let query = `SELECT * FROM project_settings WHERE project_id = ?`;
        const params = [req.params.projectId];

        if (group_name) {
            query += ` AND group_name = ?`;
            params.push(group_name);
        }

        query += ` ORDER BY group_name, key`;

        const settings = db.prepare(query).all(...params);

        // Convert to object grouped by group_name
        const grouped = {};
        settings.forEach(s => {
            if (!grouped[s.group_name]) {
                grouped[s.group_name] = {};
            }
            let value = s.value;
            if (s.type === 'json') {
                try { value = JSON.parse(s.value); } catch (e) { }
            } else if (s.type === 'boolean') {
                value = s.value === 'true' || s.value === '1';
            } else if (s.type === 'number') {
                value = Number(s.value);
            }
            grouped[s.group_name][s.key] = value;
        });

        res.json({ success: true, settings: grouped });
    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get single setting
router.get('/:projectId/:key', (req, res) => {
    try {
        const db = getDb();
        const setting = db.prepare(`
            SELECT * FROM project_settings WHERE project_id = ? AND key = ?
        `).get(req.params.projectId, req.params.key);

        if (!setting) {
            return res.status(404).json({ success: false, error: 'Настройка не найдена' });
        }

        let value = setting.value;
        if (setting.type === 'json') {
            try { value = JSON.parse(setting.value); } catch (e) { }
        } else if (setting.type === 'boolean') {
            value = setting.value === 'true' || setting.value === '1';
        } else if (setting.type === 'number') {
            value = Number(setting.value);
        }

        res.json({ success: true, setting: { ...setting, value } });
    } catch (error) {
        console.error('Get setting error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Set setting (upsert)
router.put('/:projectId/:key', (req, res) => {
    try {
        const db = getDb();
        const { value, type, group_name, description } = req.body;

        const existingSetting = db.prepare(`
            SELECT id FROM project_settings WHERE project_id = ? AND key = ?
        `).get(req.params.projectId, req.params.key);

        let stringValue = value;
        if (typeof value === 'object') {
            stringValue = JSON.stringify(value);
        } else if (typeof value === 'boolean') {
            stringValue = value ? 'true' : 'false';
        } else {
            stringValue = String(value);
        }

        if (existingSetting) {
            db.prepare(`
                UPDATE project_settings SET
                    value = ?,
                    type = COALESCE(?, type),
                    group_name = COALESCE(?, group_name),
                    description = COALESCE(?, description),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(stringValue, type, group_name, description, existingSetting.id);
        } else {
            db.prepare(`
                INSERT INTO project_settings (id, project_id, key, value, type, group_name, description)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(
                uuidv4(), req.params.projectId, req.params.key, stringValue,
                type || 'string', group_name || 'general', description
            );
        }

        const setting = db.prepare(`
            SELECT * FROM project_settings WHERE project_id = ? AND key = ?
        `).get(req.params.projectId, req.params.key);

        res.json({ success: true, setting });
    } catch (error) {
        console.error('Set setting error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Bulk update settings
router.put('/:projectId', (req, res) => {
    try {
        const db = getDb();
        const { settings } = req.body; // Object: { key: value, ... }

        const upsertStmt = db.prepare(`
            INSERT INTO project_settings (id, project_id, key, value, type, group_name)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(project_id, key) DO UPDATE SET
                value = excluded.value,
                updated_at = CURRENT_TIMESTAMP
        `);

        const upsertMany = db.transaction((settings) => {
            for (const [key, value] of Object.entries(settings)) {
                let stringValue = value;
                let type = 'string';
                let groupName = 'general';

                if (typeof value === 'object' && value !== null) {
                    if (value._type) type = value._type;
                    if (value._group) groupName = value._group;
                    stringValue = value._value !== undefined ? String(value._value) : JSON.stringify(value);
                    if (typeof value._value === 'object') {
                        stringValue = JSON.stringify(value._value);
                        type = 'json';
                    }
                } else if (typeof value === 'boolean') {
                    stringValue = value ? 'true' : 'false';
                    type = 'boolean';
                } else if (typeof value === 'number') {
                    stringValue = String(value);
                    type = 'number';
                } else {
                    stringValue = String(value);
                }

                upsertStmt.run(uuidv4(), req.params.projectId, key, stringValue, type, groupName);
            }
        });

        upsertMany(settings);

        res.json({ success: true });
    } catch (error) {
        console.error('Bulk update settings error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete setting
router.delete('/:projectId/:key', (req, res) => {
    try {
        const db = getDb();
        db.prepare('DELETE FROM project_settings WHERE project_id = ? AND key = ?')
            .run(req.params.projectId, req.params.key);

        res.json({ success: true });
    } catch (error) {
        console.error('Delete setting error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// EMAIL TEMPLATES
// ============================================================

// Get all email templates
router.get('/:projectId/emails/list', (req, res) => {
    try {
        const db = getDb();
        const templates = db.prepare(`
            SELECT * FROM email_templates WHERE project_id = ? ORDER BY name
        `).all(req.params.projectId);

        res.json({
            success: true,
            templates: templates.map(t => ({
                ...t,
                variables: JSON.parse(t.variables || '[]')
            }))
        });
    } catch (error) {
        console.error('Get email templates error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get single email template
router.get('/:projectId/emails/:templateId', (req, res) => {
    try {
        const db = getDb();
        const template = db.prepare(`
            SELECT * FROM email_templates WHERE id = ? AND project_id = ?
        `).get(req.params.templateId, req.params.projectId);

        if (!template) {
            return res.status(404).json({ success: false, error: 'Шаблон не найден' });
        }

        res.json({
            success: true,
            template: {
                ...template,
                variables: JSON.parse(template.variables || '[]')
            }
        });
    } catch (error) {
        console.error('Get email template error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create email template
router.post('/:projectId/emails', (req, res) => {
    try {
        const db = getDb();
        const id = uuidv4();
        const { name, slug, subject, body_html, body_text, variables } = req.body;

        if (!name || !subject) {
            return res.status(400).json({ success: false, error: 'Название и тема обязательны' });
        }

        db.prepare(`
            INSERT INTO email_templates (id, project_id, name, slug, subject, body_html, body_text, variables)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            id, req.params.projectId, name, slug || name.toLowerCase().replace(/\s+/g, '-'),
            subject, body_html, body_text, JSON.stringify(variables || [])
        );

        const template = db.prepare('SELECT * FROM email_templates WHERE id = ?').get(id);

        res.json({
            success: true,
            template: {
                ...template,
                variables: JSON.parse(template.variables || '[]')
            }
        });
    } catch (error) {
        console.error('Create email template error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update email template
router.put('/:projectId/emails/:templateId', (req, res) => {
    try {
        const db = getDb();
        const { name, slug, subject, body_html, body_text, variables, is_active } = req.body;

        db.prepare(`
            UPDATE email_templates SET
                name = COALESCE(?, name),
                slug = COALESCE(?, slug),
                subject = COALESCE(?, subject),
                body_html = COALESCE(?, body_html),
                body_text = COALESCE(?, body_text),
                variables = COALESCE(?, variables),
                is_active = COALESCE(?, is_active),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND project_id = ?
        `).run(
            name, slug, subject, body_html, body_text,
            variables ? JSON.stringify(variables) : null,
            is_active !== undefined ? (is_active ? 1 : 0) : null,
            req.params.templateId, req.params.projectId
        );

        const template = db.prepare('SELECT * FROM email_templates WHERE id = ?').get(req.params.templateId);

        res.json({
            success: true,
            template: {
                ...template,
                variables: JSON.parse(template.variables || '[]')
            }
        });
    } catch (error) {
        console.error('Update email template error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete email template
router.delete('/:projectId/emails/:templateId', (req, res) => {
    try {
        const db = getDb();
        db.prepare('DELETE FROM email_templates WHERE id = ? AND project_id = ?')
            .run(req.params.templateId, req.params.projectId);

        res.json({ success: true });
    } catch (error) {
        console.error('Delete email template error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// THEMES
// ============================================================

// Get all themes
router.get('/:projectId/themes/list', (req, res) => {
    try {
        const db = getDb();
        const themes = db.prepare(`
            SELECT * FROM themes WHERE project_id = ? ORDER BY name
        `).all(req.params.projectId);

        res.json({
            success: true,
            themes: themes.map(t => ({
                ...t,
                colors: JSON.parse(t.colors || '{}'),
                fonts: JSON.parse(t.fonts || '{}')
            }))
        });
    } catch (error) {
        console.error('Get themes error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create theme
router.post('/:projectId/themes', (req, res) => {
    try {
        const db = getDb();
        const id = uuidv4();
        const { name, slug, description, colors, fonts, css_custom, is_active } = req.body;

        // If setting as active, deactivate others
        if (is_active) {
            db.prepare('UPDATE themes SET is_active = 0 WHERE project_id = ?').run(req.params.projectId);
        }

        db.prepare(`
            INSERT INTO themes (id, project_id, name, slug, description, colors, fonts, css_custom, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            id, req.params.projectId, name, slug || name.toLowerCase().replace(/\s+/g, '-'),
            description, JSON.stringify(colors || {}), JSON.stringify(fonts || {}),
            css_custom, is_active ? 1 : 0
        );

        const theme = db.prepare('SELECT * FROM themes WHERE id = ?').get(id);

        res.json({
            success: true,
            theme: {
                ...theme,
                colors: JSON.parse(theme.colors || '{}'),
                fonts: JSON.parse(theme.fonts || '{}')
            }
        });
    } catch (error) {
        console.error('Create theme error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update theme
router.put('/:projectId/themes/:themeId', (req, res) => {
    try {
        const db = getDb();
        const { name, description, colors, fonts, css_custom, is_active } = req.body;

        if (is_active) {
            db.prepare('UPDATE themes SET is_active = 0 WHERE project_id = ?').run(req.params.projectId);
        }

        db.prepare(`
            UPDATE themes SET
                name = COALESCE(?, name),
                description = COALESCE(?, description),
                colors = COALESCE(?, colors),
                fonts = COALESCE(?, fonts),
                css_custom = COALESCE(?, css_custom),
                is_active = COALESCE(?, is_active),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND project_id = ?
        `).run(
            name, description,
            colors ? JSON.stringify(colors) : null,
            fonts ? JSON.stringify(fonts) : null,
            css_custom, is_active !== undefined ? (is_active ? 1 : 0) : null,
            req.params.themeId, req.params.projectId
        );

        const theme = db.prepare('SELECT * FROM themes WHERE id = ?').get(req.params.themeId);

        res.json({
            success: true,
            theme: {
                ...theme,
                colors: JSON.parse(theme.colors || '{}'),
                fonts: JSON.parse(theme.fonts || '{}')
            }
        });
    } catch (error) {
        console.error('Update theme error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete theme
router.delete('/:projectId/themes/:themeId', (req, res) => {
    try {
        const db = getDb();
        db.prepare('DELETE FROM themes WHERE id = ? AND project_id = ?')
            .run(req.params.themeId, req.params.projectId);

        res.json({ success: true });
    } catch (error) {
        console.error('Delete theme error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// MENUS
// ============================================================

// Get all menus
router.get('/:projectId/menus/list', (req, res) => {
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

// Create menu
router.post('/:projectId/menus', (req, res) => {
    try {
        const db = getDb();
        const id = uuidv4();
        const { name, slug, items } = req.body;

        db.prepare(`
            INSERT INTO menus (id, project_id, name, slug, items)
            VALUES (?, ?, ?, ?, ?)
        `).run(id, req.params.projectId, name, slug || name.toLowerCase().replace(/\s+/g, '-'),
            JSON.stringify(items || []));

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
router.put('/:projectId/menus/:menuId', (req, res) => {
    try {
        const db = getDb();
        const { name, items } = req.body;

        db.prepare(`
            UPDATE menus SET
                name = COALESCE(?, name),
                items = COALESCE(?, items),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND project_id = ?
        `).run(name, items ? JSON.stringify(items) : null, req.params.menuId, req.params.projectId);

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
router.delete('/:projectId/menus/:menuId', (req, res) => {
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
// REDIRECTS
// ============================================================

// Get all redirects
router.get('/:projectId/redirects/list', (req, res) => {
    try {
        const db = getDb();
        const redirects = db.prepare(`
            SELECT * FROM redirects WHERE project_id = ? ORDER BY from_url
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
        const { from_url, to_url, type } = req.body;

        if (!from_url || !to_url) {
            return res.status(400).json({ success: false, error: 'URL источника и назначения обязательны' });
        }

        db.prepare(`
            INSERT INTO redirects (id, project_id, from_url, to_url, type)
            VALUES (?, ?, ?, ?, ?)
        `).run(id, req.params.projectId, from_url, to_url, type || 301);

        const redirect = db.prepare('SELECT * FROM redirects WHERE id = ?').get(id);

        res.json({ success: true, redirect });
    } catch (error) {
        console.error('Create redirect error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update redirect
router.put('/:projectId/redirects/:redirectId', (req, res) => {
    try {
        const db = getDb();
        const { from_url, to_url, type, is_active } = req.body;

        db.prepare(`
            UPDATE redirects SET
                from_url = COALESCE(?, from_url),
                to_url = COALESCE(?, to_url),
                type = COALESCE(?, type),
                is_active = COALESCE(?, is_active)
            WHERE id = ? AND project_id = ?
        `).run(from_url, to_url, type, is_active !== undefined ? (is_active ? 1 : 0) : null,
            req.params.redirectId, req.params.projectId);

        const redirect = db.prepare('SELECT * FROM redirects WHERE id = ?').get(req.params.redirectId);

        res.json({ success: true, redirect });
    } catch (error) {
        console.error('Update redirect error:', error);
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

// ============================================================
// NOTIFICATIONS
// ============================================================

// Get notifications for recipient
router.get('/:projectId/notifications/:recipientType/:recipientId', (req, res) => {
    try {
        const db = getDb();
        const { is_read, limit = 50 } = req.query;

        let query = `
            SELECT * FROM notifications
            WHERE project_id = ? AND recipient_type = ? AND recipient_id = ?
        `;
        const params = [req.params.projectId, req.params.recipientType, req.params.recipientId];

        if (is_read !== undefined) {
            query += ` AND is_read = ?`;
            params.push(is_read === 'true' ? 1 : 0);
        }

        query += ` ORDER BY created_at DESC LIMIT ?`;
        params.push(Number(limit));

        const notifications = db.prepare(query).all(...params);

        // Count unread
        const { unread } = db.prepare(`
            SELECT COUNT(*) as unread FROM notifications
            WHERE project_id = ? AND recipient_type = ? AND recipient_id = ? AND is_read = 0
        `).get(req.params.projectId, req.params.recipientType, req.params.recipientId);

        res.json({
            success: true,
            notifications: notifications.map(n => ({
                ...n,
                data: JSON.parse(n.data || '{}')
            })),
            unread
        });
    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Mark notification as read
router.put('/:projectId/notifications/:notificationId/read', (req, res) => {
    try {
        const db = getDb();
        db.prepare(`
            UPDATE notifications SET is_read = 1, read_at = CURRENT_TIMESTAMP WHERE id = ?
        `).run(req.params.notificationId);

        res.json({ success: true });
    } catch (error) {
        console.error('Mark notification read error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Mark all notifications as read
router.put('/:projectId/notifications/:recipientType/:recipientId/read-all', (req, res) => {
    try {
        const db = getDb();
        db.prepare(`
            UPDATE notifications SET is_read = 1, read_at = CURRENT_TIMESTAMP
            WHERE project_id = ? AND recipient_type = ? AND recipient_id = ? AND is_read = 0
        `).run(req.params.projectId, req.params.recipientType, req.params.recipientId);

        res.json({ success: true });
    } catch (error) {
        console.error('Mark all notifications read error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;

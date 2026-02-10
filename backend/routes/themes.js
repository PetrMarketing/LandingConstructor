const express = require('express');
const router = express.Router();
const { getDb } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// ============================================================
// THEMES
// ============================================================

// Get all themes for project
router.get('/:projectId', (req, res) => {
    try {
        const db = getDb();
        const themes = db.prepare(`
            SELECT * FROM themes WHERE project_id = ? OR is_active = 1
            ORDER BY is_active DESC, name
        `).all(req.params.projectId);

        res.json({
            success: true,
            themes: themes.map(t => ({
                ...t,
                colors: JSON.parse(t.colors || '{}'),
                fonts: JSON.parse(t.fonts || '{}'),
                settings: JSON.parse(t.settings || '{}')
            }))
        });
    } catch (error) {
        console.error('Get themes error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get single theme
router.get('/:projectId/:themeId', (req, res) => {
    try {
        const db = getDb();
        const theme = db.prepare(`
            SELECT * FROM themes WHERE id = ?
        `).get(req.params.themeId);

        if (!theme) {
            return res.status(404).json({ success: false, error: 'Тема не найдена' });
        }

        res.json({
            success: true,
            theme: {
                ...theme,
                colors: JSON.parse(theme.colors || '{}'),
                fonts: JSON.parse(theme.fonts || '{}'),
                settings: JSON.parse(theme.settings || '{}')
            }
        });
    } catch (error) {
        console.error('Get theme error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create theme
router.post('/:projectId', (req, res) => {
    try {
        const db = getDb();
        const id = uuidv4();
        const { name, colors, fonts, settings, css_variables } = req.body;

        if (!name) {
            return res.status(400).json({ success: false, error: 'Название темы обязательно' });
        }

        // Default colors if not provided
        const defaultColors = {
            primary: '#3b82f6',
            secondary: '#10b981',
            background: '#ffffff',
            text: '#1f2937',
            textSecondary: '#6b7280',
            border: '#e5e7eb',
            success: '#10b981',
            warning: '#f59e0b',
            danger: '#ef4444'
        };

        const defaultFonts = {
            heading: 'Inter, sans-serif',
            body: 'Inter, sans-serif',
            baseSize: '16px',
            headingWeight: '700',
            bodyWeight: '400'
        };

        db.prepare(`
            INSERT INTO themes (id, project_id, name, colors, fonts, settings, css_variables)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            id, req.params.projectId, name,
            JSON.stringify(colors || defaultColors),
            JSON.stringify(fonts || defaultFonts),
            JSON.stringify(settings || {}),
            css_variables || ''
        );

        const theme = db.prepare('SELECT * FROM themes WHERE id = ?').get(id);

        res.json({
            success: true,
            theme: {
                ...theme,
                colors: JSON.parse(theme.colors || '{}'),
                fonts: JSON.parse(theme.fonts || '{}'),
                settings: JSON.parse(theme.settings || '{}')
            }
        });
    } catch (error) {
        console.error('Create theme error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update theme
router.put('/:projectId/:themeId', (req, res) => {
    try {
        const db = getDb();
        const { name, colors, fonts, settings, css_variables, is_active } = req.body;

        db.prepare(`
            UPDATE themes SET
                name = COALESCE(?, name),
                colors = COALESCE(?, colors),
                fonts = COALESCE(?, fonts),
                settings = COALESCE(?, settings),
                css_variables = COALESCE(?, css_variables),
                is_active = COALESCE(?, is_active),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND project_id = ?
        `).run(
            name,
            colors ? JSON.stringify(colors) : null,
            fonts ? JSON.stringify(fonts) : null,
            settings ? JSON.stringify(settings) : null,
            css_variables,
            is_active !== undefined ? (is_active ? 1 : 0) : null,
            req.params.themeId, req.params.projectId
        );

        const theme = db.prepare('SELECT * FROM themes WHERE id = ?').get(req.params.themeId);

        res.json({
            success: true,
            theme: {
                ...theme,
                colors: JSON.parse(theme.colors || '{}'),
                fonts: JSON.parse(theme.fonts || '{}'),
                settings: JSON.parse(theme.settings || '{}')
            }
        });
    } catch (error) {
        console.error('Update theme error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Activate theme
router.patch('/:projectId/:themeId/activate', (req, res) => {
    try {
        const db = getDb();

        // Deactivate all themes for this project
        db.prepare('UPDATE themes SET is_active = 0 WHERE project_id = ?').run(req.params.projectId);

        // Activate selected theme
        db.prepare('UPDATE themes SET is_active = 1 WHERE id = ?').run(req.params.themeId);

        res.json({ success: true });
    } catch (error) {
        console.error('Activate theme error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Duplicate theme
router.post('/:projectId/:themeId/duplicate', (req, res) => {
    try {
        const db = getDb();
        const id = uuidv4();

        const original = db.prepare('SELECT * FROM themes WHERE id = ?').get(req.params.themeId);
        if (!original) {
            return res.status(404).json({ success: false, error: 'Тема не найдена' });
        }

        db.prepare(`
            INSERT INTO themes (id, project_id, name, colors, fonts, settings, css_variables)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            id, req.params.projectId,
            original.name + ' (копия)',
            original.colors, original.fonts, original.settings, original.css_variables
        );

        const theme = db.prepare('SELECT * FROM themes WHERE id = ?').get(id);

        res.json({
            success: true,
            theme: {
                ...theme,
                colors: JSON.parse(theme.colors || '{}'),
                fonts: JSON.parse(theme.fonts || '{}'),
                settings: JSON.parse(theme.settings || '{}')
            }
        });
    } catch (error) {
        console.error('Duplicate theme error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete theme
router.delete('/:projectId/:themeId', (req, res) => {
    try {
        const db = getDb();

        // Check if it's the active theme
        const theme = db.prepare('SELECT is_active FROM themes WHERE id = ?').get(req.params.themeId);
        if (theme?.is_active) {
            return res.status(400).json({ success: false, error: 'Нельзя удалить активную тему' });
        }

        db.prepare('DELETE FROM themes WHERE id = ? AND project_id = ? AND is_active = 0')
            .run(req.params.themeId, req.params.projectId);

        res.json({ success: true });
    } catch (error) {
        console.error('Delete theme error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Generate CSS from theme
router.get('/:projectId/:themeId/css', (req, res) => {
    try {
        const db = getDb();
        const theme = db.prepare('SELECT * FROM themes WHERE id = ?').get(req.params.themeId);

        if (!theme) {
            return res.status(404).json({ success: false, error: 'Тема не найдена' });
        }

        const colors = JSON.parse(theme.colors || '{}');
        const fonts = JSON.parse(theme.fonts || '{}');

        // Generate CSS variables
        let css = `:root {\n`;
        css += `  --color-primary: ${colors.primary || '#3b82f6'};\n`;
        css += `  --color-secondary: ${colors.secondary || '#10b981'};\n`;
        css += `  --color-background: ${colors.background || '#ffffff'};\n`;
        css += `  --color-text: ${colors.text || '#1f2937'};\n`;
        css += `  --color-text-secondary: ${colors.textSecondary || '#6b7280'};\n`;
        css += `  --color-border: ${colors.border || '#e5e7eb'};\n`;
        css += `  --color-success: ${colors.success || '#10b981'};\n`;
        css += `  --color-warning: ${colors.warning || '#f59e0b'};\n`;
        css += `  --color-danger: ${colors.danger || '#ef4444'};\n`;
        css += `  --font-heading: ${fonts.heading || 'Inter, sans-serif'};\n`;
        css += `  --font-body: ${fonts.body || 'Inter, sans-serif'};\n`;
        css += `  --font-size-base: ${fonts.baseSize || '16px'};\n`;
        css += `}\n\n`;

        // Add custom CSS
        if (theme.css_variables) {
            css += theme.css_variables;
        }

        res.type('text/css').send(css);
    } catch (error) {
        console.error('Generate CSS error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;

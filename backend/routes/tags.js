const express = require('express');
const router = express.Router();
const { getDb } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// ============================================================
// TAGS MANAGEMENT (amoCRM-like)
// ============================================================

// Get all tags
router.get('/:projectId', (req, res) => {
    try {
        const db = getDb();
        const { entity_type, search } = req.query;

        let query = `
            SELECT * FROM tags
            WHERE project_id = ?
        `;
        const params = [req.params.projectId];

        if (entity_type) {
            query += ` AND entity_type = ?`;
            params.push(entity_type);
        }
        if (search) {
            query += ` AND name LIKE ?`;
            params.push(`%${search}%`);
        }

        query += ` ORDER BY usage_count DESC, name`;

        const tags = db.prepare(query).all(...params);

        res.json({ success: true, tags });
    } catch (error) {
        console.error('Get tags error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create tag
router.post('/:projectId', (req, res) => {
    try {
        const db = getDb();
        const id = uuidv4();
        const { name, color, entity_type } = req.body;

        if (!name) {
            return res.status(400).json({ success: false, error: 'Название обязательно' });
        }

        // Check if tag exists
        const existing = db.prepare(`
            SELECT id FROM tags WHERE project_id = ? AND name = ? AND entity_type = ?
        `).get(req.params.projectId, name, entity_type || 'deal');

        if (existing) {
            return res.status(400).json({ success: false, error: 'Тег уже существует' });
        }

        db.prepare(`
            INSERT INTO tags (id, project_id, name, color, entity_type)
            VALUES (?, ?, ?, ?, ?)
        `).run(id, req.params.projectId, name, color || '#94a3b8', entity_type || 'deal');

        const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(id);

        res.json({ success: true, tag });
    } catch (error) {
        console.error('Create tag error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update tag
router.put('/:projectId/:tagId', (req, res) => {
    try {
        const db = getDb();
        const { name, color } = req.body;

        const oldTag = db.prepare('SELECT name, entity_type FROM tags WHERE id = ?').get(req.params.tagId);

        db.prepare(`
            UPDATE tags SET
                name = COALESCE(?, name),
                color = COALESCE(?, color)
            WHERE id = ? AND project_id = ?
        `).run(name, color, req.params.tagId, req.params.projectId);

        // If name changed, update all entities with this tag
        if (name && oldTag && name !== oldTag.name) {
            if (oldTag.entity_type === 'deal') {
                // Update deals tags
                const deals = db.prepare(`
                    SELECT id, tags FROM deals WHERE project_id = ?
                `).all(req.params.projectId);

                for (const deal of deals) {
                    const tags = JSON.parse(deal.tags || '[]');
                    const index = tags.indexOf(oldTag.name);
                    if (index > -1) {
                        tags[index] = name;
                        db.prepare('UPDATE deals SET tags = ? WHERE id = ?')
                            .run(JSON.stringify(tags), deal.id);
                    }
                }
            } else if (oldTag.entity_type === 'client') {
                // Update clients tags
                const clients = db.prepare(`
                    SELECT id, tags FROM clients WHERE project_id = ?
                `).all(req.params.projectId);

                for (const client of clients) {
                    const tags = JSON.parse(client.tags || '[]');
                    const index = tags.indexOf(oldTag.name);
                    if (index > -1) {
                        tags[index] = name;
                        db.prepare('UPDATE clients SET tags = ? WHERE id = ?')
                            .run(JSON.stringify(tags), client.id);
                    }
                }
            }
        }

        const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(req.params.tagId);

        res.json({ success: true, tag });
    } catch (error) {
        console.error('Update tag error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete tag
router.delete('/:projectId/:tagId', (req, res) => {
    try {
        const db = getDb();
        const { remove_from_entities } = req.query;

        const tag = db.prepare('SELECT name, entity_type FROM tags WHERE id = ?').get(req.params.tagId);

        if (!tag) {
            return res.status(404).json({ success: false, error: 'Тег не найден' });
        }

        // Remove tag from entities if requested
        if (remove_from_entities === 'true') {
            if (tag.entity_type === 'deal') {
                const deals = db.prepare(`
                    SELECT id, tags FROM deals WHERE project_id = ?
                `).all(req.params.projectId);

                for (const deal of deals) {
                    const tags = JSON.parse(deal.tags || '[]');
                    const filtered = tags.filter(t => t !== tag.name);
                    if (tags.length !== filtered.length) {
                        db.prepare('UPDATE deals SET tags = ? WHERE id = ?')
                            .run(JSON.stringify(filtered), deal.id);
                    }
                }
            } else if (tag.entity_type === 'client') {
                const clients = db.prepare(`
                    SELECT id, tags FROM clients WHERE project_id = ?
                `).all(req.params.projectId);

                for (const client of clients) {
                    const tags = JSON.parse(client.tags || '[]');
                    const filtered = tags.filter(t => t !== tag.name);
                    if (tags.length !== filtered.length) {
                        db.prepare('UPDATE clients SET tags = ? WHERE id = ?')
                            .run(JSON.stringify(filtered), client.id);
                    }
                }
            }
        }

        db.prepare('DELETE FROM tags WHERE id = ? AND project_id = ?')
            .run(req.params.tagId, req.params.projectId);

        res.json({ success: true });
    } catch (error) {
        console.error('Delete tag error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Add tag to entity
router.post('/:projectId/add', (req, res) => {
    try {
        const db = getDb();
        const { entity_type, entity_id, tag_name, tag_color } = req.body;

        if (!entity_type || !entity_id || !tag_name) {
            return res.status(400).json({
                success: false,
                error: 'entity_type, entity_id и tag_name обязательны'
            });
        }

        // Get or create tag
        let tag = db.prepare(`
            SELECT id, name FROM tags WHERE project_id = ? AND name = ? AND entity_type = ?
        `).get(req.params.projectId, tag_name, entity_type);

        if (!tag) {
            const tagId = uuidv4();
            db.prepare(`
                INSERT INTO tags (id, project_id, name, color, entity_type)
                VALUES (?, ?, ?, ?, ?)
            `).run(tagId, req.params.projectId, tag_name, tag_color || '#94a3b8', entity_type);
            tag = { id: tagId, name: tag_name };
        }

        // Add tag to entity
        let currentTags = [];
        let table = '';

        if (entity_type === 'deal') {
            table = 'deals';
            const entity = db.prepare('SELECT tags FROM deals WHERE id = ?').get(entity_id);
            currentTags = JSON.parse(entity?.tags || '[]');
        } else if (entity_type === 'client') {
            table = 'clients';
            const entity = db.prepare('SELECT tags FROM clients WHERE id = ?').get(entity_id);
            currentTags = JSON.parse(entity?.tags || '[]');
        }

        if (!currentTags.includes(tag_name)) {
            currentTags.push(tag_name);
            db.prepare(`UPDATE ${table} SET tags = ? WHERE id = ?`)
                .run(JSON.stringify(currentTags), entity_id);

            // Update usage count
            db.prepare('UPDATE tags SET usage_count = usage_count + 1 WHERE id = ?')
                .run(tag.id);
        }

        res.json({ success: true, tags: currentTags });
    } catch (error) {
        console.error('Add tag error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Remove tag from entity
router.post('/:projectId/remove', (req, res) => {
    try {
        const db = getDb();
        const { entity_type, entity_id, tag_name } = req.body;

        if (!entity_type || !entity_id || !tag_name) {
            return res.status(400).json({
                success: false,
                error: 'entity_type, entity_id и tag_name обязательны'
            });
        }

        let currentTags = [];
        let table = '';

        if (entity_type === 'deal') {
            table = 'deals';
            const entity = db.prepare('SELECT tags FROM deals WHERE id = ?').get(entity_id);
            currentTags = JSON.parse(entity?.tags || '[]');
        } else if (entity_type === 'client') {
            table = 'clients';
            const entity = db.prepare('SELECT tags FROM clients WHERE id = ?').get(entity_id);
            currentTags = JSON.parse(entity?.tags || '[]');
        }

        const filtered = currentTags.filter(t => t !== tag_name);

        if (currentTags.length !== filtered.length) {
            db.prepare(`UPDATE ${table} SET tags = ? WHERE id = ?`)
                .run(JSON.stringify(filtered), entity_id);

            // Update usage count
            const tag = db.prepare(`
                SELECT id FROM tags WHERE project_id = ? AND name = ? AND entity_type = ?
            `).get(req.params.projectId, tag_name, entity_type);

            if (tag) {
                db.prepare('UPDATE tags SET usage_count = MAX(0, usage_count - 1) WHERE id = ?')
                    .run(tag.id);
            }
        }

        res.json({ success: true, tags: filtered });
    } catch (error) {
        console.error('Remove tag error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Bulk add tags
router.post('/:projectId/bulk-add', (req, res) => {
    try {
        const db = getDb();
        const { entity_type, entity_ids, tag_names } = req.body;

        if (!entity_type || !entity_ids || !tag_names) {
            return res.status(400).json({
                success: false,
                error: 'entity_type, entity_ids и tag_names обязательны'
            });
        }

        let table = entity_type === 'deal' ? 'deals' : 'clients';
        let updated = 0;

        for (const entityId of entity_ids) {
            const entity = db.prepare(`SELECT tags FROM ${table} WHERE id = ?`).get(entityId);
            let currentTags = JSON.parse(entity?.tags || '[]');

            for (const tagName of tag_names) {
                if (!currentTags.includes(tagName)) {
                    currentTags.push(tagName);

                    // Ensure tag exists
                    const exists = db.prepare(`
                        SELECT id FROM tags WHERE project_id = ? AND name = ? AND entity_type = ?
                    `).get(req.params.projectId, tagName, entity_type);

                    if (!exists) {
                        db.prepare(`
                            INSERT INTO tags (id, project_id, name, entity_type)
                            VALUES (?, ?, ?, ?)
                        `).run(uuidv4(), req.params.projectId, tagName, entity_type);
                    }
                }
            }

            db.prepare(`UPDATE ${table} SET tags = ? WHERE id = ?`)
                .run(JSON.stringify(currentTags), entityId);
            updated++;
        }

        res.json({ success: true, updated });
    } catch (error) {
        console.error('Bulk add tags error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get entities by tag
router.get('/:projectId/entities/:tagName', (req, res) => {
    try {
        const db = getDb();
        const { entity_type, limit = 50, offset = 0 } = req.query;
        const tagName = decodeURIComponent(req.params.tagName);

        let results = { deals: [], clients: [] };

        if (!entity_type || entity_type === 'deal') {
            const deals = db.prepare(`
                SELECT d.*, c.first_name as client_first_name, c.last_name as client_last_name
                FROM deals d
                LEFT JOIN clients c ON c.id = d.client_id
                WHERE d.project_id = ?
                AND json_extract(d.tags, '$') LIKE ?
                ORDER BY d.created_at DESC
                LIMIT ? OFFSET ?
            `).all(req.params.projectId, `%"${tagName}"%`, Number(limit), Number(offset));

            results.deals = deals.map(d => ({
                ...d,
                tags: JSON.parse(d.tags || '[]')
            }));
        }

        if (!entity_type || entity_type === 'client') {
            const clients = db.prepare(`
                SELECT * FROM clients
                WHERE project_id = ?
                AND json_extract(tags, '$') LIKE ?
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            `).all(req.params.projectId, `%"${tagName}"%`, Number(limit), Number(offset));

            results.clients = clients.map(c => ({
                ...c,
                tags: JSON.parse(c.tags || '[]')
            }));
        }

        res.json({ success: true, ...results });
    } catch (error) {
        console.error('Get entities by tag error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Merge tags
router.post('/:projectId/merge', (req, res) => {
    try {
        const db = getDb();
        const { source_tags, target_tag, entity_type } = req.body;

        if (!source_tags || !target_tag || !entity_type) {
            return res.status(400).json({
                success: false,
                error: 'source_tags, target_tag и entity_type обязательны'
            });
        }

        let table = entity_type === 'deal' ? 'deals' : 'clients';
        let merged = 0;

        // Get all entities
        const entities = db.prepare(`
            SELECT id, tags FROM ${table} WHERE project_id = ?
        `).all(req.params.projectId);

        for (const entity of entities) {
            let tags = JSON.parse(entity.tags || '[]');
            let changed = false;

            for (const sourceTag of source_tags) {
                const index = tags.indexOf(sourceTag);
                if (index > -1) {
                    tags.splice(index, 1);
                    if (!tags.includes(target_tag)) {
                        tags.push(target_tag);
                    }
                    changed = true;
                }
            }

            if (changed) {
                db.prepare(`UPDATE ${table} SET tags = ? WHERE id = ?`)
                    .run(JSON.stringify(tags), entity.id);
                merged++;
            }
        }

        // Delete source tags
        for (const sourceTag of source_tags) {
            db.prepare(`DELETE FROM tags WHERE project_id = ? AND name = ? AND entity_type = ?`)
                .run(req.params.projectId, sourceTag, entity_type);
        }

        // Ensure target tag exists
        const exists = db.prepare(`
            SELECT id FROM tags WHERE project_id = ? AND name = ? AND entity_type = ?
        `).get(req.params.projectId, target_tag, entity_type);

        if (!exists) {
            db.prepare(`
                INSERT INTO tags (id, project_id, name, entity_type, usage_count)
                VALUES (?, ?, ?, ?, ?)
            `).run(uuidv4(), req.params.projectId, target_tag, entity_type, merged);
        } else {
            db.prepare(`UPDATE tags SET usage_count = usage_count + ? WHERE id = ?`)
                .run(merged, exists.id);
        }

        res.json({ success: true, merged });
    } catch (error) {
        console.error('Merge tags error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;

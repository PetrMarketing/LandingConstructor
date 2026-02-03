const { getDb } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class Page {
    static findById(id) {
        return getDb().prepare('SELECT * FROM pages WHERE id = ?').get(id);
    }

    static findByProject(projectId, options = {}) {
        let query = 'SELECT * FROM pages WHERE project_id = ?';
        const params = [projectId];

        if (options.folder_id !== undefined) {
            if (options.folder_id === null) {
                query += ' AND folder_id IS NULL';
            } else {
                query += ' AND folder_id = ?';
                params.push(options.folder_id);
            }
        }

        if (options.status) {
            query += ' AND status = ?';
            params.push(options.status);
        }

        query += ' ORDER BY updated_at DESC';

        if (options.limit) {
            query += ' LIMIT ?';
            params.push(options.limit);
            if (options.offset) {
                query += ' OFFSET ?';
                params.push(options.offset);
            }
        }

        return getDb().prepare(query).all(...params);
    }

    static create(data) {
        const id = uuidv4();
        const stmt = getDb().prepare(`
            INSERT INTO pages (id, project_id, folder_id, name, slug, content, meta, status, created_by, updated_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
            id,
            data.project_id,
            data.folder_id || null,
            data.name,
            data.slug || data.name.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '-'),
            JSON.stringify(data.content || {}),
            JSON.stringify(data.meta || {}),
            data.status || 'draft',
            data.created_by || null,
            data.created_by || null
        );

        return this.findById(id);
    }

    static update(id, data) {
        const fields = [];
        const values = [];

        if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
        if (data.slug !== undefined) { fields.push('slug = ?'); values.push(data.slug); }
        if (data.folder_id !== undefined) { fields.push('folder_id = ?'); values.push(data.folder_id || null); }
        if (data.content !== undefined) { fields.push('content = ?'); values.push(JSON.stringify(data.content)); }
        if (data.meta !== undefined) { fields.push('meta = ?'); values.push(JSON.stringify(data.meta)); }
        if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
        if (data.updated_by) { fields.push('updated_by = ?'); values.push(data.updated_by); }

        if (fields.length === 0) return this.findById(id);

        fields.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);

        getDb().prepare(`UPDATE pages SET ${fields.join(', ')} WHERE id = ?`).run(...values);
        return this.findById(id);
    }

    static delete(id) {
        return getDb().prepare('DELETE FROM pages WHERE id = ?').run(id);
    }

    static count(projectId) {
        if (projectId) {
            return getDb().prepare('SELECT COUNT(*) as count FROM pages WHERE project_id = ?').get(projectId).count;
        }
        return getDb().prepare('SELECT COUNT(*) as count FROM pages').get().count;
    }

    static countByFolder(projectId, folderId) {
        if (folderId) {
            return getDb().prepare('SELECT COUNT(*) as count FROM pages WHERE project_id = ? AND folder_id = ?').get(projectId, folderId).count;
        }
        return getDb().prepare('SELECT COUNT(*) as count FROM pages WHERE project_id = ? AND folder_id IS NULL').get(projectId).count;
    }
}

module.exports = Page;

const { getDb } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class Folder {
    static findById(id) {
        return getDb().prepare('SELECT * FROM folders WHERE id = ?').get(id);
    }

    static findByProject(projectId, type = 'pages') {
        return getDb().prepare(
            'SELECT * FROM folders WHERE project_id = ? AND type = ? ORDER BY sort_order, name'
        ).all(projectId, type);
    }

    static create(data) {
        const id = uuidv4();
        getDb().prepare(`
            INSERT INTO folders (id, project_id, parent_id, name, type, sort_order)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(
            id,
            data.project_id,
            data.parent_id || null,
            data.name,
            data.type || 'pages',
            data.sort_order || 0
        );
        return this.findById(id);
    }

    static update(id, data) {
        const fields = [];
        const values = [];

        if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
        if (data.parent_id !== undefined) { fields.push('parent_id = ?'); values.push(data.parent_id || null); }
        if (data.sort_order !== undefined) { fields.push('sort_order = ?'); values.push(data.sort_order); }

        if (fields.length === 0) return this.findById(id);

        fields.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);

        getDb().prepare(`UPDATE folders SET ${fields.join(', ')} WHERE id = ?`).run(...values);
        return this.findById(id);
    }

    static delete(id) {
        return getDb().prepare('DELETE FROM folders WHERE id = ?').run(id);
    }
}

module.exports = Folder;

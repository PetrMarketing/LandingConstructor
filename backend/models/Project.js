const { db } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class Project {
    static findById(id) {
        return db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    }

    static findByOwner(ownerId) {
        return db.prepare('SELECT * FROM projects WHERE owner_id = ? ORDER BY created_at DESC').all(ownerId);
    }

    static findByMember(userId) {
        return db.prepare(`
            SELECT p.*, pm.role as member_role
            FROM projects p
            LEFT JOIN project_members pm ON p.id = pm.project_id
            WHERE p.owner_id = ? OR pm.user_id = ?
            ORDER BY p.created_at DESC
        `).all(userId, userId);
    }

    static findAll(options = {}) {
        let query = 'SELECT * FROM projects';
        const params = [];

        if (options.is_active !== undefined) {
            query += ' WHERE is_active = ?';
            params.push(options.is_active ? 1 : 0);
        }

        query += ' ORDER BY created_at DESC';

        if (options.limit) {
            query += ' LIMIT ?';
            params.push(options.limit);
        }

        return db.prepare(query).all(...params);
    }

    static create(data) {
        const id = uuidv4();

        const stmt = db.prepare(`
            INSERT INTO projects (id, name, description, domain, owner_id, settings)
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
            id,
            data.name,
            data.description || null,
            data.domain || null,
            data.owner_id,
            JSON.stringify(data.settings || {})
        );

        return this.findById(id);
    }

    static update(id, data) {
        const fields = [];
        const values = [];

        if (data.name !== undefined) {
            fields.push('name = ?');
            values.push(data.name);
        }

        if (data.description !== undefined) {
            fields.push('description = ?');
            values.push(data.description);
        }

        if (data.domain !== undefined) {
            fields.push('domain = ?');
            values.push(data.domain);
        }

        if (data.settings !== undefined) {
            fields.push('settings = ?');
            values.push(JSON.stringify(data.settings));
        }

        if (data.is_active !== undefined) {
            fields.push('is_active = ?');
            values.push(data.is_active ? 1 : 0);
        }

        if (fields.length === 0) return this.findById(id);

        fields.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);

        const stmt = db.prepare(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`);
        stmt.run(...values);

        return this.findById(id);
    }

    static delete(id) {
        const stmt = db.prepare('DELETE FROM projects WHERE id = ?');
        return stmt.run(id);
    }

    static count(ownerId = null) {
        if (ownerId) {
            return db.prepare('SELECT COUNT(*) as count FROM projects WHERE owner_id = ?').get(ownerId).count;
        }
        return db.prepare('SELECT COUNT(*) as count FROM projects').get().count;
    }

    // Project members
    static addMember(projectId, userId, role = 'editor') {
        const id = uuidv4();
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO project_members (id, project_id, user_id, role)
            VALUES (?, ?, ?, ?)
        `);
        stmt.run(id, projectId, userId, role);
        return this.getMembers(projectId);
    }

    static removeMember(projectId, userId) {
        const stmt = db.prepare('DELETE FROM project_members WHERE project_id = ? AND user_id = ?');
        return stmt.run(projectId, userId);
    }

    static getMembers(projectId) {
        return db.prepare(`
            SELECT u.id, u.email, u.name, u.avatar, pm.role, pm.created_at
            FROM project_members pm
            JOIN users u ON pm.user_id = u.id
            WHERE pm.project_id = ?
        `).all(projectId);
    }

    static getMemberRole(projectId, userId) {
        const project = this.findById(projectId);
        if (project && project.owner_id === userId) {
            return 'owner';
        }

        const member = db.prepare(`
            SELECT role FROM project_members
            WHERE project_id = ? AND user_id = ?
        `).get(projectId, userId);

        return member ? member.role : null;
    }

    static hasAccess(projectId, userId) {
        const role = this.getMemberRole(projectId, userId);
        return role !== null;
    }
}

module.exports = Project;

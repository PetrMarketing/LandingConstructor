const { getDb } = require('../config/database');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const config = require('../config/config');

class User {
    static findById(id) {
        return getDb().prepare('SELECT * FROM users WHERE id = ?').get(id);
    }

    static findByEmail(email) {
        return getDb().prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
    }

    static findAll(options = {}) {
        let query = 'SELECT id, email, name, role, avatar, phone, is_active, email_verified, last_login, created_at FROM users';
        const params = [];

        if (options.role) {
            query += ' WHERE role = ?';
            params.push(options.role);
        }

        query += ' ORDER BY created_at DESC';

        if (options.limit) {
            query += ' LIMIT ?';
            params.push(options.limit);
        }

        if (options.offset) {
            query += ' OFFSET ?';
            params.push(options.offset);
        }

        return getDb().prepare(query).all(...params);
    }

    static async create(data) {
        const id = uuidv4();
        const hashedPassword = await bcrypt.hash(data.password, config.BCRYPT_ROUNDS);

        const stmt = getDb().prepare(`
            INSERT INTO users (id, email, password, name, role, phone, avatar)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
            id,
            data.email.toLowerCase(),
            hashedPassword,
            data.name,
            data.role || 'client',
            data.phone || null,
            data.avatar || null
        );

        return this.findById(id);
    }

    static async update(id, data) {
        const fields = [];
        const values = [];

        if (data.name !== undefined) {
            fields.push('name = ?');
            values.push(data.name);
        }

        if (data.email !== undefined) {
            fields.push('email = ?');
            values.push(data.email.toLowerCase());
        }

        if (data.password !== undefined) {
            const hashedPassword = await bcrypt.hash(data.password, config.BCRYPT_ROUNDS);
            fields.push('password = ?');
            values.push(hashedPassword);
        }

        if (data.role !== undefined) {
            fields.push('role = ?');
            values.push(data.role);
        }

        if (data.phone !== undefined) {
            fields.push('phone = ?');
            values.push(data.phone);
        }

        if (data.avatar !== undefined) {
            fields.push('avatar = ?');
            values.push(data.avatar);
        }

        if (data.is_active !== undefined) {
            fields.push('is_active = ?');
            values.push(data.is_active ? 1 : 0);
        }

        if (data.email_verified !== undefined) {
            fields.push('email_verified = ?');
            values.push(data.email_verified ? 1 : 0);
        }

        if (fields.length === 0) return this.findById(id);

        fields.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);

        const stmt = getDb().prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`);
        stmt.run(...values);

        return this.findById(id);
    }

    static delete(id) {
        const stmt = getDb().prepare('DELETE FROM users WHERE id = ?');
        return stmt.run(id);
    }

    static async verifyPassword(user, password) {
        return bcrypt.compare(password, user.password);
    }

    static updateLastLogin(id) {
        const stmt = getDb().prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?');
        stmt.run(id);
    }

    static count(options = {}) {
        let query = 'SELECT COUNT(*) as count FROM users';
        const params = [];

        if (options.role) {
            query += ' WHERE role = ?';
            params.push(options.role);
        }

        return getDb().prepare(query).get(...params).count;
    }

    // Get user without sensitive data
    static sanitize(user) {
        if (!user) return null;
        const { password, ...safeUser } = user;
        return safeUser;
    }
}

module.exports = User;

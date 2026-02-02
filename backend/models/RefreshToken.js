const { db } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const config = require('../config/config');

class RefreshToken {
    static create(userId, token) {
        const id = uuidv4();
        const expiresAt = new Date(Date.now() + this.parseExpiry(config.JWT_REFRESH_EXPIRES_IN)).toISOString();

        const stmt = db.prepare(`
            INSERT INTO refresh_tokens (id, user_id, token, expires_at)
            VALUES (?, ?, ?, ?)
        `);

        stmt.run(id, userId, token, expiresAt);
        return { id, user_id: userId, token, expires_at: expiresAt };
    }

    static findByToken(token) {
        return db.prepare('SELECT * FROM refresh_tokens WHERE token = ?').get(token);
    }

    static findByUserId(userId) {
        return db.prepare('SELECT * FROM refresh_tokens WHERE user_id = ?').all(userId);
    }

    static delete(token) {
        const stmt = db.prepare('DELETE FROM refresh_tokens WHERE token = ?');
        return stmt.run(token);
    }

    static deleteByUserId(userId) {
        const stmt = db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?');
        return stmt.run(userId);
    }

    static deleteExpired() {
        const stmt = db.prepare('DELETE FROM refresh_tokens WHERE expires_at < ?');
        return stmt.run(new Date().toISOString());
    }

    static isExpired(refreshToken) {
        return new Date(refreshToken.expires_at) < new Date();
    }

    static parseExpiry(expiry) {
        const match = expiry.match(/^(\d+)([smhd])$/);
        if (!match) return 30 * 24 * 60 * 60 * 1000; // 30 days default

        const value = parseInt(match[1]);
        const unit = match[2];

        switch (unit) {
            case 's': return value * 1000;
            case 'm': return value * 60 * 1000;
            case 'h': return value * 60 * 60 * 1000;
            case 'd': return value * 24 * 60 * 60 * 1000;
            default: return 30 * 24 * 60 * 60 * 1000;
        }
    }
}

module.exports = RefreshToken;

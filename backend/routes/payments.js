const express = require('express');
const router = express.Router();
const { getDb } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// ============================================================
// PAYMENTS
// ============================================================

// Get all payments for project
router.get('/:projectId', (req, res) => {
    try {
        const db = getDb();
        const { status, payment_method, date_from, date_to, order_id, limit = 50, offset = 0 } = req.query;

        let query = `
            SELECT p.*,
                o.order_number,
                c.first_name as client_first_name,
                c.last_name as client_last_name
            FROM payments p
            LEFT JOIN orders o ON o.id = p.order_id
            LEFT JOIN clients c ON c.id = o.client_id
            WHERE p.project_id = ?
        `;
        const params = [req.params.projectId];

        if (status) {
            query += ` AND p.status = ?`;
            params.push(status);
        }
        if (payment_method) {
            query += ` AND p.payment_method = ?`;
            params.push(payment_method);
        }
        if (date_from) {
            query += ` AND p.created_at >= ?`;
            params.push(date_from);
        }
        if (date_to) {
            query += ` AND p.created_at <= ?`;
            params.push(date_to);
        }
        if (order_id) {
            query += ` AND p.order_id = ?`;
            params.push(order_id);
        }

        query += ` ORDER BY p.created_at DESC LIMIT ? OFFSET ?`;
        params.push(Number(limit), Number(offset));

        const payments = db.prepare(query).all(...params);

        // Get stats
        const stats = db.prepare(`
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as total_completed,
                SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as total_pending,
                SUM(CASE WHEN status = 'refunded' THEN amount ELSE 0 END) as total_refunded
            FROM payments WHERE project_id = ?
        `).get(req.params.projectId);

        res.json({ success: true, payments, stats });
    } catch (error) {
        console.error('Get payments error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get single payment
router.get('/:projectId/:paymentId', (req, res) => {
    try {
        const db = getDb();
        const payment = db.prepare(`
            SELECT p.*,
                o.order_number, o.total_amount as order_total,
                c.first_name as client_first_name,
                c.last_name as client_last_name,
                c.email as client_email
            FROM payments p
            LEFT JOIN orders o ON o.id = p.order_id
            LEFT JOIN clients c ON c.id = o.client_id
            WHERE p.id = ? AND p.project_id = ?
        `).get(req.params.paymentId, req.params.projectId);

        if (!payment) {
            return res.status(404).json({ success: false, error: 'Платеж не найден' });
        }

        // Get related refunds
        const refunds = db.prepare(`
            SELECT * FROM refunds WHERE payment_id = ? ORDER BY created_at DESC
        `).all(payment.id);

        res.json({
            success: true,
            payment: {
                ...payment,
                metadata: JSON.parse(payment.metadata || '{}')
            },
            refunds
        });
    } catch (error) {
        console.error('Get payment error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create payment (for manual payments)
router.post('/:projectId', (req, res) => {
    try {
        const db = getDb();
        const id = uuidv4();
        const {
            order_id, amount, currency, payment_method,
            status, transaction_id, metadata, notes
        } = req.body;

        if (!order_id || !amount) {
            return res.status(400).json({ success: false, error: 'Заказ и сумма обязательны' });
        }

        db.prepare(`
            INSERT INTO payments (
                id, project_id, order_id, amount, currency, payment_method,
                status, transaction_id, metadata, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            id, req.params.projectId, order_id, amount,
            currency || 'RUB', payment_method || 'manual',
            status || 'pending', transaction_id,
            JSON.stringify(metadata || {}), notes
        );

        // Update order payment status if needed
        if (status === 'completed') {
            const order = db.prepare('SELECT total_amount FROM orders WHERE id = ?').get(order_id);
            const paidTotal = db.prepare(`
                SELECT COALESCE(SUM(amount), 0) as paid FROM payments
                WHERE order_id = ? AND status = 'completed'
            `).get(order_id);

            if (paidTotal.paid >= order.total_amount) {
                db.prepare(`UPDATE orders SET payment_status = 'paid' WHERE id = ?`).run(order_id);
            } else if (paidTotal.paid > 0) {
                db.prepare(`UPDATE orders SET payment_status = 'partial' WHERE id = ?`).run(order_id);
            }
        }

        const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(id);

        res.json({
            success: true,
            payment: {
                ...payment,
                metadata: JSON.parse(payment.metadata || '{}')
            }
        });
    } catch (error) {
        console.error('Create payment error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update payment status
router.patch('/:projectId/:paymentId/status', (req, res) => {
    try {
        const db = getDb();
        const { status, transaction_id, notes } = req.body;

        db.prepare(`
            UPDATE payments SET
                status = ?,
                transaction_id = COALESCE(?, transaction_id),
                notes = COALESCE(?, notes),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND project_id = ?
        `).run(status, transaction_id, notes, req.params.paymentId, req.params.projectId);

        // Update order payment status
        const payment = db.prepare('SELECT order_id FROM payments WHERE id = ?').get(req.params.paymentId);
        if (payment) {
            const order = db.prepare('SELECT total_amount FROM orders WHERE id = ?').get(payment.order_id);
            const paidTotal = db.prepare(`
                SELECT COALESCE(SUM(amount), 0) as paid FROM payments
                WHERE order_id = ? AND status = 'completed'
            `).get(payment.order_id);

            let paymentStatus = 'pending';
            if (paidTotal.paid >= order.total_amount) {
                paymentStatus = 'paid';
            } else if (paidTotal.paid > 0) {
                paymentStatus = 'partial';
            }
            db.prepare(`UPDATE orders SET payment_status = ? WHERE id = ?`).run(paymentStatus, payment.order_id);
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Update payment status error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// REFUNDS
// ============================================================

// Get all refunds for project
router.get('/:projectId/refunds/list', (req, res) => {
    try {
        const db = getDb();
        const { status, limit = 50, offset = 0 } = req.query;

        let query = `
            SELECT r.*,
                p.amount as payment_amount,
                o.order_number,
                c.first_name as client_first_name,
                c.last_name as client_last_name
            FROM refunds r
            LEFT JOIN payments p ON p.id = r.payment_id
            LEFT JOIN orders o ON o.id = r.order_id
            LEFT JOIN clients c ON c.id = o.client_id
            WHERE r.project_id = ?
        `;
        const params = [req.params.projectId];

        if (status) {
            query += ` AND r.status = ?`;
            params.push(status);
        }

        query += ` ORDER BY r.created_at DESC LIMIT ? OFFSET ?`;
        params.push(Number(limit), Number(offset));

        const refunds = db.prepare(query).all(...params);

        res.json({ success: true, refunds });
    } catch (error) {
        console.error('Get refunds error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create refund
router.post('/:projectId/refunds', (req, res) => {
    try {
        const db = getDb();
        const id = uuidv4();
        const { payment_id, order_id, amount, reason, processed_by } = req.body;

        if (!order_id || !amount) {
            return res.status(400).json({ success: false, error: 'Заказ и сумма обязательны' });
        }

        db.prepare(`
            INSERT INTO refunds (id, project_id, payment_id, order_id, amount, reason, processed_by, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
        `).run(id, req.params.projectId, payment_id, order_id, amount, reason, processed_by);

        const refund = db.prepare('SELECT * FROM refunds WHERE id = ?').get(id);

        res.json({ success: true, refund });
    } catch (error) {
        console.error('Create refund error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update refund status
router.patch('/:projectId/refunds/:refundId/status', (req, res) => {
    try {
        const db = getDb();
        const { status, processed_by, notes } = req.body;

        db.prepare(`
            UPDATE refunds SET
                status = ?,
                processed_by = COALESCE(?, processed_by),
                notes = COALESCE(?, notes),
                processed_at = CASE WHEN ? IN ('approved', 'rejected', 'completed') THEN CURRENT_TIMESTAMP ELSE processed_at END,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND project_id = ?
        `).run(status, processed_by, notes, status, req.params.refundId, req.params.projectId);

        // If completed, update payment status
        if (status === 'completed') {
            const refund = db.prepare('SELECT payment_id, amount FROM refunds WHERE id = ?').get(req.params.refundId);
            if (refund && refund.payment_id) {
                db.prepare(`UPDATE payments SET status = 'refunded' WHERE id = ?`).run(refund.payment_id);
            }
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Update refund status error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// PAYMENT METHODS CONFIGURATION
// ============================================================

// Get payment methods for project
router.get('/:projectId/methods/list', (req, res) => {
    try {
        const db = getDb();
        const methods = db.prepare(`
            SELECT * FROM payment_methods WHERE project_id = ? ORDER BY sort_order
        `).all(req.params.projectId);

        res.json({
            success: true,
            methods: methods.map(m => ({
                ...m,
                settings: JSON.parse(m.settings || '{}')
            }))
        });
    } catch (error) {
        console.error('Get payment methods error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create/update payment method
router.post('/:projectId/methods', (req, res) => {
    try {
        const db = getDb();
        const { id, name, type, settings, is_active, sort_order } = req.body;

        if (id) {
            // Update existing
            db.prepare(`
                UPDATE payment_methods SET
                    name = COALESCE(?, name),
                    type = COALESCE(?, type),
                    settings = COALESCE(?, settings),
                    is_active = COALESCE(?, is_active),
                    sort_order = COALESCE(?, sort_order)
                WHERE id = ? AND project_id = ?
            `).run(
                name, type, settings ? JSON.stringify(settings) : null,
                is_active !== undefined ? (is_active ? 1 : 0) : null,
                sort_order, id, req.params.projectId
            );
        } else {
            // Create new
            const newId = uuidv4();
            db.prepare(`
                INSERT INTO payment_methods (id, project_id, name, type, settings, is_active, sort_order)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(newId, req.params.projectId, name, type, JSON.stringify(settings || {}), is_active ? 1 : 0, sort_order || 0);
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Save payment method error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete payment method
router.delete('/:projectId/methods/:methodId', (req, res) => {
    try {
        const db = getDb();
        db.prepare('DELETE FROM payment_methods WHERE id = ? AND project_id = ?')
            .run(req.params.methodId, req.params.projectId);

        res.json({ success: true });
    } catch (error) {
        console.error('Delete payment method error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;

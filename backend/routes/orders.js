const express = require('express');
const router = express.Router();
const { getDb } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// Generate order number
function generateOrderNumber() {
    const date = new Date();
    const prefix = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${prefix}-${random}`;
}

// ============================================================
// ORDERS
// ============================================================

// Get all orders for project
router.get('/:projectId', (req, res) => {
    try {
        const db = getDb();
        const { status, payment_status, customer_id, limit = 50, offset = 0, search } = req.query;

        let query = `
            SELECT o.*,
                e.first_name as assignee_first_name, e.last_name as assignee_last_name
            FROM orders o
            LEFT JOIN employees e ON e.id = o.assigned_to
            WHERE o.project_id = ?
        `;
        const params = [req.params.projectId];

        if (status) {
            query += ` AND o.status = ?`;
            params.push(status);
        }
        if (payment_status) {
            query += ` AND o.payment_status = ?`;
            params.push(payment_status);
        }
        if (customer_id) {
            query += ` AND o.customer_id = ?`;
            params.push(customer_id);
        }
        if (search) {
            query += ` AND (o.order_number LIKE ? OR o.customer_name LIKE ? OR o.customer_email LIKE ? OR o.customer_phone LIKE ?)`;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }

        query += ` ORDER BY o.created_at DESC LIMIT ? OFFSET ?`;
        params.push(Number(limit), Number(offset));

        const orders = db.prepare(query).all(...params);

        // Get total and stats
        const stats = db.prepare(`
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as new_count,
                SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing_count,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_count,
                SUM(total) as total_amount,
                SUM(CASE WHEN payment_status = 'paid' THEN total ELSE 0 END) as paid_amount
            FROM orders WHERE project_id = ?
        `).get(req.params.projectId);

        res.json({
            success: true,
            orders: orders.map(o => ({
                ...o,
                items: JSON.parse(o.items || '[]'),
                shipping_address: JSON.parse(o.shipping_address || '{}')
            })),
            stats,
            limit: Number(limit),
            offset: Number(offset)
        });
    } catch (error) {
        console.error('Get orders error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get single order
router.get('/:projectId/:orderId', (req, res) => {
    try {
        const db = getDb();
        const order = db.prepare(`
            SELECT o.*,
                e.first_name as assignee_first_name, e.last_name as assignee_last_name
            FROM orders o
            LEFT JOIN employees e ON e.id = o.assigned_to
            WHERE o.id = ? AND o.project_id = ?
        `).get(req.params.orderId, req.params.projectId);

        if (!order) {
            return res.status(404).json({ success: false, error: 'Заказ не найден' });
        }

        // Get order items
        const items = db.prepare(`
            SELECT oi.*, p.name as product_name, p.images as product_images
            FROM order_items oi
            LEFT JOIN products p ON p.id = oi.item_id AND oi.item_type = 'product'
            WHERE oi.order_id = ?
        `).all(order.id);

        // Get status history
        const history = db.prepare(`
            SELECT osh.*, e.first_name, e.last_name
            FROM order_status_history osh
            LEFT JOIN employees e ON e.id = osh.employee_id
            WHERE osh.order_id = ?
            ORDER BY osh.created_at DESC
        `).all(order.id);

        // Get payments
        const payments = db.prepare(`
            SELECT * FROM payments WHERE order_id = ? ORDER BY created_at DESC
        `).all(order.id);

        // Get refunds
        const refunds = db.prepare(`
            SELECT r.*, e.first_name as employee_first_name, e.last_name as employee_last_name
            FROM refunds r
            LEFT JOIN employees e ON e.id = r.employee_id
            WHERE r.order_id = ?
            ORDER BY r.created_at DESC
        `).all(order.id);

        res.json({
            success: true,
            order: {
                ...order,
                items: items.map(i => ({
                    ...i,
                    attributes: JSON.parse(i.attributes || '{}'),
                    product_images: i.product_images ? JSON.parse(i.product_images) : []
                })),
                shipping_address: JSON.parse(order.shipping_address || '{}')
            },
            history,
            payments,
            refunds
        });
    } catch (error) {
        console.error('Get order error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create order
router.post('/:projectId', (req, res) => {
    try {
        const db = getDb();
        const id = uuidv4();
        const orderNumber = generateOrderNumber();

        const {
            customer_id, customer_email, customer_phone, customer_name, customer_note,
            items, discount_amount, discount_code, shipping_amount, tax_amount,
            shipping_method, shipping_address, payment_method, source,
            utm_source, utm_medium, utm_campaign, assigned_to, internal_note
        } = req.body;

        // Calculate totals
        let subtotal = 0;
        const orderItems = items || [];
        orderItems.forEach(item => {
            subtotal += (item.price * item.quantity) - (item.discount_amount || 0);
        });

        const total = subtotal - (discount_amount || 0) + (shipping_amount || 0) + (tax_amount || 0);

        db.prepare(`
            INSERT INTO orders (
                id, project_id, order_number, customer_id, customer_email, customer_phone,
                customer_name, customer_note, items, subtotal, discount_amount, discount_code,
                shipping_amount, tax_amount, total, shipping_method, shipping_address,
                payment_method, source, utm_source, utm_medium, utm_campaign,
                assigned_to, internal_note
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            id, req.params.projectId, orderNumber, customer_id, customer_email, customer_phone,
            customer_name, customer_note, JSON.stringify(orderItems), subtotal,
            discount_amount || 0, discount_code, shipping_amount || 0, tax_amount || 0, total,
            shipping_method, JSON.stringify(shipping_address || {}), payment_method,
            source || 'website', utm_source, utm_medium, utm_campaign, assigned_to, internal_note
        );

        // Create order items
        orderItems.forEach(item => {
            db.prepare(`
                INSERT INTO order_items (
                    id, order_id, item_type, item_id, variant_id, name, sku,
                    quantity, price, discount_amount, total, attributes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                uuidv4(), id, item.item_type || 'product', item.item_id, item.variant_id,
                item.name, item.sku, item.quantity, item.price, item.discount_amount || 0,
                (item.price * item.quantity) - (item.discount_amount || 0),
                JSON.stringify(item.attributes || {})
            );

            // Update product stock
            if (item.item_type === 'product' && item.item_id) {
                db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?')
                    .run(item.quantity, item.item_id);
            }
        });

        // Log initial status
        db.prepare(`
            INSERT INTO order_status_history (id, order_id, to_status)
            VALUES (?, ?, 'new')
        `).run(uuidv4(), id);

        // Update client stats
        if (customer_id) {
            db.prepare(`
                UPDATE clients SET
                    total_orders = total_orders + 1,
                    total_spent = total_spent + ?,
                    last_order_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(total, customer_id);
        }

        const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);

        res.json({
            success: true,
            order: {
                ...order,
                items: JSON.parse(order.items || '[]'),
                shipping_address: JSON.parse(order.shipping_address || '{}')
            }
        });
    } catch (error) {
        console.error('Create order error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update order
router.put('/:projectId/:orderId', (req, res) => {
    try {
        const db = getDb();
        const {
            customer_email, customer_phone, customer_name, customer_note,
            discount_amount, shipping_amount, shipping_method, shipping_address,
            tracking_number, assigned_to, internal_note
        } = req.body;

        db.prepare(`
            UPDATE orders SET
                customer_email = COALESCE(?, customer_email),
                customer_phone = COALESCE(?, customer_phone),
                customer_name = COALESCE(?, customer_name),
                customer_note = COALESCE(?, customer_note),
                discount_amount = COALESCE(?, discount_amount),
                shipping_amount = COALESCE(?, shipping_amount),
                shipping_method = COALESCE(?, shipping_method),
                shipping_address = COALESCE(?, shipping_address),
                tracking_number = COALESCE(?, tracking_number),
                assigned_to = COALESCE(?, assigned_to),
                internal_note = COALESCE(?, internal_note),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND project_id = ?
        `).run(
            customer_email, customer_phone, customer_name, customer_note,
            discount_amount, shipping_amount, shipping_method,
            shipping_address ? JSON.stringify(shipping_address) : null,
            tracking_number, assigned_to, internal_note,
            req.params.orderId, req.params.projectId
        );

        // Recalculate total
        const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.orderId);
        const newTotal = order.subtotal - order.discount_amount + order.shipping_amount + order.tax_amount;

        db.prepare('UPDATE orders SET total = ? WHERE id = ?').run(newTotal, req.params.orderId);

        const updatedOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.orderId);

        res.json({
            success: true,
            order: {
                ...updatedOrder,
                items: JSON.parse(updatedOrder.items || '[]'),
                shipping_address: JSON.parse(updatedOrder.shipping_address || '{}')
            }
        });
    } catch (error) {
        console.error('Update order error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update order status
router.post('/:projectId/:orderId/status', (req, res) => {
    try {
        const db = getDb();
        const { status, employee_id, comment } = req.body;

        const currentOrder = db.prepare('SELECT status FROM orders WHERE id = ?').get(req.params.orderId);

        let updateFields = `status = ?, updated_at = CURRENT_TIMESTAMP`;
        const params = [status];

        if (status === 'shipped') {
            updateFields += `, shipped_at = CURRENT_TIMESTAMP`;
        } else if (status === 'delivered') {
            updateFields += `, delivered_at = CURRENT_TIMESTAMP`;
        } else if (status === 'completed') {
            updateFields += `, completed_at = CURRENT_TIMESTAMP`;
        }

        params.push(req.params.orderId);
        db.prepare(`UPDATE orders SET ${updateFields} WHERE id = ?`).run(...params);

        // Log status change
        db.prepare(`
            INSERT INTO order_status_history (id, order_id, from_status, to_status, employee_id, comment)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(uuidv4(), req.params.orderId, currentOrder?.status, status, employee_id, comment);

        const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.orderId);

        res.json({
            success: true,
            order: {
                ...order,
                items: JSON.parse(order.items || '[]'),
                shipping_address: JSON.parse(order.shipping_address || '{}')
            }
        });
    } catch (error) {
        console.error('Update order status error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update payment status
router.post('/:projectId/:orderId/payment', (req, res) => {
    try {
        const db = getDb();
        const { payment_status, payment_method, amount, external_id } = req.body;

        db.prepare(`
            UPDATE orders SET
                payment_status = ?,
                payment_method = COALESCE(?, payment_method),
                paid_at = CASE WHEN ? = 'paid' THEN CURRENT_TIMESTAMP ELSE paid_at END,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(payment_status, payment_method, payment_status, req.params.orderId);

        // Create payment record if paid
        if (payment_status === 'paid' && amount) {
            const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.orderId);

            db.prepare(`
                INSERT INTO payments (id, project_id, order_id, client_id, amount, currency, method, status, external_id, paid_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', ?, CURRENT_TIMESTAMP)
            `).run(uuidv4(), req.params.projectId, req.params.orderId, order.customer_id,
                amount || order.total, order.currency, payment_method, external_id);
        }

        const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.orderId);

        res.json({
            success: true,
            order: {
                ...order,
                items: JSON.parse(order.items || '[]'),
                shipping_address: JSON.parse(order.shipping_address || '{}')
            }
        });
    } catch (error) {
        console.error('Update payment status error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete order
router.delete('/:projectId/:orderId', (req, res) => {
    try {
        const db = getDb();

        // Restore stock
        const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(req.params.orderId);
        items.forEach(item => {
            if (item.item_type === 'product' && item.item_id) {
                db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?')
                    .run(item.quantity, item.item_id);
            }
        });

        db.prepare('DELETE FROM orders WHERE id = ? AND project_id = ?')
            .run(req.params.orderId, req.params.projectId);

        res.json({ success: true });
    } catch (error) {
        console.error('Delete order error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// REFUNDS
// ============================================================

// Create refund
router.post('/:projectId/:orderId/refunds', (req, res) => {
    try {
        const db = getDb();
        const id = uuidv4();
        const { payment_id, amount, reason, items, employee_id } = req.body;

        db.prepare(`
            INSERT INTO refunds (id, order_id, payment_id, amount, reason, items, employee_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(id, req.params.orderId, payment_id, amount, reason, JSON.stringify(items || []), employee_id);

        const refund = db.prepare('SELECT * FROM refunds WHERE id = ?').get(id);

        res.json({
            success: true,
            refund: {
                ...refund,
                items: JSON.parse(refund.items || '[]')
            }
        });
    } catch (error) {
        console.error('Create refund error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Approve refund
router.post('/:projectId/:orderId/refunds/:refundId/approve', (req, res) => {
    try {
        const db = getDb();
        const { approved_by } = req.body;

        db.prepare(`
            UPDATE refunds SET
                status = 'approved',
                approved_by = ?,
                approved_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(approved_by, req.params.refundId);

        const refund = db.prepare('SELECT * FROM refunds WHERE id = ?').get(req.params.refundId);

        res.json({
            success: true,
            refund: {
                ...refund,
                items: JSON.parse(refund.items || '[]')
            }
        });
    } catch (error) {
        console.error('Approve refund error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Complete refund
router.post('/:projectId/:orderId/refunds/:refundId/complete', (req, res) => {
    try {
        const db = getDb();

        const refund = db.prepare('SELECT * FROM refunds WHERE id = ?').get(req.params.refundId);

        db.prepare(`
            UPDATE refunds SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?
        `).run(req.params.refundId);

        // Update payment refunded amount
        if (refund.payment_id) {
            db.prepare(`
                UPDATE payments SET refunded_amount = refunded_amount + ? WHERE id = ?
            `).run(refund.amount, refund.payment_id);
        }

        // Update order payment status
        db.prepare(`
            UPDATE orders SET payment_status = 'refunded', updated_at = CURRENT_TIMESTAMP WHERE id = ?
        `).run(req.params.orderId);

        const updatedRefund = db.prepare('SELECT * FROM refunds WHERE id = ?').get(req.params.refundId);

        res.json({
            success: true,
            refund: {
                ...updatedRefund,
                items: JSON.parse(updatedRefund.items || '[]')
            }
        });
    } catch (error) {
        console.error('Complete refund error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// SHIPPING & PAYMENT METHODS
// ============================================================

// Get shipping methods
router.get('/:projectId/shipping/methods', (req, res) => {
    try {
        const db = getDb();
        const methods = db.prepare(`
            SELECT * FROM shipping_methods WHERE project_id = ? ORDER BY sort_order
        `).all(req.params.projectId);

        res.json({
            success: true,
            methods: methods.map(m => ({
                ...m,
                settings: JSON.parse(m.settings || '{}')
            }))
        });
    } catch (error) {
        console.error('Get shipping methods error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create shipping method
router.post('/:projectId/shipping/methods', (req, res) => {
    try {
        const db = getDb();
        const id = uuidv4();
        const { name, slug, description, price, free_from, estimated_days, settings } = req.body;

        db.prepare(`
            INSERT INTO shipping_methods (id, project_id, name, slug, description, price, free_from, estimated_days, settings)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, req.params.projectId, name, slug || name.toLowerCase().replace(/\s+/g, '-'),
            description, price || 0, free_from, estimated_days, JSON.stringify(settings || {}));

        const method = db.prepare('SELECT * FROM shipping_methods WHERE id = ?').get(id);

        res.json({
            success: true,
            method: {
                ...method,
                settings: JSON.parse(method.settings || '{}')
            }
        });
    } catch (error) {
        console.error('Create shipping method error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get payment methods
router.get('/:projectId/payment/methods', (req, res) => {
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

// Create payment method
router.post('/:projectId/payment/methods', (req, res) => {
    try {
        const db = getDb();
        const id = uuidv4();
        const { name, slug, description, type, provider, settings } = req.body;

        db.prepare(`
            INSERT INTO payment_methods (id, project_id, name, slug, description, type, provider, settings)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, req.params.projectId, name, slug || name.toLowerCase().replace(/\s+/g, '-'),
            description, type, provider, JSON.stringify(settings || {}));

        const method = db.prepare('SELECT * FROM payment_methods WHERE id = ?').get(id);

        res.json({
            success: true,
            method: {
                ...method,
                settings: JSON.parse(method.settings || '{}')
            }
        });
    } catch (error) {
        console.error('Create payment method error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;

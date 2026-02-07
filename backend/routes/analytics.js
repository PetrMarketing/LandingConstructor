const express = require('express');
const router = express.Router();
const { getDb } = require('../config/database');

// ============================================================
// ANALYTICS & REPORTING
// ============================================================

// Get dashboard stats
router.get('/:projectId/dashboard', (req, res) => {
    try {
        const db = getDb();
        const { period = '30' } = req.query;
        const daysAgo = `datetime('now', '-${period} days')`;

        // Main stats
        const stats = {
            clients: db.prepare(`SELECT COUNT(*) as total FROM clients WHERE project_id = ?`).get(req.params.projectId),
            newClients: db.prepare(`SELECT COUNT(*) as total FROM clients WHERE project_id = ? AND created_at >= ${daysAgo}`).get(req.params.projectId),
            orders: db.prepare(`SELECT COUNT(*) as total, COALESCE(SUM(total_amount), 0) as revenue FROM orders WHERE project_id = ? AND created_at >= ${daysAgo}`).get(req.params.projectId),
            deals: db.prepare(`SELECT COUNT(*) as total, COALESCE(SUM(amount), 0) as pipeline FROM deals WHERE project_id = ? AND status = 'open'`).get(req.params.projectId),
            wonDeals: db.prepare(`SELECT COUNT(*) as total, COALESCE(SUM(amount), 0) as revenue FROM deals WHERE project_id = ? AND status = 'won' AND closed_at >= ${daysAgo}`).get(req.params.projectId),
            tasks: db.prepare(`SELECT COUNT(*) as total FROM tasks WHERE project_id = ? AND status != 'done'`).get(req.params.projectId),
            overdueTasks: db.prepare(`SELECT COUNT(*) as total FROM tasks WHERE project_id = ? AND status != 'done' AND due_date < datetime('now')`).get(req.params.projectId)
        };

        res.json({ success: true, stats });
    } catch (error) {
        console.error('Dashboard stats error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get sales funnel analytics
router.get('/:projectId/funnels', (req, res) => {
    try {
        const db = getDb();
        const { funnel_id, period = '30' } = req.query;
        const daysAgo = `datetime('now', '-${period} days')`;

        let funnelFilter = '';
        const params = [req.params.projectId];
        if (funnel_id) {
            funnelFilter = ' AND d.funnel_id = ?';
            params.push(funnel_id);
        }

        // Conversion by stage
        const stageStats = db.prepare(`
            SELECT
                fs.id, fs.name, fs.color, fs.sort_order,
                COUNT(d.id) as deals_count,
                COALESCE(SUM(d.amount), 0) as total_amount,
                AVG(d.amount) as avg_amount
            FROM funnel_stages fs
            LEFT JOIN deals d ON d.stage_id = fs.id AND d.created_at >= ${daysAgo}
            WHERE fs.funnel_id IN (SELECT id FROM funnels WHERE project_id = ?)${funnel_id ? ' AND fs.funnel_id = ?' : ''}
            GROUP BY fs.id
            ORDER BY fs.sort_order
        `).all(...params);

        // Win/loss ratio
        const outcomes = db.prepare(`
            SELECT
                status,
                COUNT(*) as count,
                COALESCE(SUM(amount), 0) as amount
            FROM deals
            WHERE project_id = ? AND closed_at >= ${daysAgo} AND status IN ('won', 'lost')
            GROUP BY status
        `).all(req.params.projectId);

        // Average deal cycle time
        const cycleTime = db.prepare(`
            SELECT AVG(julianday(closed_at) - julianday(created_at)) as avg_days
            FROM deals
            WHERE project_id = ? AND status = 'won' AND closed_at >= ${daysAgo}
        `).get(req.params.projectId);

        // Deals by source
        const sources = db.prepare(`
            SELECT source, COUNT(*) as count, COALESCE(SUM(amount), 0) as amount
            FROM deals
            WHERE project_id = ? AND created_at >= ${daysAgo} AND source IS NOT NULL
            GROUP BY source
            ORDER BY count DESC
        `).all(req.params.projectId);

        res.json({
            success: true,
            stageStats,
            outcomes: outcomes.reduce((acc, o) => ({ ...acc, [o.status]: o }), {}),
            avgCycleTime: cycleTime?.avg_days || 0,
            sources
        });
    } catch (error) {
        console.error('Funnel analytics error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get client analytics
router.get('/:projectId/clients', (req, res) => {
    try {
        const db = getDb();
        const { period = '30' } = req.query;
        const daysAgo = `datetime('now', '-${period} days')`;

        // New vs returning
        const clientTypes = db.prepare(`
            SELECT
                CASE WHEN (SELECT COUNT(*) FROM orders WHERE client_id = c.id) > 1 THEN 'returning' ELSE 'new' END as type,
                COUNT(*) as count
            FROM clients c
            WHERE c.project_id = ?
            GROUP BY type
        `).all(req.params.projectId);

        // Top clients by revenue
        const topClients = db.prepare(`
            SELECT
                c.id, c.first_name, c.last_name, c.email,
                COUNT(o.id) as orders_count,
                COALESCE(SUM(o.total_amount), 0) as total_spent
            FROM clients c
            LEFT JOIN orders o ON o.client_id = c.id AND o.status = 'completed'
            WHERE c.project_id = ?
            GROUP BY c.id
            ORDER BY total_spent DESC
            LIMIT 10
        `).all(req.params.projectId);

        // Client acquisition by source
        const acquisitionSources = db.prepare(`
            SELECT
                COALESCE(utm_source, 'direct') as source,
                COUNT(*) as count
            FROM clients
            WHERE project_id = ? AND created_at >= ${daysAgo}
            GROUP BY source
            ORDER BY count DESC
        `).all(req.params.projectId);

        // Churn risk (no orders in 60+ days)
        const atRisk = db.prepare(`
            SELECT COUNT(*) as count
            FROM clients c
            WHERE c.project_id = ?
            AND (SELECT MAX(created_at) FROM orders WHERE client_id = c.id) < datetime('now', '-60 days')
        `).get(req.params.projectId);

        res.json({
            success: true,
            clientTypes: clientTypes.reduce((acc, t) => ({ ...acc, [t.type]: t.count }), {}),
            topClients,
            acquisitionSources,
            atRiskCount: atRisk?.count || 0
        });
    } catch (error) {
        console.error('Client analytics error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get order analytics
router.get('/:projectId/orders', (req, res) => {
    try {
        const db = getDb();
        const { period = '30' } = req.query;
        const daysAgo = `datetime('now', '-${period} days')`;

        // Orders by status
        const byStatus = db.prepare(`
            SELECT status, COUNT(*) as count, COALESCE(SUM(total_amount), 0) as amount
            FROM orders
            WHERE project_id = ? AND created_at >= ${daysAgo}
            GROUP BY status
        `).all(req.params.projectId);

        // Revenue over time (daily)
        const revenueByDay = db.prepare(`
            SELECT
                date(created_at) as date,
                COUNT(*) as orders,
                COALESCE(SUM(total_amount), 0) as revenue
            FROM orders
            WHERE project_id = ? AND created_at >= ${daysAgo}
            GROUP BY date(created_at)
            ORDER BY date
        `).all(req.params.projectId);

        // Average order value
        const avgOrder = db.prepare(`
            SELECT
                AVG(total_amount) as avg_value,
                MAX(total_amount) as max_value,
                MIN(total_amount) as min_value
            FROM orders
            WHERE project_id = ? AND created_at >= ${daysAgo} AND total_amount > 0
        `).get(req.params.projectId);

        // Payment status breakdown
        const paymentStatus = db.prepare(`
            SELECT payment_status, COUNT(*) as count, COALESCE(SUM(total_amount), 0) as amount
            FROM orders
            WHERE project_id = ? AND created_at >= ${daysAgo}
            GROUP BY payment_status
        `).all(req.params.projectId);

        res.json({
            success: true,
            byStatus: byStatus.reduce((acc, s) => ({ ...acc, [s.status]: s }), {}),
            revenueByDay,
            avgOrder,
            paymentStatus: paymentStatus.reduce((acc, p) => ({ ...acc, [p.payment_status]: p }), {})
        });
    } catch (error) {
        console.error('Order analytics error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get product analytics
router.get('/:projectId/products', (req, res) => {
    try {
        const db = getDb();
        const { period = '30' } = req.query;
        const daysAgo = `datetime('now', '-${period} days')`;

        // Top selling products
        const topProducts = db.prepare(`
            SELECT
                p.id, p.name, p.sku, p.price,
                COALESCE(SUM(oi.quantity), 0) as sold_quantity,
                COALESCE(SUM(oi.quantity * oi.price), 0) as revenue
            FROM products p
            LEFT JOIN order_items oi ON oi.product_id = p.id
            LEFT JOIN orders o ON o.id = oi.order_id AND o.created_at >= ${daysAgo}
            WHERE p.project_id = ?
            GROUP BY p.id
            ORDER BY sold_quantity DESC
            LIMIT 10
        `).all(req.params.projectId);

        // Low stock products
        const lowStock = db.prepare(`
            SELECT id, name, sku, stock
            FROM products
            WHERE project_id = ? AND stock < 10 AND stock > 0
            ORDER BY stock ASC
            LIMIT 10
        `).all(req.params.projectId);

        // Out of stock
        const outOfStock = db.prepare(`
            SELECT COUNT(*) as count
            FROM products
            WHERE project_id = ? AND stock = 0
        `).get(req.params.projectId);

        // Category performance
        const byCategory = db.prepare(`
            SELECT
                c.name as category,
                COUNT(DISTINCT p.id) as products_count,
                COALESCE(SUM(oi.quantity), 0) as sold_quantity
            FROM categories c
            LEFT JOIN products p ON p.category_id = c.id
            LEFT JOIN order_items oi ON oi.product_id = p.id
            WHERE c.project_id = ?
            GROUP BY c.id
            ORDER BY sold_quantity DESC
        `).all(req.params.projectId);

        res.json({
            success: true,
            topProducts,
            lowStock,
            outOfStockCount: outOfStock?.count || 0,
            byCategory
        });
    } catch (error) {
        console.error('Product analytics error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get employee performance
router.get('/:projectId/employees', (req, res) => {
    try {
        const db = getDb();
        const { period = '30' } = req.query;
        const daysAgo = `datetime('now', '-${period} days')`;

        // Employee performance
        const performance = db.prepare(`
            SELECT
                e.id, e.first_name, e.last_name, e.position,
                (SELECT COUNT(*) FROM deals WHERE assigned_to = e.id AND status = 'won' AND closed_at >= ${daysAgo}) as won_deals,
                (SELECT COALESCE(SUM(amount), 0) FROM deals WHERE assigned_to = e.id AND status = 'won' AND closed_at >= ${daysAgo}) as revenue,
                (SELECT COUNT(*) FROM tasks WHERE assigned_to = e.id AND status = 'done' AND completed_at >= ${daysAgo}) as completed_tasks,
                (SELECT COUNT(*) FROM tasks WHERE assigned_to = e.id AND status != 'done') as pending_tasks
            FROM employees e
            WHERE e.project_id = ?
            ORDER BY revenue DESC
        `).all(req.params.projectId);

        // Task completion rate
        const taskStats = db.prepare(`
            SELECT
                COUNT(CASE WHEN status = 'done' THEN 1 END) as completed,
                COUNT(CASE WHEN status != 'done' AND due_date < datetime('now') THEN 1 END) as overdue,
                COUNT(*) as total
            FROM tasks
            WHERE project_id = ? AND created_at >= ${daysAgo}
        `).get(req.params.projectId);

        res.json({
            success: true,
            performance,
            taskStats
        });
    } catch (error) {
        console.error('Employee analytics error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// AI Insights endpoint
router.get('/:projectId/ai-insights', async (req, res) => {
    try {
        const db = getDb();

        // Gather key metrics for AI analysis
        const metrics = {
            // Client metrics
            totalClients: db.prepare('SELECT COUNT(*) as count FROM clients WHERE project_id = ?').get(req.params.projectId).count,
            newClientsThisMonth: db.prepare(`SELECT COUNT(*) as count FROM clients WHERE project_id = ? AND created_at >= datetime('now', '-30 days')`).get(req.params.projectId).count,

            // Sales metrics
            openDeals: db.prepare('SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as amount FROM deals WHERE project_id = ? AND status = \'open\'').get(req.params.projectId),
            wonThisMonth: db.prepare(`SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as amount FROM deals WHERE project_id = ? AND status = 'won' AND closed_at >= datetime('now', '-30 days')`).get(req.params.projectId),
            lostThisMonth: db.prepare(`SELECT COUNT(*) as count FROM deals WHERE project_id = ? AND status = 'lost' AND closed_at >= datetime('now', '-30 days')`).get(req.params.projectId),

            // Order metrics
            ordersThisMonth: db.prepare(`SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as revenue FROM orders WHERE project_id = ? AND created_at >= datetime('now', '-30 days')`).get(req.params.projectId),
            avgOrderValue: db.prepare(`SELECT AVG(total_amount) as avg FROM orders WHERE project_id = ? AND total_amount > 0`).get(req.params.projectId),

            // Task metrics
            overdueTasks: db.prepare(`SELECT COUNT(*) as count FROM tasks WHERE project_id = ? AND status != 'done' AND due_date < datetime('now')`).get(req.params.projectId).count,

            // Product metrics
            lowStockProducts: db.prepare('SELECT COUNT(*) as count FROM products WHERE project_id = ? AND stock < 10').get(req.params.projectId).count
        };

        // Generate AI insights based on metrics
        const insights = [];

        // Conversion insight
        const totalDeals = metrics.wonThisMonth.count + metrics.lostThisMonth.count;
        if (totalDeals > 0) {
            const winRate = (metrics.wonThisMonth.count / totalDeals * 100).toFixed(1);
            if (winRate < 30) {
                insights.push({
                    type: 'warning',
                    category: 'sales',
                    title: 'Низкая конверсия сделок',
                    description: `Конверсия ${winRate}% ниже нормы. Рекомендуем проанализировать причины отказов.`,
                    action: 'Просмотреть проигранные сделки'
                });
            } else if (winRate > 50) {
                insights.push({
                    type: 'success',
                    category: 'sales',
                    title: 'Отличная конверсия',
                    description: `Конверсия ${winRate}% выше среднего. Продолжайте в том же духе!`,
                    action: null
                });
            }
        }

        // Overdue tasks insight
        if (metrics.overdueTasks > 5) {
            insights.push({
                type: 'danger',
                category: 'tasks',
                title: 'Просроченные задачи',
                description: `${metrics.overdueTasks} задач просрочены. Это может влиять на качество обслуживания.`,
                action: 'Просмотреть просроченные задачи'
            });
        }

        // Low stock insight
        if (metrics.lowStockProducts > 0) {
            insights.push({
                type: 'warning',
                category: 'inventory',
                title: 'Низкий остаток товаров',
                description: `${metrics.lowStockProducts} товаров с остатком менее 10 шт. Рекомендуем пополнить запасы.`,
                action: 'Просмотреть товары'
            });
        }

        // Revenue insight
        if (metrics.ordersThisMonth.revenue > 0) {
            const avgDaily = metrics.ordersThisMonth.revenue / 30;
            insights.push({
                type: 'info',
                category: 'revenue',
                title: 'Прогноз выручки',
                description: `При текущем темпе ожидаемая выручка за месяц: ${Math.round(avgDaily * 30).toLocaleString('ru')} ₽`,
                action: null
            });
        }

        // Client growth insight
        if (metrics.newClientsThisMonth > 0) {
            const growthRate = (metrics.newClientsThisMonth / Math.max(metrics.totalClients - metrics.newClientsThisMonth, 1) * 100).toFixed(1);
            insights.push({
                type: growthRate > 10 ? 'success' : 'info',
                category: 'clients',
                title: 'Рост клиентской базы',
                description: `+${metrics.newClientsThisMonth} новых клиентов за месяц (${growthRate}% роста)`,
                action: null
            });
        }

        res.json({
            success: true,
            metrics,
            insights
        });
    } catch (error) {
        console.error('AI insights error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { getDb } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// ============================================================
// CATEGORIES / КАТЕГОРИИ
// ============================================================

router.get('/:projectId/categories', (req, res) => {
    try {
        const db = getDb();
        const categories = db.prepare(`
            SELECT c.*,
                (SELECT COUNT(*) FROM products WHERE category_id = c.id) as products_count
            FROM categories c
            WHERE c.project_id = ?
            ORDER BY c.sort_order, c.name
        `).all(req.params.projectId);

        res.json({ success: true, categories });
    } catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// BRANDS / ПРОИЗВОДИТЕЛИ
// ============================================================

router.get('/:projectId/brands', (req, res) => {
    try {
        const db = getDb();
        const brands = db.prepare(`
            SELECT b.*,
                (SELECT COUNT(*) FROM products WHERE brand_id = b.id) as products_count
            FROM brands b
            WHERE b.project_id = ?
            ORDER BY b.sort_order, b.name
        `).all(req.params.projectId);

        res.json({ success: true, brands });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/:projectId/brands', (req, res) => {
    try {
        const db = getDb();
        const id = uuidv4();
        const { name, slug, logo, description, website, sort_order } = req.body;

        db.prepare(`
            INSERT INTO brands (id, project_id, name, slug, logo, description, website, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, req.params.projectId, name, slug || name.toLowerCase().replace(/\s+/g, '-'),
            logo, description, website, sort_order || 0);

        const brand = db.prepare('SELECT * FROM brands WHERE id = ?').get(id);
        res.json({ success: true, brand });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.put('/:projectId/brands/:brandId', (req, res) => {
    try {
        const db = getDb();
        const { name, slug, logo, description, website, is_active, sort_order } = req.body;

        db.prepare(`
            UPDATE brands SET
                name = COALESCE(?, name),
                slug = COALESCE(?, slug),
                logo = COALESCE(?, logo),
                description = COALESCE(?, description),
                website = COALESCE(?, website),
                is_active = COALESCE(?, is_active),
                sort_order = COALESCE(?, sort_order)
            WHERE id = ? AND project_id = ?
        `).run(name, slug, logo, description, website,
            is_active !== undefined ? (is_active ? 1 : 0) : null, sort_order,
            req.params.brandId, req.params.projectId);

        const brand = db.prepare('SELECT * FROM brands WHERE id = ?').get(req.params.brandId);
        res.json({ success: true, brand });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.delete('/:projectId/brands/:brandId', (req, res) => {
    try {
        const db = getDb();
        db.prepare('DELETE FROM brands WHERE id = ? AND project_id = ?')
            .run(req.params.brandId, req.params.projectId);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// PROMO CODES / ПРОМОКОДЫ
// ============================================================

router.get('/:projectId/promo-codes', (req, res) => {
    try {
        const db = getDb();
        const { is_active, search } = req.query;

        let query = `SELECT * FROM promo_codes WHERE project_id = ?`;
        const params = [req.params.projectId];

        if (is_active !== undefined) {
            query += ` AND is_active = ?`;
            params.push(is_active === 'true' ? 1 : 0);
        }
        if (search) {
            query += ` AND code LIKE ?`;
            params.push(`%${search}%`);
        }

        query += ` ORDER BY created_at DESC`;

        const promoCodes = db.prepare(query).all(...params);

        res.json({
            success: true,
            promoCodes: promoCodes.map(p => ({
                ...p,
                product_ids: JSON.parse(p.product_ids || '[]'),
                category_ids: JSON.parse(p.category_ids || '[]')
            }))
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/:projectId/promo-codes', (req, res) => {
    try {
        const db = getDb();
        const id = uuidv4();
        const {
            code, type, value, min_order_amount, max_uses, per_client_limit,
            applies_to, product_ids, category_ids, start_date, end_date
        } = req.body;

        if (!code || !value) {
            return res.status(400).json({ success: false, error: 'Код и значение обязательны' });
        }

        db.prepare(`
            INSERT INTO promo_codes (
                id, project_id, code, type, value, min_order_amount, max_uses,
                per_client_limit, applies_to, product_ids, category_ids, start_date, end_date
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            id, req.params.projectId, code.toUpperCase(), type || 'percent', value,
            min_order_amount || 0, max_uses, per_client_limit || 1, applies_to || 'all',
            JSON.stringify(product_ids || []), JSON.stringify(category_ids || []),
            start_date, end_date
        );

        const promoCode = db.prepare('SELECT * FROM promo_codes WHERE id = ?').get(id);
        res.json({
            success: true,
            promoCode: {
                ...promoCode,
                product_ids: JSON.parse(promoCode.product_ids || '[]'),
                category_ids: JSON.parse(promoCode.category_ids || '[]')
            }
        });
    } catch (error) {
        if (error.message.includes('UNIQUE constraint')) {
            return res.status(400).json({ success: false, error: 'Такой промокод уже существует' });
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

router.put('/:projectId/promo-codes/:promoId', (req, res) => {
    try {
        const db = getDb();
        const {
            code, type, value, min_order_amount, max_uses, per_client_limit,
            applies_to, product_ids, category_ids, start_date, end_date, is_active
        } = req.body;

        db.prepare(`
            UPDATE promo_codes SET
                code = COALESCE(?, code),
                type = COALESCE(?, type),
                value = COALESCE(?, value),
                min_order_amount = COALESCE(?, min_order_amount),
                max_uses = COALESCE(?, max_uses),
                per_client_limit = COALESCE(?, per_client_limit),
                applies_to = COALESCE(?, applies_to),
                product_ids = COALESCE(?, product_ids),
                category_ids = COALESCE(?, category_ids),
                start_date = COALESCE(?, start_date),
                end_date = COALESCE(?, end_date),
                is_active = COALESCE(?, is_active)
            WHERE id = ? AND project_id = ?
        `).run(
            code?.toUpperCase(), type, value, min_order_amount, max_uses, per_client_limit,
            applies_to,
            product_ids ? JSON.stringify(product_ids) : null,
            category_ids ? JSON.stringify(category_ids) : null,
            start_date, end_date,
            is_active !== undefined ? (is_active ? 1 : 0) : null,
            req.params.promoId, req.params.projectId
        );

        const promoCode = db.prepare('SELECT * FROM promo_codes WHERE id = ?').get(req.params.promoId);
        res.json({
            success: true,
            promoCode: {
                ...promoCode,
                product_ids: JSON.parse(promoCode.product_ids || '[]'),
                category_ids: JSON.parse(promoCode.category_ids || '[]')
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.delete('/:projectId/promo-codes/:promoId', (req, res) => {
    try {
        const db = getDb();
        db.prepare('DELETE FROM promo_codes WHERE id = ? AND project_id = ?')
            .run(req.params.promoId, req.params.projectId);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Проверка промокода
router.post('/:projectId/promo-codes/validate', (req, res) => {
    try {
        const db = getDb();
        const { code, order_amount, client_id, product_ids } = req.body;

        const promo = db.prepare(`
            SELECT * FROM promo_codes
            WHERE project_id = ? AND code = ? AND is_active = 1
        `).get(req.params.projectId, code?.toUpperCase());

        if (!promo) {
            return res.json({ success: false, error: 'Промокод не найден' });
        }

        // Проверка даты
        const now = new Date().toISOString();
        if (promo.start_date && promo.start_date > now) {
            return res.json({ success: false, error: 'Промокод ещё не активен' });
        }
        if (promo.end_date && promo.end_date < now) {
            return res.json({ success: false, error: 'Промокод истёк' });
        }

        // Проверка лимитов
        if (promo.max_uses && promo.uses_count >= promo.max_uses) {
            return res.json({ success: false, error: 'Лимит использования промокода исчерпан' });
        }

        // Проверка минимальной суммы
        if (order_amount && promo.min_order_amount > order_amount) {
            return res.json({
                success: false,
                error: `Минимальная сумма заказа ${promo.min_order_amount} ₽`
            });
        }

        // Проверка использований клиентом
        if (client_id && promo.per_client_limit) {
            const clientUses = db.prepare(`
                SELECT COUNT(*) as count FROM promo_code_uses
                WHERE promo_code_id = ? AND client_id = ?
            `).get(promo.id, client_id);

            if (clientUses.count >= promo.per_client_limit) {
                return res.json({ success: false, error: 'Вы уже использовали этот промокод' });
            }
        }

        // Расчёт скидки
        let discount = 0;
        if (promo.type === 'percent') {
            discount = (order_amount || 0) * (promo.value / 100);
        } else if (promo.type === 'fixed') {
            discount = promo.value;
        }

        res.json({
            success: true,
            promo: {
                id: promo.id,
                code: promo.code,
                type: promo.type,
                value: promo.value,
                discount: Math.round(discount * 100) / 100
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// COLLECTIONS / КОЛЛЕКЦИИ
// ============================================================

router.get('/:projectId/collections', (req, res) => {
    try {
        const db = getDb();
        const collections = db.prepare(`
            SELECT c.*,
                (SELECT COUNT(*) FROM collection_products WHERE collection_id = c.id) as products_count
            FROM collections c
            WHERE c.project_id = ?
            ORDER BY c.sort_order, c.name
        `).all(req.params.projectId);

        res.json({
            success: true,
            collections: collections.map(c => ({
                ...c,
                rules: JSON.parse(c.rules || '[]')
            }))
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/:projectId/collections/:collectionId', (req, res) => {
    try {
        const db = getDb();
        const collection = db.prepare(`
            SELECT * FROM collections WHERE id = ? AND project_id = ?
        `).get(req.params.collectionId, req.params.projectId);

        if (!collection) {
            return res.status(404).json({ success: false, error: 'Коллекция не найдена' });
        }

        const products = db.prepare(`
            SELECT p.*, cp.sort_order as collection_order
            FROM products p
            JOIN collection_products cp ON cp.product_id = p.id
            WHERE cp.collection_id = ?
            ORDER BY cp.sort_order
        `).all(collection.id);

        res.json({
            success: true,
            collection: {
                ...collection,
                rules: JSON.parse(collection.rules || '[]')
            },
            products: products.map(p => ({
                ...p,
                images: JSON.parse(p.images || '[]')
            }))
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/:projectId/collections', (req, res) => {
    try {
        const db = getDb();
        const id = uuidv4();
        const { name, slug, description, image, type, rules, sort_order } = req.body;

        db.prepare(`
            INSERT INTO collections (id, project_id, name, slug, description, image, type, rules, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            id, req.params.projectId, name,
            slug || name.toLowerCase().replace(/\s+/g, '-'),
            description, image, type || 'manual',
            JSON.stringify(rules || []), sort_order || 0
        );

        const collection = db.prepare('SELECT * FROM collections WHERE id = ?').get(id);
        res.json({
            success: true,
            collection: {
                ...collection,
                rules: JSON.parse(collection.rules || '[]')
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.put('/:projectId/collections/:collectionId', (req, res) => {
    try {
        const db = getDb();
        const { name, slug, description, image, type, rules, is_active, sort_order } = req.body;

        db.prepare(`
            UPDATE collections SET
                name = COALESCE(?, name),
                slug = COALESCE(?, slug),
                description = COALESCE(?, description),
                image = COALESCE(?, image),
                type = COALESCE(?, type),
                rules = COALESCE(?, rules),
                is_active = COALESCE(?, is_active),
                sort_order = COALESCE(?, sort_order)
            WHERE id = ? AND project_id = ?
        `).run(
            name, slug, description, image, type,
            rules ? JSON.stringify(rules) : null,
            is_active !== undefined ? (is_active ? 1 : 0) : null,
            sort_order,
            req.params.collectionId, req.params.projectId
        );

        const collection = db.prepare('SELECT * FROM collections WHERE id = ?').get(req.params.collectionId);
        res.json({
            success: true,
            collection: {
                ...collection,
                rules: JSON.parse(collection.rules || '[]')
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.delete('/:projectId/collections/:collectionId', (req, res) => {
    try {
        const db = getDb();
        db.prepare('DELETE FROM collections WHERE id = ? AND project_id = ?')
            .run(req.params.collectionId, req.params.projectId);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Добавить товары в коллекцию
router.post('/:projectId/collections/:collectionId/products', (req, res) => {
    try {
        const db = getDb();
        const { product_ids } = req.body;

        const insert = db.prepare(`
            INSERT OR IGNORE INTO collection_products (id, collection_id, product_id, sort_order)
            VALUES (?, ?, ?, ?)
        `);

        let order = 0;
        for (const productId of product_ids) {
            insert.run(uuidv4(), req.params.collectionId, productId, order++);
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Удалить товар из коллекции
router.delete('/:projectId/collections/:collectionId/products/:productId', (req, res) => {
    try {
        const db = getDb();
        db.prepare('DELETE FROM collection_products WHERE collection_id = ? AND product_id = ?')
            .run(req.params.collectionId, req.params.productId);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// RELATED PRODUCTS / СВЯЗАННЫЕ ТОВАРЫ
// ============================================================

router.get('/:projectId/products/:productId/related', (req, res) => {
    try {
        const db = getDb();
        const { type } = req.query;

        let query = `
            SELECT p.*, rp.relation_type, rp.sort_order
            FROM related_products rp
            JOIN products p ON p.id = rp.related_product_id
            WHERE rp.product_id = ?
        `;
        const params = [req.params.productId];

        if (type) {
            query += ` AND rp.relation_type = ?`;
            params.push(type);
        }

        query += ` ORDER BY rp.sort_order`;

        const related = db.prepare(query).all(...params);

        res.json({
            success: true,
            related: related.map(p => ({
                ...p,
                images: JSON.parse(p.images || '[]')
            }))
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/:projectId/products/:productId/related', (req, res) => {
    try {
        const db = getDb();
        const { related_product_id, relation_type } = req.body;

        // relation_type: 'related', 'upsell', 'crosssell'
        db.prepare(`
            INSERT OR REPLACE INTO related_products (id, product_id, related_product_id, relation_type, sort_order)
            VALUES (?, ?, ?, ?, 0)
        `).run(uuidv4(), req.params.productId, related_product_id, relation_type || 'related');

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.delete('/:projectId/products/:productId/related/:relatedId', (req, res) => {
    try {
        const db = getDb();
        db.prepare('DELETE FROM related_products WHERE product_id = ? AND related_product_id = ?')
            .run(req.params.productId, req.params.relatedId);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// STOCK ALERTS / УВЕДОМЛЕНИЯ ОБ ОСТАТКАХ
// ============================================================

router.get('/:projectId/stock-alerts', (req, res) => {
    try {
        const db = getDb();

        // Товары с низким остатком
        const lowStock = db.prepare(`
            SELECT p.id, p.name, p.sku, p.stock, p.min_stock_alert,
                (SELECT image_url FROM product_variants WHERE product_id = p.id LIMIT 1) as image
            FROM products p
            WHERE p.project_id = ?
                AND p.is_active = 1
                AND p.stock <= COALESCE(p.min_stock_alert, 5)
            ORDER BY p.stock ASC
        `).all(req.params.projectId);

        res.json({ success: true, lowStock });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.put('/:projectId/products/:productId/stock-alert', (req, res) => {
    try {
        const db = getDb();
        const { min_stock_alert } = req.body;

        db.prepare(`
            UPDATE products SET min_stock_alert = ? WHERE id = ? AND project_id = ?
        `).run(min_stock_alert, req.params.productId, req.params.projectId);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;

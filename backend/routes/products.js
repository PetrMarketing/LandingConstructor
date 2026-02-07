const express = require('express');
const router = express.Router();
const { getDb } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// ============================================================
// PRODUCTS
// ============================================================

// Get all products for project
router.get('/:projectId', (req, res) => {
    try {
        const db = getDb();
        const { category_id, is_active, search, limit = 50, offset = 0 } = req.query;

        let query = `
            SELECT p.*, c.name as category_name
            FROM products p
            LEFT JOIN categories c ON c.id = p.category_id
            WHERE p.project_id = ?
        `;
        const params = [req.params.projectId];

        if (category_id) {
            query += ` AND p.category_id = ?`;
            params.push(category_id);
        }
        if (is_active !== undefined) {
            query += ` AND p.is_active = ?`;
            params.push(is_active === 'true' ? 1 : 0);
        }
        if (search) {
            query += ` AND (p.name LIKE ? OR p.sku LIKE ? OR p.description LIKE ?)`;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        query += ` ORDER BY p.created_at DESC LIMIT ? OFFSET ?`;
        params.push(Number(limit), Number(offset));

        const products = db.prepare(query).all(...params);

        // Get total count
        let countQuery = `SELECT COUNT(*) as total FROM products WHERE project_id = ?`;
        const { total } = db.prepare(countQuery).get(req.params.projectId);

        res.json({
            success: true,
            products: products.map(p => ({
                ...p,
                images: JSON.parse(p.images || '[]'),
                attributes: JSON.parse(p.attributes || '{}')
            })),
            total,
            limit: Number(limit),
            offset: Number(offset)
        });
    } catch (error) {
        console.error('Get products error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get single product
router.get('/:projectId/:productId', (req, res) => {
    try {
        const db = getDb();
        const product = db.prepare(`
            SELECT p.*, c.name as category_name
            FROM products p
            LEFT JOIN categories c ON c.id = p.category_id
            WHERE p.id = ? AND p.project_id = ?
        `).get(req.params.productId, req.params.projectId);

        if (!product) {
            return res.status(404).json({ success: false, error: 'Товар не найден' });
        }

        // Get variants
        const variants = db.prepare(`
            SELECT * FROM product_variants WHERE product_id = ? ORDER BY is_default DESC
        `).all(product.id);

        // Get reviews
        const reviews = db.prepare(`
            SELECT r.*, cl.first_name, cl.last_name
            FROM reviews r
            LEFT JOIN clients cl ON cl.id = r.client_id
            WHERE r.entity_type = 'product' AND r.entity_id = ? AND r.is_approved = 1
            ORDER BY r.created_at DESC
            LIMIT 20
        `).all(product.id);

        res.json({
            success: true,
            product: {
                ...product,
                images: JSON.parse(product.images || '[]'),
                attributes: JSON.parse(product.attributes || '{}')
            },
            variants: variants.map(v => ({
                ...v,
                attributes: JSON.parse(v.attributes || '{}')
            })),
            reviews
        });
    } catch (error) {
        console.error('Get product error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create product
router.post('/:projectId', (req, res) => {
    try {
        const db = getDb();
        const id = uuidv4();
        const {
            name, sku, description, price, old_price, cost_price,
            category_id, images, attributes, stock, is_active
        } = req.body;

        if (!name) {
            return res.status(400).json({ success: false, error: 'Название товара обязательно' });
        }

        db.prepare(`
            INSERT INTO products (
                id, project_id, name, sku, description, price, old_price, cost_price,
                category_id, images, attributes, stock, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            id, req.params.projectId, name, sku, description,
            price || 0, old_price, cost_price, category_id,
            JSON.stringify(images || []), JSON.stringify(attributes || {}),
            stock || 0, is_active !== false ? 1 : 0
        );

        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);

        res.json({
            success: true,
            product: {
                ...product,
                images: JSON.parse(product.images || '[]'),
                attributes: JSON.parse(product.attributes || '{}')
            }
        });
    } catch (error) {
        console.error('Create product error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update product
router.put('/:projectId/:productId', (req, res) => {
    try {
        const db = getDb();
        const {
            name, sku, description, price, old_price, cost_price,
            category_id, images, attributes, stock, is_active
        } = req.body;

        db.prepare(`
            UPDATE products SET
                name = COALESCE(?, name),
                sku = COALESCE(?, sku),
                description = COALESCE(?, description),
                price = COALESCE(?, price),
                old_price = COALESCE(?, old_price),
                cost_price = COALESCE(?, cost_price),
                category_id = COALESCE(?, category_id),
                images = COALESCE(?, images),
                attributes = COALESCE(?, attributes),
                stock = COALESCE(?, stock),
                is_active = COALESCE(?, is_active),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND project_id = ?
        `).run(
            name, sku, description, price, old_price, cost_price, category_id,
            images ? JSON.stringify(images) : null,
            attributes ? JSON.stringify(attributes) : null,
            stock, is_active !== undefined ? (is_active ? 1 : 0) : null,
            req.params.productId, req.params.projectId
        );

        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.productId);

        res.json({
            success: true,
            product: {
                ...product,
                images: JSON.parse(product.images || '[]'),
                attributes: JSON.parse(product.attributes || '{}')
            }
        });
    } catch (error) {
        console.error('Update product error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete product
router.delete('/:projectId/:productId', (req, res) => {
    try {
        const db = getDb();
        db.prepare('DELETE FROM products WHERE id = ? AND project_id = ?')
            .run(req.params.productId, req.params.projectId);

        res.json({ success: true });
    } catch (error) {
        console.error('Delete product error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// PRODUCT VARIANTS
// ============================================================

// Get variants for product
router.get('/:projectId/:productId/variants', (req, res) => {
    try {
        const db = getDb();
        const variants = db.prepare(`
            SELECT * FROM product_variants WHERE product_id = ? ORDER BY is_default DESC
        `).all(req.params.productId);

        res.json({
            success: true,
            variants: variants.map(v => ({
                ...v,
                attributes: JSON.parse(v.attributes || '{}')
            }))
        });
    } catch (error) {
        console.error('Get variants error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create variant
router.post('/:projectId/:productId/variants', (req, res) => {
    try {
        const db = getDb();
        const id = uuidv4();
        const { sku, name, attributes, price, compare_price, stock_quantity, image_url, is_default } = req.body;

        db.prepare(`
            INSERT INTO product_variants (
                id, product_id, sku, name, attributes, price, compare_price, stock_quantity, image_url, is_default
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            id, req.params.productId, sku, name, JSON.stringify(attributes || {}),
            price, compare_price, stock_quantity || 0, image_url, is_default ? 1 : 0
        );

        const variant = db.prepare('SELECT * FROM product_variants WHERE id = ?').get(id);

        res.json({
            success: true,
            variant: {
                ...variant,
                attributes: JSON.parse(variant.attributes || '{}')
            }
        });
    } catch (error) {
        console.error('Create variant error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update variant
router.put('/:projectId/:productId/variants/:variantId', (req, res) => {
    try {
        const db = getDb();
        const { sku, name, attributes, price, compare_price, stock_quantity, image_url, is_default } = req.body;

        db.prepare(`
            UPDATE product_variants SET
                sku = COALESCE(?, sku),
                name = COALESCE(?, name),
                attributes = COALESCE(?, attributes),
                price = COALESCE(?, price),
                compare_price = COALESCE(?, compare_price),
                stock_quantity = COALESCE(?, stock_quantity),
                image_url = COALESCE(?, image_url),
                is_default = COALESCE(?, is_default)
            WHERE id = ? AND product_id = ?
        `).run(
            sku, name, attributes ? JSON.stringify(attributes) : null,
            price, compare_price, stock_quantity, image_url,
            is_default !== undefined ? (is_default ? 1 : 0) : null,
            req.params.variantId, req.params.productId
        );

        const variant = db.prepare('SELECT * FROM product_variants WHERE id = ?').get(req.params.variantId);

        res.json({
            success: true,
            variant: {
                ...variant,
                attributes: JSON.parse(variant.attributes || '{}')
            }
        });
    } catch (error) {
        console.error('Update variant error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete variant
router.delete('/:projectId/:productId/variants/:variantId', (req, res) => {
    try {
        const db = getDb();
        db.prepare('DELETE FROM product_variants WHERE id = ? AND product_id = ?')
            .run(req.params.variantId, req.params.productId);

        res.json({ success: true });
    } catch (error) {
        console.error('Delete variant error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// CATEGORIES
// ============================================================

// Get all categories
router.get('/:projectId/categories/list', (req, res) => {
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

// Create category
router.post('/:projectId/categories', (req, res) => {
    try {
        const db = getDb();
        const id = uuidv4();
        const { name, slug, description, image, parent_id, sort_order } = req.body;

        db.prepare(`
            INSERT INTO categories (id, project_id, name, slug, description, image, parent_id, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, req.params.projectId, name, slug || name.toLowerCase().replace(/\s+/g, '-'),
            description, image, parent_id, sort_order || 0);

        const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);

        res.json({ success: true, category });
    } catch (error) {
        console.error('Create category error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update category
router.put('/:projectId/categories/:categoryId', (req, res) => {
    try {
        const db = getDb();
        const { name, slug, description, image, parent_id, sort_order } = req.body;

        db.prepare(`
            UPDATE categories SET
                name = COALESCE(?, name),
                slug = COALESCE(?, slug),
                description = COALESCE(?, description),
                image = COALESCE(?, image),
                parent_id = COALESCE(?, parent_id),
                sort_order = COALESCE(?, sort_order),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND project_id = ?
        `).run(name, slug, description, image, parent_id, sort_order,
            req.params.categoryId, req.params.projectId);

        const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.categoryId);

        res.json({ success: true, category });
    } catch (error) {
        console.error('Update category error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete category
router.delete('/:projectId/categories/:categoryId', (req, res) => {
    try {
        const db = getDb();
        db.prepare('DELETE FROM categories WHERE id = ? AND project_id = ?')
            .run(req.params.categoryId, req.params.projectId);

        res.json({ success: true });
    } catch (error) {
        console.error('Delete category error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;

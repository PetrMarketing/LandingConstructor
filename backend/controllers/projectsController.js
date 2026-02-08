const { validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../config/database');
const Project = require('../models/Project');
const User = require('../models/User');

// Get all projects for user
exports.getAll = async (req, res) => {
    try {
        let projects;

        // Owner and admin see all projects
        if (req.user.role === 'owner' || req.user.role === 'admin') {
            projects = Project.findAll();
        } else {
            projects = Project.findByMember(req.userId);
        }

        res.json({
            success: true,
            data: projects
        });
    } catch (error) {
        console.error('Get projects error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка при получении проектов'
        });
    }
};

// Get project by ID
exports.getById = async (req, res) => {
    try {
        const project = Project.findById(req.params.id);

        if (!project) {
            return res.status(404).json({
                success: false,
                error: 'Проект не найден'
            });
        }

        // Check access
        if (req.user.role !== 'owner' && req.user.role !== 'admin') {
            if (!Project.hasAccess(project.id, req.userId)) {
                return res.status(403).json({
                    success: false,
                    error: 'Нет доступа к этому проекту'
                });
            }
        }

        // Get members
        const members = Project.getMembers(project.id);

        // Get owner info
        const owner = User.findById(project.owner_id);

        res.json({
            success: true,
            data: {
                ...project,
                settings: JSON.parse(project.settings || '{}'),
                owner: owner ? User.sanitize(owner) : null,
                members
            }
        });
    } catch (error) {
        console.error('Get project error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка при получении проекта'
        });
    }
};

// Create project
exports.create = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { name, description, domain, settings } = req.body;

        const project = Project.create({
            name,
            description,
            domain,
            settings,
            owner_id: req.userId
        });

        res.status(201).json({
            success: true,
            data: {
                ...project,
                settings: JSON.parse(project.settings || '{}')
            }
        });
    } catch (error) {
        console.error('Create project error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка при создании проекта'
        });
    }
};

// Create project with AI recommendations
exports.createWithAI = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { name, niche, description, audience, products, enabledModules, pages, funnelStages } = req.body;

        // 1. Create project with niche data
        const project = Project.create({
            name,
            description: description || '',
            niche: niche || null,
            business_description: description || null,
            target_audience: audience || null,
            key_products: products || null,
            enabled_modules: enabledModules || [],
            ai_generated: true,
            owner_id: req.userId
        });

        const db = getDb();

        // 2. Create default funnel with stages
        if (funnelStages && funnelStages.length > 0) {
            const funnelId = uuidv4();
            db.prepare(`
                INSERT INTO funnels (id, project_id, name, slug, description, is_default, is_active)
                VALUES (?, ?, ?, ?, ?, 1, 1)
            `).run(funnelId, project.id, 'Основная воронка', 'main', 'Автоматически созданная воронка');

            funnelStages.forEach((stageName, index) => {
                const stageId = uuidv4();
                const isWon = index === funnelStages.length - 1 ? 1 : 0;
                const colors = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#06b6d4', '#ec4899', '#6366f1', '#14b8a6'];
                db.prepare(`
                    INSERT INTO funnel_stages (id, funnel_id, name, color, sort_order, is_won, is_lost)
                    VALUES (?, ?, ?, ?, ?, ?, 0)
                `).run(stageId, funnelId, stageName, colors[index % colors.length], index, isWon);
            });
        }

        // 3. Create pages
        if (pages && pages.length > 0) {
            pages.forEach((page) => {
                const pageId = uuidv4();
                db.prepare(`
                    INSERT INTO pages (id, project_id, name, slug, content, status, created_by)
                    VALUES (?, ?, ?, ?, ?, 'draft', ?)
                `).run(
                    pageId,
                    project.id,
                    page.name,
                    page.name.toLowerCase().replace(/[^a-zа-яё0-9]/gi, '-').replace(/-+/g, '-'),
                    JSON.stringify({ template: page.template || 'blank', elements: [] }),
                    req.userId
                );
            });
        }

        res.status(201).json({
            success: true,
            data: {
                ...project,
                enabled_modules: JSON.parse(project.enabled_modules || '[]'),
                settings: JSON.parse(project.settings || '{}')
            }
        });
    } catch (error) {
        console.error('Create project with AI error:', error);
        res.status(500).json({ success: false, error: 'Ошибка при создании проекта' });
    }
};

// Update project
exports.update = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { id } = req.params;
        const { name, description, domain, settings, is_active, enabled_modules, niche, business_description, target_audience, key_products } = req.body;

        const project = Project.findById(id);
        if (!project) {
            return res.status(404).json({
                success: false,
                error: 'Проект не найден'
            });
        }

        // Check permission
        const role = Project.getMemberRole(id, req.userId);
        if (req.user.role !== 'owner' && req.user.role !== 'admin' && role !== 'owner') {
            return res.status(403).json({
                success: false,
                error: 'Нет прав для редактирования проекта'
            });
        }

        const updatedProject = Project.update(id, {
            name,
            description,
            domain,
            settings,
            is_active,
            enabled_modules,
            niche,
            business_description,
            target_audience,
            key_products
        });

        res.json({
            success: true,
            data: {
                ...updatedProject,
                settings: JSON.parse(updatedProject.settings || '{}')
            }
        });
    } catch (error) {
        console.error('Update project error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка при обновлении проекта'
        });
    }
};

// Delete project
exports.delete = async (req, res) => {
    try {
        const { id } = req.params;

        const project = Project.findById(id);
        if (!project) {
            return res.status(404).json({
                success: false,
                error: 'Проект не найден'
            });
        }

        // Only owner and admins can delete projects
        if (req.user.role !== 'owner' && req.user.role !== 'admin' && project.owner_id !== req.userId) {
            return res.status(403).json({
                success: false,
                error: 'Нет прав для удаления проекта'
            });
        }

        Project.delete(id);

        res.json({
            success: true,
            message: 'Проект удалён'
        });
    } catch (error) {
        console.error('Delete project error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка при удалении проекта'
        });
    }
};

// Add member to project
exports.addMember = async (req, res) => {
    try {
        const { id } = req.params;
        const { user_id, email, role } = req.body;

        const project = Project.findById(id);
        if (!project) {
            return res.status(404).json({
                success: false,
                error: 'Проект не найден'
            });
        }

        // Check permission
        const memberRole = Project.getMemberRole(id, req.userId);
        if (req.user.role !== 'owner' && req.user.role !== 'admin' && memberRole !== 'owner') {
            return res.status(403).json({
                success: false,
                error: 'Нет прав для добавления участников'
            });
        }

        // Find user
        let user;
        if (user_id) {
            user = User.findById(user_id);
        } else if (email) {
            user = User.findByEmail(email);
        }

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Пользователь не найден'
            });
        }

        // Can't add owner as member
        if (user.id === project.owner_id) {
            return res.status(400).json({
                success: false,
                error: 'Владелец уже имеет полный доступ'
            });
        }

        // Add member
        const members = Project.addMember(id, user.id, role || 'editor');

        res.json({
            success: true,
            data: members
        });
    } catch (error) {
        console.error('Add member error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка при добавлении участника'
        });
    }
};

// Remove member from project
exports.removeMember = async (req, res) => {
    try {
        const { id, userId } = req.params;

        const project = Project.findById(id);
        if (!project) {
            return res.status(404).json({
                success: false,
                error: 'Проект не найден'
            });
        }

        // Check permission
        const memberRole = Project.getMemberRole(id, req.userId);
        if (req.user.role !== 'owner' && req.user.role !== 'admin' && memberRole !== 'owner') {
            return res.status(403).json({
                success: false,
                error: 'Нет прав для удаления участников'
            });
        }

        // Can't remove owner
        if (userId === project.owner_id) {
            return res.status(400).json({
                success: false,
                error: 'Нельзя удалить владельца проекта'
            });
        }

        Project.removeMember(id, userId);

        const members = Project.getMembers(id);

        res.json({
            success: true,
            data: members
        });
    } catch (error) {
        console.error('Remove member error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка при удалении участника'
        });
    }
};

// Get project members
exports.getMembers = async (req, res) => {
    try {
        const { id } = req.params;

        const project = Project.findById(id);
        if (!project) {
            return res.status(404).json({
                success: false,
                error: 'Проект не найден'
            });
        }

        // Check access
        if (req.user.role !== 'owner' && req.user.role !== 'admin') {
            if (!Project.hasAccess(id, req.userId)) {
                return res.status(403).json({
                    success: false,
                    error: 'Нет доступа к этому проекту'
                });
            }
        }

        const members = Project.getMembers(id);
        const owner = User.findById(project.owner_id);

        res.json({
            success: true,
            data: {
                owner: owner ? User.sanitize(owner) : null,
                members
            }
        });
    } catch (error) {
        console.error('Get members error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка при получении участников'
        });
    }
};

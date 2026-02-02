const { validationResult } = require('express-validator');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const config = require('../config/config');

// Get all users
exports.getAll = async (req, res) => {
    try {
        const { role, limit = 50, offset = 0 } = req.query;

        const users = User.findAll({
            role,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        const total = User.count({ role });

        res.json({
            success: true,
            data: {
                users,
                pagination: {
                    total,
                    limit: parseInt(limit),
                    offset: parseInt(offset)
                }
            }
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка при получении пользователей'
        });
    }
};

// Get user by ID
exports.getById = async (req, res) => {
    try {
        const user = User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Пользователь не найден'
            });
        }

        res.json({
            success: true,
            data: User.sanitize(user)
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка при получении пользователя'
        });
    }
};

// Create user
exports.create = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { email, password, name, phone, role } = req.body;

        // Check if user exists
        const existingUser = User.findByEmail(email);
        if (existingUser) {
            return res.status(400).json({
                success: false,
                error: 'Пользователь с таким email уже существует'
            });
        }

        // Only owner can create admins
        if (role === 'owner' || (role === 'admin' && req.user.role !== 'owner')) {
            return res.status(403).json({
                success: false,
                error: 'Недостаточно прав для создания пользователя с такой ролью'
            });
        }

        const user = await User.create({
            email,
            password,
            name,
            phone,
            role: role || 'client'
        });

        res.status(201).json({
            success: true,
            data: User.sanitize(user)
        });
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка при создании пользователя'
        });
    }
};

// Update user
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
        const { name, email, phone, role, is_active } = req.body;

        const user = User.findById(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Пользователь не найден'
            });
        }

        // Check permissions for role change
        if (role && role !== user.role) {
            if (role === 'owner' || user.role === 'owner') {
                return res.status(403).json({
                    success: false,
                    error: 'Нельзя изменить роль владельца'
                });
            }

            if (role === 'admin' && req.user.role !== 'owner') {
                return res.status(403).json({
                    success: false,
                    error: 'Только владелец может назначать администраторов'
                });
            }
        }

        // Check if email is taken
        if (email && email !== user.email) {
            const existingUser = User.findByEmail(email);
            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    error: 'Email уже используется'
                });
            }
        }

        const updatedUser = await User.update(id, {
            name,
            email,
            phone,
            role,
            is_active
        });

        res.json({
            success: true,
            data: User.sanitize(updatedUser)
        });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка при обновлении пользователя'
        });
    }
};

// Delete user
exports.delete = async (req, res) => {
    try {
        const { id } = req.params;

        const user = User.findById(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Пользователь не найден'
            });
        }

        // Can't delete owner
        if (user.role === 'owner') {
            return res.status(403).json({
                success: false,
                error: 'Нельзя удалить владельца'
            });
        }

        // Can't delete yourself
        if (id === req.userId) {
            return res.status(403).json({
                success: false,
                error: 'Нельзя удалить свой аккаунт'
            });
        }

        // Delete refresh tokens
        RefreshToken.deleteByUserId(id);

        // Delete user
        User.delete(id);

        res.json({
            success: true,
            message: 'Пользователь удалён'
        });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка при удалении пользователя'
        });
    }
};

// Change user role
exports.changeRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;

        if (!role || !Object.values(config.ROLES).includes(role)) {
            return res.status(400).json({
                success: false,
                error: 'Недопустимая роль'
            });
        }

        const user = User.findById(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Пользователь не найден'
            });
        }

        // Can't change owner role
        if (user.role === 'owner' || role === 'owner') {
            return res.status(403).json({
                success: false,
                error: 'Нельзя изменить роль владельца'
            });
        }

        // Only owner can assign admin role
        if (role === 'admin' && req.user.role !== 'owner') {
            return res.status(403).json({
                success: false,
                error: 'Только владелец может назначать администраторов'
            });
        }

        const updatedUser = await User.update(id, { role });

        res.json({
            success: true,
            data: User.sanitize(updatedUser)
        });
    } catch (error) {
        console.error('Change role error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка при изменении роли'
        });
    }
};

// Toggle user active status
exports.toggleActive = async (req, res) => {
    try {
        const { id } = req.params;

        const user = User.findById(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Пользователь не найден'
            });
        }

        // Can't deactivate owner
        if (user.role === 'owner') {
            return res.status(403).json({
                success: false,
                error: 'Нельзя деактивировать владельца'
            });
        }

        // Can't deactivate yourself
        if (id === req.userId) {
            return res.status(403).json({
                success: false,
                error: 'Нельзя деактивировать свой аккаунт'
            });
        }

        const updatedUser = await User.update(id, {
            is_active: !user.is_active
        });

        // If deactivating, remove all refresh tokens
        if (!updatedUser.is_active) {
            RefreshToken.deleteByUserId(id);
        }

        res.json({
            success: true,
            data: User.sanitize(updatedUser)
        });
    } catch (error) {
        console.error('Toggle active error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка при изменении статуса'
        });
    }
};

const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const config = require('../config/config');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const Project = require('../models/Project');

// Generate tokens
const generateTokens = (userId) => {
    const accessToken = jwt.sign(
        { userId },
        config.JWT_SECRET,
        { expiresIn: config.JWT_EXPIRES_IN }
    );

    const refreshToken = jwt.sign(
        { userId, type: 'refresh' },
        config.JWT_SECRET,
        { expiresIn: config.JWT_REFRESH_EXPIRES_IN }
    );

    return { accessToken, refreshToken };
};

// Register
exports.register = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { email, password, name, phone } = req.body;

        // Check if user exists
        const existingUser = User.findByEmail(email);
        if (existingUser) {
            return res.status(400).json({
                success: false,
                error: 'Пользователь с таким email уже существует'
            });
        }

        // Create user
        const user = await User.create({
            email,
            password,
            name,
            phone,
            role: 'client'
        });

        // Generate tokens
        const { accessToken, refreshToken } = generateTokens(user.id);

        // Save refresh token
        RefreshToken.create(user.id, refreshToken);

        // Create default project for user
        Project.create({
            name: 'Мой проект',
            owner_id: user.id
        });

        res.status(201).json({
            success: true,
            data: {
                user: User.sanitize(user),
                accessToken,
                refreshToken
            }
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка при регистрации'
        });
    }
};

// Login
exports.login = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { email, password } = req.body;

        // Find user
        const user = User.findByEmail(email);
        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Неверный email или пароль'
            });
        }

        // Check if user is active
        if (!user.is_active) {
            return res.status(403).json({
                success: false,
                error: 'Аккаунт деактивирован'
            });
        }

        // Verify password
        const isValidPassword = await User.verifyPassword(user, password);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                error: 'Неверный email или пароль'
            });
        }

        // Update last login
        User.updateLastLogin(user.id);

        // Generate tokens
        const { accessToken, refreshToken } = generateTokens(user.id);

        // Save refresh token
        RefreshToken.create(user.id, refreshToken);

        res.json({
            success: true,
            data: {
                user: User.sanitize(user),
                accessToken,
                refreshToken
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка при входе: ' + error.message
        });
    }
};

// Refresh token
exports.refreshToken = async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({
                success: false,
                error: 'Refresh token не указан'
            });
        }

        // Verify token
        let decoded;
        try {
            decoded = jwt.verify(refreshToken, config.JWT_SECRET);
        } catch (error) {
            return res.status(401).json({
                success: false,
                error: 'Недействительный refresh token'
            });
        }

        // Check if token exists in database
        const storedToken = RefreshToken.findByToken(refreshToken);
        if (!storedToken) {
            return res.status(401).json({
                success: false,
                error: 'Refresh token не найден'
            });
        }

        // Check if token is expired
        if (RefreshToken.isExpired(storedToken)) {
            RefreshToken.delete(refreshToken);
            return res.status(401).json({
                success: false,
                error: 'Refresh token истёк'
            });
        }

        // Get user
        const user = User.findById(decoded.userId);
        if (!user || !user.is_active) {
            return res.status(401).json({
                success: false,
                error: 'Пользователь не найден или деактивирован'
            });
        }

        // Delete old refresh token
        RefreshToken.delete(refreshToken);

        // Generate new tokens
        const tokens = generateTokens(user.id);

        // Save new refresh token
        RefreshToken.create(user.id, tokens.refreshToken);

        res.json({
            success: true,
            data: {
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken
            }
        });
    } catch (error) {
        console.error('Refresh token error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка при обновлении токена'
        });
    }
};

// Logout
exports.logout = async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (refreshToken) {
            RefreshToken.delete(refreshToken);
        }

        res.json({
            success: true,
            message: 'Успешный выход'
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка при выходе'
        });
    }
};

// Logout from all devices
exports.logoutAll = async (req, res) => {
    try {
        RefreshToken.deleteByUserId(req.userId);

        res.json({
            success: true,
            message: 'Выход со всех устройств выполнен'
        });
    } catch (error) {
        console.error('Logout all error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка при выходе'
        });
    }
};

// Get current user
exports.me = async (req, res) => {
    try {
        const user = User.findById(req.userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Пользователь не найден'
            });
        }

        // Get user's projects
        const projects = Project.findByMember(user.id);

        res.json({
            success: true,
            data: {
                user: User.sanitize(user),
                projects
            }
        });
    } catch (error) {
        console.error('Get me error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка при получении данных'
        });
    }
};

// Update profile
exports.updateProfile = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { name, phone, avatar } = req.body;

        const user = await User.update(req.userId, {
            name,
            phone,
            avatar
        });

        res.json({
            success: true,
            data: User.sanitize(user)
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка при обновлении профиля'
        });
    }
};

// Change password
exports.changePassword = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { currentPassword, newPassword } = req.body;

        const user = User.findById(req.userId);

        // Verify current password
        const isValidPassword = await User.verifyPassword(user, currentPassword);
        if (!isValidPassword) {
            return res.status(400).json({
                success: false,
                error: 'Неверный текущий пароль'
            });
        }

        // Update password
        await User.update(req.userId, { password: newPassword });

        // Invalidate all refresh tokens
        RefreshToken.deleteByUserId(req.userId);

        res.json({
            success: true,
            message: 'Пароль успешно изменён'
        });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка при смене пароля'
        });
    }
};

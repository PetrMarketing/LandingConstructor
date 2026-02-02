const jwt = require('jsonwebtoken');
const config = require('../config/config');
const User = require('../models/User');
const Project = require('../models/Project');

// Verify JWT token
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            error: 'Требуется авторизация'
        });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, config.JWT_SECRET);
        const user = User.findById(decoded.userId);

        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Пользователь не найден'
            });
        }

        if (!user.is_active) {
            return res.status(403).json({
                success: false,
                error: 'Аккаунт деактивирован'
            });
        }

        req.user = User.sanitize(user);
        req.userId = user.id;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                error: 'Токен истёк',
                code: 'TOKEN_EXPIRED'
            });
        }

        return res.status(401).json({
            success: false,
            error: 'Недействительный токен'
        });
    }
};

// Optional authentication (sets user if token present)
const optionalAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next();
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, config.JWT_SECRET);
        const user = User.findById(decoded.userId);

        if (user && user.is_active) {
            req.user = User.sanitize(user);
            req.userId = user.id;
        }
    } catch (error) {
        // Ignore errors for optional auth
    }

    next();
};

// Check if user has required role
const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Требуется авторизация'
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: 'Недостаточно прав'
            });
        }

        next();
    };
};

// Check if user has required permission
const requirePermission = (permission) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Требуется авторизация'
            });
        }

        const userPermissions = config.PERMISSIONS[req.user.role] || [];

        // Owner has all permissions
        if (userPermissions.includes('*')) {
            return next();
        }

        // Check for specific permission
        if (!userPermissions.includes(permission)) {
            return res.status(403).json({
                success: false,
                error: 'Недостаточно прав для этого действия'
            });
        }

        next();
    };
};

// Check project access
const requireProjectAccess = (req, res, next) => {
    const projectId = req.params.projectId || req.body.project_id || req.query.project_id;

    if (!projectId) {
        return res.status(400).json({
            success: false,
            error: 'ID проекта не указан'
        });
    }

    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: 'Требуется авторизация'
        });
    }

    // Owners and admins have access to all projects
    if (req.user.role === 'owner' || req.user.role === 'admin') {
        const project = Project.findById(projectId);
        if (!project) {
            return res.status(404).json({
                success: false,
                error: 'Проект не найден'
            });
        }
        req.project = project;
        req.projectRole = req.user.role;
        return next();
    }

    // Check if user has access to the project
    if (!Project.hasAccess(projectId, req.userId)) {
        return res.status(403).json({
            success: false,
            error: 'Нет доступа к этому проекту'
        });
    }

    const project = Project.findById(projectId);
    req.project = project;
    req.projectRole = Project.getMemberRole(projectId, req.userId);

    next();
};

// Check if user can perform action on project
const requireProjectPermission = (action) => {
    return (req, res, next) => {
        const projectRole = req.projectRole;

        if (!projectRole) {
            return res.status(403).json({
                success: false,
                error: 'Нет доступа к этому проекту'
            });
        }

        const rolePermissions = {
            owner: ['read', 'create', 'update', 'delete', 'manage'],
            admin: ['read', 'create', 'update', 'delete', 'manage'],
            manager: ['read', 'create', 'update'],
            editor: ['read', 'create', 'update'],
            viewer: ['read']
        };

        const permissions = rolePermissions[projectRole] || [];

        if (!permissions.includes(action)) {
            return res.status(403).json({
                success: false,
                error: 'Недостаточно прав для этого действия'
            });
        }

        next();
    };
};

module.exports = {
    authenticate,
    optionalAuth,
    requireRole,
    requirePermission,
    requireProjectAccess,
    requireProjectPermission
};

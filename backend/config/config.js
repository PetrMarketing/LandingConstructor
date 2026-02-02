require('dotenv').config();

module.exports = {
    // Server
    PORT: process.env.PORT || 3000,
    NODE_ENV: process.env.NODE_ENV || 'development',

    // Database (use /var/data on Render for persistence)
    DB_PATH: process.env.DB_PATH || (process.env.NODE_ENV === 'production' ? '/var/data/cms.db' : './data/cms.db'),

    // JWT
    JWT_SECRET: process.env.JWT_SECRET || 'your-super-secret-key-change-in-production',
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
    JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '30d',

    // Bcrypt
    BCRYPT_ROUNDS: 10,

    // Rate limiting
    RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    RATE_LIMIT_MAX_REQUESTS: 100,

    // File upload
    UPLOAD_DIR: process.env.UPLOAD_DIR || './uploads',
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB

    // CORS
    CORS_ORIGIN: process.env.CORS_ORIGIN || '*',

    // Roles
    ROLES: {
        OWNER: 'owner',
        ADMIN: 'admin',
        MANAGER: 'manager',
        EDITOR: 'editor',
        CLIENT: 'client'
    },

    // Role permissions
    PERMISSIONS: {
        owner: ['*'], // All permissions
        admin: [
            'users.read', 'users.create', 'users.update', 'users.delete',
            'projects.read', 'projects.create', 'projects.update', 'projects.delete',
            'pages.read', 'pages.create', 'pages.update', 'pages.delete',
            'landings.read', 'landings.create', 'landings.update', 'landings.delete',
            'products.read', 'products.create', 'products.update', 'products.delete',
            'orders.read', 'orders.create', 'orders.update', 'orders.delete',
            'settings.read', 'settings.update'
        ],
        manager: [
            'users.read',
            'projects.read',
            'pages.read', 'pages.create', 'pages.update',
            'landings.read', 'landings.create', 'landings.update',
            'products.read', 'products.create', 'products.update',
            'orders.read', 'orders.create', 'orders.update'
        ],
        editor: [
            'projects.read',
            'pages.read', 'pages.create', 'pages.update',
            'landings.read', 'landings.create', 'landings.update',
            'products.read'
        ],
        client: [
            'orders.read.own', 'orders.create.own',
            'profile.read', 'profile.update'
        ]
    }
};

const express = require('express');
const router = express.Router();

// Auth & Users
const authRoutes = require('./auth');
const usersRoutes = require('./users');
const projectsRoutes = require('./projects');
const pagesRoutes = require('./pages');
const aiRoutes = require('./ai');

// CMS Routes
const clientsRoutes = require('./clients');
const employeesRoutes = require('./employees');
const funnelsRoutes = require('./funnels');
const ordersRoutes = require('./orders');
const productsRoutes = require('./products');
const servicesRoutes = require('./services');
const coursesRoutes = require('./courses');
const formsRoutes = require('./forms');
const settingsRoutes = require('./settings');

// Extended CRM Routes
const segmentsRoutes = require('./segments');
const tasksRoutes = require('./tasks');
const dealsRoutes = require('./deals');
const paymentsRoutes = require('./payments');
const interactionsRoutes = require('./interactions');

// API routes - Auth & Core
router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/projects', projectsRoutes);
router.use('/pages', pagesRoutes);
router.use('/ai', aiRoutes);

// API routes - CMS
router.use('/clients', clientsRoutes);
router.use('/employees', employeesRoutes);
router.use('/funnels', funnelsRoutes);
router.use('/orders', ordersRoutes);
router.use('/products', productsRoutes);
router.use('/services', servicesRoutes);
router.use('/courses', coursesRoutes);
router.use('/forms', formsRoutes);
router.use('/settings', settingsRoutes);

// Extended CRM routes
router.use('/segments', segmentsRoutes);
router.use('/tasks', tasksRoutes);
router.use('/deals', dealsRoutes);
router.use('/payments', paymentsRoutes);
router.use('/interactions', interactionsRoutes);

// Health check
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'API is running',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;

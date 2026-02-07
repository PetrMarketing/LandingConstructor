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

// Site & Design Routes
const analyticsRoutes = require('./analytics');
const menusRoutes = require('./menus');
const themesRoutes = require('./themes');
const automationsRoutes = require('./automations');

// E-commerce Extensions
const ecommerceRoutes = require('./ecommerce');

// Booking System (YClients-like)
const bookingsRoutes = require('./bookings');

// Learning Management (GetCourse-like)
const learningRoutes = require('./learning');

// amoCRM-like Features
const callsRoutes = require('./calls');
const regulationsRoutes = require('./regulations');
const goalsRoutes = require('./goals');
const leadDistributionRoutes = require('./lead-distribution');
const employeeAnalyticsRoutes = require('./employee-analytics');
const integrationsRoutes = require('./integrations');
const tagsRoutes = require('./tags');

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

// Site & Design routes
router.use('/analytics', analyticsRoutes);
router.use('/menus', menusRoutes);
router.use('/themes', themesRoutes);
router.use('/automations', automationsRoutes);

// E-commerce extensions (brands, promo codes, collections, related products)
router.use('/ecommerce', ecommerceRoutes);

// Booking system (appointments, schedules, visits)
router.use('/bookings', bookingsRoutes);

// Learning management (access, homework, quizzes, webinars, certificates)
router.use('/learning', learningRoutes);

// amoCRM-like features
router.use('/calls', callsRoutes);
router.use('/regulations', regulationsRoutes);
router.use('/goals', goalsRoutes);
router.use('/lead-distribution', leadDistributionRoutes);
router.use('/employee-analytics', employeeAnalyticsRoutes);
router.use('/integrations', integrationsRoutes);
router.use('/tags', tagsRoutes);

// Health check
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'API is running',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;

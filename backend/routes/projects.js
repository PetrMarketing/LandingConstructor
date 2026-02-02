const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const projectsController = require('../controllers/projectsController');
const { authenticate, requirePermission } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Get all projects
router.get('/', projectsController.getAll);

// Get project by ID
router.get('/:id', projectsController.getById);

// Create project
router.post('/', requirePermission('projects.create'), [
    body('name').notEmpty().withMessage('Введите название проекта')
], projectsController.create);

// Update project
router.put('/:id', [
    body('name').optional().notEmpty().withMessage('Название не может быть пустым')
], projectsController.update);

// Delete project
router.delete('/:id', requirePermission('projects.delete'), projectsController.delete);

// Get project members
router.get('/:id/members', projectsController.getMembers);

// Add member to project
router.post('/:id/members', [
    body('role').optional().isIn(['manager', 'editor', 'viewer']).withMessage('Недопустимая роль')
], projectsController.addMember);

// Remove member from project
router.delete('/:id/members/:userId', projectsController.removeMember);

module.exports = router;

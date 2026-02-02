const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const usersController = require('../controllers/usersController');
const { authenticate, requireRole, requirePermission } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Get all users (admin only)
router.get('/', requirePermission('users.read'), usersController.getAll);

// Get user by ID
router.get('/:id', requirePermission('users.read'), usersController.getById);

// Create user
router.post('/', requirePermission('users.create'), [
    body('email').isEmail().withMessage('Введите корректный email'),
    body('password').isLength({ min: 6 }).withMessage('Пароль должен быть не менее 6 символов'),
    body('name').notEmpty().withMessage('Введите имя'),
    body('role').optional().isIn(['admin', 'manager', 'editor', 'client']).withMessage('Недопустимая роль')
], usersController.create);

// Update user
router.put('/:id', requirePermission('users.update'), [
    body('email').optional().isEmail().withMessage('Введите корректный email'),
    body('name').optional().notEmpty().withMessage('Имя не может быть пустым'),
    body('role').optional().isIn(['admin', 'manager', 'editor', 'client']).withMessage('Недопустимая роль')
], usersController.update);

// Delete user
router.delete('/:id', requirePermission('users.delete'), usersController.delete);

// Change user role
router.put('/:id/role', requireRole('owner', 'admin'), [
    body('role').isIn(['admin', 'manager', 'editor', 'client']).withMessage('Недопустимая роль')
], usersController.changeRole);

// Toggle user active status
router.put('/:id/toggle-active', requirePermission('users.update'), usersController.toggleActive);

module.exports = router;

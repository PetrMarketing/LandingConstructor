const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

// Register
router.post('/register', [
    body('email').isEmail().withMessage('Введите корректный email'),
    body('password').isLength({ min: 6 }).withMessage('Пароль должен быть не менее 6 символов'),
    body('name').notEmpty().withMessage('Введите имя')
], authController.register);

// Login
router.post('/login', [
    body('email').isEmail().withMessage('Введите корректный email'),
    body('password').notEmpty().withMessage('Введите пароль')
], authController.login);

// Refresh token
router.post('/refresh', authController.refreshToken);

// Logout
router.post('/logout', authController.logout);

// Logout from all devices (requires auth)
router.post('/logout-all', authenticate, authController.logoutAll);

// Get current user
router.get('/me', authenticate, authController.me);

// Update profile
router.put('/profile', authenticate, [
    body('name').optional().notEmpty().withMessage('Имя не может быть пустым')
], authController.updateProfile);

// Change password
router.put('/password', authenticate, [
    body('currentPassword').notEmpty().withMessage('Введите текущий пароль'),
    body('newPassword').isLength({ min: 6 }).withMessage('Новый пароль должен быть не менее 6 символов')
], authController.changePassword);

module.exports = router;

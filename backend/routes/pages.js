const express = require('express');
const router = express.Router();
const pagesController = require('../controllers/pagesController');
const { authenticate, requirePermission } = require('../middleware/auth');

// Pages
router.get('/', authenticate, pagesController.getAll);
router.get('/:id', authenticate, pagesController.getById);
router.post('/', authenticate, requirePermission('pages.create'), pagesController.create);
router.put('/:id', authenticate, requirePermission('pages.update'), pagesController.update);
router.delete('/:id', authenticate, requirePermission('pages.delete'), pagesController.delete);
router.post('/:id/duplicate', authenticate, requirePermission('pages.create'), pagesController.duplicate);

// Folders
router.get('/folders/list', authenticate, pagesController.getFolders);
router.post('/folders', authenticate, requirePermission('pages.create'), pagesController.createFolder);
router.put('/folders/:id', authenticate, requirePermission('pages.update'), pagesController.updateFolder);
router.delete('/folders/:id', authenticate, requirePermission('pages.delete'), pagesController.deleteFolder);

module.exports = router;

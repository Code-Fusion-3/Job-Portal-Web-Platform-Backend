const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Public: Get all job categories
router.get('/', categoryController.getAllJobCategories);

// Admin: Get all job categories with pagination and details
router.get('/admin', authenticateToken, requireAdmin, categoryController.adminGetAllJobCategories);

// Admin: Create job category
router.post('/', authenticateToken, requireAdmin, categoryController.createJobCategory);

// Admin: Get specific job category
router.get('/:id', authenticateToken, requireAdmin, categoryController.getJobCategory);

// Admin: Update job category
router.put('/:id', authenticateToken, requireAdmin, categoryController.updateJobCategory);

// Admin: Delete job category
router.delete('/:id', authenticateToken, requireAdmin, categoryController.deleteJobCategory);

module.exports = router; 
const express = require('express');
const router = express.Router();
const adminProfileController = require('../controllers/adminProfileController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Get admin profile (requires authentication)
router.get('/profile', authenticateToken, requireAdmin, adminProfileController.getAdminProfile);

// Update admin profile (requires authentication)
router.put('/profile', authenticateToken, requireAdmin, adminProfileController.updateAdminProfile);

// Get public admin profile (no authentication required - for AdminInfo page)
router.get('/public-profile', adminProfileController.getPublicAdminProfile);

module.exports = router;

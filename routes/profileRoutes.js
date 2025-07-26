const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Get current user's profile
router.get('/me', authenticateToken, profileController.getMyProfile);

// Update current user's profile
router.put('/me', authenticateToken, profileController.updateMyProfile);

// Delete current user's profile/account
router.delete('/me', authenticateToken, profileController.deleteMyProfile);

// Admin: Get all job seekers (with pagination)
router.get('/all', authenticateToken, requireAdmin, profileController.adminGetAllJobSeekers);

// Admin: Get any profile by user ID
router.get('/:id', authenticateToken, requireAdmin, profileController.getProfileById);

// Admin: Create job seeker (worker)
router.post('/', authenticateToken, requireAdmin, profileController.adminCreateJobSeeker);

// Admin: Update any job seeker's profile
router.put('/:id', authenticateToken, requireAdmin, profileController.adminUpdateJobSeeker);

// Admin: Delete worker (job seeker) by user ID
router.delete('/:id', authenticateToken, requireAdmin, profileController.adminDeleteWorker);

module.exports = router; 
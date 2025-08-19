const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { uploadProfilePhoto, handleUploadError } = require('../middleware/upload');

// Get current user's profile (job seeker or admin)
router.get('/me', authenticateToken, profileController.getMyProfile);

// Update current user's profile (job seeker or admin)
router.put('/me', authenticateToken, uploadProfilePhoto, handleUploadError, profileController.updateMyProfile);

// Delete current user's profile/account (job seeker or admin)
router.delete('/me', authenticateToken, profileController.deleteMyProfile);

// Admin: Get all job seekers (with pagination)
router.get('/all', authenticateToken, requireAdmin, profileController.adminGetAllJobSeekers);

// Admin: Get any profile by user ID
router.get('/:id', authenticateToken, requireAdmin, profileController.getProfileById);

// Admin: Create job seeker (worker)
router.post('/', authenticateToken, uploadProfilePhoto, handleUploadError, requireAdmin, profileController.adminCreateJobSeeker);

// Admin: Update any job seeker's profile
router.put('/:id', authenticateToken, uploadProfilePhoto, handleUploadError, requireAdmin, profileController.adminUpdateJobSeeker);

// Admin: Delete worker (job seeker) by user ID
router.delete('/:id', authenticateToken, requireAdmin, profileController.adminDeleteWorker);

// Approval workflow
router.put('/:id/approve', authenticateToken, requireAdmin, profileController.approveProfile);
router.put('/:id/reject', authenticateToken, requireAdmin, profileController.rejectProfile);
router.get('/status/pending', authenticateToken, requireAdmin, profileController.getPendingProfiles);
router.get('/status/approved', authenticateToken, requireAdmin, profileController.getApprovedProfiles);
router.get('/status/rejected', authenticateToken, requireAdmin, profileController.getRejectedProfiles);

module.exports = router;
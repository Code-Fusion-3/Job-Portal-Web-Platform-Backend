const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const adminController = require('../controllers/adminController');

// Multer configuration for avatar uploads
const avatarStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/temp');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and GIF are allowed.'), false);
    }
  }
});

// Existing routes
router.get('/export', authenticateToken, requireAdmin, adminController.exportSystemData);
router.get('/health', authenticateToken, requireAdmin, adminController.getSystemHealth);
router.get('/logs', authenticateToken, requireAdmin, adminController.getSystemLogs);
router.get('/platform-stats', authenticateToken, requireAdmin, adminController.getPlatformStats);

// Admin Profile Management Routes
router.get('/profile', authenticateToken, requireAdmin, adminController.getAdminProfile);
router.put('/profile', authenticateToken, requireAdmin, adminController.updateAdminProfile);
router.put('/change-password', authenticateToken, requireAdmin, adminController.changeAdminPassword);
router.put('/avatar', authenticateToken, requireAdmin, avatarUpload.single('avatar'), adminController.updateAdminAvatar);

// System Settings Routes
router.get('/settings', authenticateToken, requireAdmin, adminController.getSystemSettings);
router.put('/settings', authenticateToken, requireAdmin, adminController.updateSystemSettings);

// ===== NEW WORKFLOW ROUTES =====

// Employer Request Management
router.get('/employer-requests/:requestId', authenticateToken, requireAdmin, adminController.getEmployerRequest);
router.post('/employer-requests/:requestId/approve', authenticateToken, requireAdmin, adminController.approveEmployerRequest);
router.post('/employer-requests/:requestId/reject', authenticateToken, requireAdmin, adminController.rejectEmployerRequest);
router.post('/employer-requests/:requestId/request-second-payment', authenticateToken, requireAdmin, adminController.requestSecondPayment);
router.post('/employer-requests/:requestId/approve-full-details-request', authenticateToken, requireAdmin, adminController.approveFullDetailsRequest);
router.post('/employer-requests/:requestId/update-candidate-availability', authenticateToken, requireAdmin, adminController.updateCandidateAvailability);



// Payment Management
// Job seekers management routes
router.get('/job-seekers', authenticateToken, requireAdmin, adminController.getAllJobSeekers);

// Get all employer requests with rich data (admin)
router.get('/employer-requests', authenticateToken, requireAdmin, adminController.getAllEmployerRequestsWithRichData);

// Payment management routes
router.post('/payments/:paymentId/approve', authenticateToken, requireAdmin, adminController.approvePayment);
router.post('/payments/:paymentId/reject', authenticateToken, requireAdmin, adminController.rejectPayment);

// Payment approval by request ID
router.post('/employer-requests/:requestId/approve-first-payment', authenticateToken, requireAdmin, adminController.approveFirstPayment);
router.post('/employer-requests/:requestId/reject-first-payment', authenticateToken, requireAdmin, adminController.rejectFirstPayment);
router.post('/employer-requests/:requestId/approve-second-payment', authenticateToken, requireAdmin, adminController.approveSecondPayment);
router.post('/employer-requests/:requestId/reject-second-payment', authenticateToken, requireAdmin, adminController.rejectSecondPayment);

module.exports = router; 
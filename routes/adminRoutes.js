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

module.exports = router; 
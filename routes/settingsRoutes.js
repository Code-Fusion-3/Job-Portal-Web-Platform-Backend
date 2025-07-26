const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Admin: Get system settings
router.get('/system', authenticateToken, requireAdmin, settingsController.getSystemSettings);

// Admin: Update system settings
router.put('/system', authenticateToken, requireAdmin, settingsController.updateSystemSettings);

// Admin: Get email templates
router.get('/email-templates', authenticateToken, requireAdmin, settingsController.getEmailTemplates);

// Admin: Update email template
router.put('/email-templates', authenticateToken, requireAdmin, settingsController.updateEmailTemplate);

// Admin: Get system logs
router.get('/logs', authenticateToken, requireAdmin, settingsController.getSystemLogs);

// Admin: Backup system data
router.post('/backup', authenticateToken, requireAdmin, settingsController.backupSystemData);

module.exports = router; 
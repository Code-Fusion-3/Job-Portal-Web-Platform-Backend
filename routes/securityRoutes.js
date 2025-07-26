const express = require('express');
const router = express.Router();
const securityController = require('../controllers/securityController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Public: Refresh access token
router.post('/refresh-token', securityController.refreshToken);

// Public: Request password reset
router.post('/request-password-reset', securityController.requestPasswordReset);

// Public: Reset password with token
router.post('/reset-password', securityController.resetPassword);

// Authenticated: Revoke token (logout)
router.post('/logout', authenticateToken, securityController.revokeToken);

// Authenticated: Change password
router.post('/change-password', authenticateToken, securityController.changePassword);

// Admin: Get user sessions
router.get('/user-sessions/:userId', authenticateToken, requireAdmin, securityController.getUserSessions);

// Admin: Revoke user session
router.delete('/user-sessions/:userId/:sessionId', authenticateToken, requireAdmin, securityController.revokeUserSession);

// Admin: Get security logs
router.get('/logs', authenticateToken, requireAdmin, securityController.getSecurityLogs);

module.exports = router; 
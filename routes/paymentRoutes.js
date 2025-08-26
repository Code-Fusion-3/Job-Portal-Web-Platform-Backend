const express = require('express');
const router = express.Router();
const { 
  requestPayment, 
  confirmPayment, 
  approvePayment, 
  getPaymentDetails, 
  getAllPayments, 
  getRequestProgress 
} = require('../controllers/paymentController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Admin routes (require authentication and admin role)
router.post('/request', authenticateToken, requireAdmin, requestPayment);
router.post('/approve', authenticateToken, requireAdmin, approvePayment);
router.get('/admin/all', authenticateToken, requireAdmin, getAllPayments);

// Employer routes (public - no authentication required for payment confirmation)
router.post('/confirm', confirmPayment);
router.get('/details/:employerRequestId', getPaymentDetails);
router.get('/progress/:employerRequestId', getRequestProgress);

module.exports = router;

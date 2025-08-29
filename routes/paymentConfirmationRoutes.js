const express = require('express');
const router = express.Router();
const { 
  confirmPayment, 
  reviewPaymentConfirmation 
} = require('../controllers/paymentConfirmationController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Employer routes (require authentication)
router.post('/confirm', authenticateToken, confirmPayment);

// Admin routes (require authentication and admin role)
router.post('/review/:paymentId', authenticateToken, requireAdmin, reviewPaymentConfirmation);

module.exports = router;

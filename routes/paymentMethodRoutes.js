const express = require('express');
const router = express.Router();
const { 
  createPaymentMethod, 
  getAllPaymentMethods, 
  getActivePaymentMethods, 
  updatePaymentMethod, 
  deletePaymentMethod, 
  togglePaymentMethodStatus, 
  reorderPaymentMethods 
} = require('../controllers/paymentMethodController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Public route (no authentication required)
router.get('/active', getActivePaymentMethods);

// Admin routes (require authentication and admin role)
router.post('/', authenticateToken, requireAdmin, createPaymentMethod);
router.get('/admin/all', authenticateToken, requireAdmin, getAllPaymentMethods);
router.put('/:id', authenticateToken, requireAdmin, updatePaymentMethod);
router.delete('/:id', authenticateToken, requireAdmin, deletePaymentMethod);
router.patch('/:id/toggle', authenticateToken, requireAdmin, togglePaymentMethodStatus);
router.post('/reorder', authenticateToken, requireAdmin, reorderPaymentMethods);

module.exports = router;

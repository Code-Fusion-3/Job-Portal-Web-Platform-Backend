const express = require('express');
const router = express.Router();
const { 
  createEmployerAccount, 
  employerLogin, 
  changePassword, 
  getEmployerProfile, 
  updateEmployerProfile, 
  forgotPassword 
} = require('../controllers/employerAuthController');
const { authenticateToken, requireEmployer } = require('../middleware/auth');

// Public routes (no authentication required)
router.post('/register', createEmployerAccount);
router.post('/login', employerLogin);
router.post('/forgot-password', forgotPassword);

// Protected routes (require employer authentication)
router.get('/profile', authenticateToken, requireEmployer, getEmployerProfile);
router.put('/profile', authenticateToken, requireEmployer, updateEmployerProfile);
router.put('/change-password', authenticateToken, requireEmployer, changePassword);

module.exports = router;

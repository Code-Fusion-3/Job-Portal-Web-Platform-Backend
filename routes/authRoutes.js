const express = require('express');
const router = express.Router();
const { registerJobSeeker, login } = require('../controllers/authController');
const { validateJobSeekerRegistration, handleValidationErrors } = require('../middleware/validate');
const { uploadProfilePhoto, handleUploadError } = require('../middleware/upload');

router.post('/register', 
  uploadProfilePhoto, 
  handleUploadError,
  validateJobSeekerRegistration, 
  handleValidationErrors, 
  registerJobSeeker
);

router.post('/login', login);

module.exports = router; 
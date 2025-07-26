const express = require('express');
const router = express.Router();
const { registerJobSeeker } = require('../controllers/authController');
const { validateJobSeekerRegistration, handleValidationErrors } = require('../middleware/validate');

router.post('/register', validateJobSeekerRegistration, handleValidationErrors, registerJobSeeker);

module.exports = router; 
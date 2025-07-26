const express = require('express');
const router = express.Router();
const publicController = require('../controllers/publicController');

// Public: Get anonymized job seekers with filtering
router.get('/job-seekers', publicController.getPublicJobSeekers);

// Public: Get job seeker statistics
router.get('/statistics', publicController.getPublicStatistics);

// Public: Get available filters for job seeker search
router.get('/filters', publicController.getAvailableFilters);

module.exports = router; 
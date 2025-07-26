const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Public: Advanced job seeker search
router.get('/job-seekers', searchController.searchJobSeekers);

// Public: Get search suggestions
router.get('/suggestions', searchController.getSearchSuggestions);

// Public: Get search filters and options
router.get('/filters', searchController.getSearchFilters);

// Admin: Search within conversations
router.get('/conversations', authenticateToken, requireAdmin, searchController.searchConversations);

module.exports = router; 
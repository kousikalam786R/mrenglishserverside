const express = require('express');
const router = express.Router();
const { getRankings, getMyRanking } = require('../controllers/rankingController');
const { protect } = require('../middleware/authMiddleware');

// Get rankings for a specific period
// Query params: period (today, week, month)
router.get('/', protect, getRankings);

// Get current user's ranking and stats
router.get('/me', protect, getMyRanking);

module.exports = router;


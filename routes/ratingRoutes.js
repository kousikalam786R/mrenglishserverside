const express = require('express');
const router = express.Router();
const { 
  submitRating,
  submitFeedback,
  submitCompliment,
  submitAdvice,
  getUserRatingSummary,
  getUserRatings,
  getUserFeedback
} = require('../controllers/ratingController');
const { protect } = require('../middleware/authMiddleware');

// Submit rating for a user
router.post('/submit', protect, submitRating);

// Submit feedback for a user
router.post('/feedback', protect, submitFeedback);

// Submit compliment for a user
router.post('/compliment', protect, submitCompliment);

// Submit advice for a user
router.post('/advice', protect, submitAdvice);

// Get current user's rating summary (stats + recent data)
router.get('/summary/me', protect, async (req, res) => {
  // Redirect to the main function with current user ID
  req.params.userId = req.user.id;
  getUserRatingSummary(req, res);
});

// Get user rating summary (stats + recent data)
router.get('/summary/:userId', protect, getUserRatingSummary);

// Get detailed ratings for a user
router.get('/:userId', protect, getUserRatings);

// Get detailed feedback for a user
router.get('/feedback/:userId', protect, getUserFeedback);

module.exports = router;

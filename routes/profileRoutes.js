const express = require('express');
const router = express.Router();
const { 
  getProfile, 
  updateProfile, 
  getUserStats, 
  getProfileOptions 
} = require('../controllers/profileController');
const { protect } = require('../middleware/authMiddleware');

// Get current user's profile
router.get('/', protect, getProfile);

// Update current user's profile
router.put('/', protect, updateProfile);

// Get user statistics (for stats tab)
router.get('/stats', protect, getUserStats);

// Get available options for profile fields (languages, countries, etc.)
router.get('/options', protect, getProfileOptions);

module.exports = router;

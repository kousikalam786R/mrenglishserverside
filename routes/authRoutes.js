const express = require('express');
const router = express.Router();
const { googleAuth, getCurrentUser, getAllUsers, getUserById, signup, login, updateCurrentUser } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const auth = require('../middleware/auth');
const authController = require('../controllers/authController');

// Google authentication
router.post('/google', googleAuth);

// Manual authentication
router.post('/signup', signup);
router.post('/login', login);

// Get current user (protected route)
router.get('/me', protect, getCurrentUser);

//update user details
router.put('/profile',protect,updateCurrentUser)

// Get all users (protected route)
router.get('/users', protect, getAllUsers);

// Get user by ID (protected route)
router.get('/users/:userId', protect, getUserById);

// User registration 
router.post('/register', function(req, res) {
  return authController.register(req, res);
});

// User login
router.post('/login', function(req, res) {
  return authController.login(req, res);
});

// Get current user profile
router.get('/me', auth, function(req, res) {
  return authController.getCurrentUser(req, res);
});

// Update current user profile
router.post('/profile', auth, function(req, res) {
  return authController.updateCurrentUser(req, res);
});

// Get user by ID
router.get('/users/:userId', auth, function(req, res) {
  return authController.getUserById(req, res);
});

// Get all users for testing (everyone set as online)
router.get('/test-users', auth, function(req, res) {
  return authController.getTestUsers(req, res);
});

// Get only truly online users
router.get('/online-users', auth, function(req, res) {
  return authController.getOnlineUsers(req, res);
});

// Debug endpoint to check online users (no auth required for testing)
router.get('/debug-online-users', function(req, res) {
  return authController.debugOnlineUsers(req, res);
});

module.exports = router; 
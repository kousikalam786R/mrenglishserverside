const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const messageController = require('../controllers/messageController');
const auth = require('../middleware/auth');

// Get all messages between current user and another user
router.get('/conversations/:receiverId', auth, messageController.getMessages);

// Send a new message
router.post(
  '/send',
  [
    auth,
    check('receiverId', 'Receiver ID is required').not().isEmpty(),
    check('content', 'Message content is required').not().isEmpty()
  ],
  messageController.sendMessage
);

// Get recent chats
router.get('/recent', auth, messageController.getRecentChats);

// Get only connected users (simpler format than recent chats)
router.get('/connected-users', auth, messageController.getConnectedUsers);

module.exports = router; 
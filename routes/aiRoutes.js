const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { protect } = require('../middleware/authMiddleware');

// All AI routes require authentication
router.use(protect);

// Generate AI response
router.post('/generate', aiController.generateResponse);

// Add chat endpoint to match frontend expectations (maps to the same controller)
router.post('/chat', aiController.generateResponse);

// Get conversation history
router.get('/conversations', aiController.getConversationHistory);

// Get specific conversation
router.get('/conversations/:conversationId', aiController.getConversation);

module.exports = router; 
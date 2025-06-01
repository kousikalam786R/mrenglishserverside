const aiService = require('../utils/aiService');

/**
 * Generate an AI response to a user message
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
exports.generateResponse = async (req, res) => {
  try {
    const { message, conversationId, options } = req.body;
    const userId = req.user.id;
    
    console.log(`AI request from user ${userId}: ${message?.substring(0, 30)}...`);
    
    // Validate request
    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }
    
    // Generate response
    const result = await aiService.generateResponse(
      userId,
      message,
      conversationId,
      options
    );
    
    // Format response to match frontend expectations
    return res.status(200).json({
      success: true,
      messageId: result.conversation.messages[result.conversation.messages.length - 1]._id,
      content: result.response,
      conversationId: result.conversationId,
      timestamp: new Date().toISOString(),
      conversation: result.conversation
    });
  } catch (error) {
    console.error('AI Controller Error:', error);
    
    // Handle specific errors
    if (error.message === 'Conversation not found' || error.message === 'Unauthorized access to conversation') {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }
    
    // Handle API errors from OpenAI
    if (error.response && error.response.status) {
      return res.status(error.response.status).json({
        success: false,
        error: error.message || 'AI service error'
      });
    }
    
    // Log detailed error for debugging
    console.error('AI Controller Detailed Error:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    return res.status(500).json({
      success: false,
      error: 'Server error processing AI request'
    });
  }
};

/**
 * Get conversation history for a user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
exports.getConversationHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit || '10', 10);
    const skip = parseInt(req.query.skip || '0', 10);
    
    const conversations = await aiService.getConversationHistory(userId, limit, skip);
    
    return res.status(200).json({
      success: true,
      data: conversations,
      pagination: {
        limit,
        skip
      }
    });
  } catch (error) {
    console.error('Error fetching conversation history:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Server error fetching conversation history'
    });
  }
};

/**
 * Get a specific conversation by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
exports.getConversation = async (req, res) => {
  try {
    const userId = req.user.id;
    const { conversationId } = req.params;
    
    if (!conversationId) {
      return res.status(400).json({
        success: false,
        error: 'Conversation ID is required'
      });
    }
    
    const conversation = await aiService.getConversation(conversationId, userId);
    
    return res.status(200).json({
      success: true,
      data: conversation
    });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    
    // Handle specific errors
    if (error.message === 'Conversation not found' || error.message === 'Unauthorized access to conversation') {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }
    
    return res.status(500).json({
      success: false,
      error: 'Server error fetching conversation'
    });
  }
}; 
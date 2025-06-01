const { OpenAI } = require('openai');
const aiConfig = require('../config/ai-config');
const AIConversation = require('../models/AIConversation');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: aiConfig.openai.apiKey,
});

// System prompts for different contexts
const SYSTEM_PROMPTS = {
  default: "You are RAHA AI, an English language learning assistant. Help users practice their conversational English skills by engaging in natural conversations and providing gentle corrections. Focus on being encouraging and helpful.",
  
  beginner: "You are RAHA AI, an English language learning assistant for beginners. Use simple words and short sentences. Speak slowly and clearly. Avoid complex grammar and idioms. Be very patient and encouraging.",
  
  intermediate: "You are RAHA AI, an English language learning assistant for intermediate learners. Use moderate vocabulary and common expressions. Introduce some idioms but explain them. Help users expand their vocabulary with synonyms for words they use.",
  
  advanced: "You are RAHA AI, an English language learning assistant for advanced learners. Use natural, native-level English. Include idioms, phrasal verbs, and advanced vocabulary. Politely correct subtle grammar errors and suggest more natural phrasing.",
  
  interview: "You are RAHA AI, an English interview practice assistant. Simulate a job interviewer asking questions and evaluating responses. Provide constructive feedback on both language use and content of answers. Help the user prepare for English-language job interviews."
};

/**
 * Generate an AI response based on the conversation history
 * @param {string} userId - The user's ID
 * @param {string} message - The user's message
 * @param {string} conversationId - Optional conversation ID for continuing a conversation
 * @param {Object} options - Additional options like language level, topic, etc.
 * @returns {Promise<Object>} - The AI response and conversation data
 */
async function generateResponse(userId, message, conversationId = null, options = {}) {
  try {
    // Default options
    const defaultOptions = {
      languageLevel: 'intermediate',
      topic: 'general',
      model: aiConfig.openai.defaultModel,
      temperature: aiConfig.openai.temperature,
      maxTokens: aiConfig.openai.maxTokens
    };
    
    // Merge default options with provided options
    const settings = { ...defaultOptions, ...options };
    
    // Get or create conversation
    let conversation;
    
    if (conversationId) {
      // Get existing conversation
      conversation = await AIConversation.findById(conversationId);
      
      if (!conversation) {
        throw new Error('Conversation not found');
      }
      
      // Verify user owns the conversation
      if (conversation.userId.toString() !== userId) {
        throw new Error('Unauthorized access to conversation');
      }
    } else {
      // Create a new conversation
      conversation = new AIConversation({
        userId,
        topic: settings.topic,
        languageLevel: settings.languageLevel,
        title: message.substring(0, 30) + '...',
        messages: [
          {
            role: 'system',
            content: SYSTEM_PROMPTS[settings.languageLevel] || SYSTEM_PROMPTS.default
          }
        ]
      });
    }
    
    // Add user message to conversation
    conversation.messages.push({
      role: 'user',
      content: message
    });
    
    // Prepare messages for OpenAI API
    const messages = conversation.messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    
    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: settings.model,
      messages,
      temperature: settings.temperature,
      max_tokens: settings.maxTokens
    });
    
    // Extract AI response
    const aiResponse = completion.choices[0].message.content;
    
    // Add AI response to conversation
    conversation.messages.push({
      role: 'assistant',
      content: aiResponse
    });
    
    // Save conversation
    await conversation.save();
    
    // Return AI response and conversation data
    return {
      response: aiResponse,
      conversationId: conversation._id,
      conversation
    };
  } catch (error) {
    console.error('AI Service Error:', error);
    throw error;
  }
}

/**
 * Get conversation history for a user
 * @param {string} userId - The user's ID
 * @param {number} limit - Number of conversations to return
 * @param {number} skip - Number of conversations to skip for pagination
 * @returns {Promise<Array>} - List of conversations
 */
async function getConversationHistory(userId, limit = 10, skip = 0) {
  try {
    const conversations = await AIConversation.find({ userId })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .skip(skip);
    
    return conversations;
  } catch (error) {
    console.error('Error fetching conversation history:', error);
    throw error;
  }
}

/**
 * Get a specific conversation by ID
 * @param {string} conversationId - The conversation ID
 * @param {string} userId - The user's ID (for authorization)
 * @returns {Promise<Object>} - The conversation data
 */
async function getConversation(conversationId, userId) {
  try {
    const conversation = await AIConversation.findById(conversationId);
    
    if (!conversation) {
      throw new Error('Conversation not found');
    }
    
    // Verify user owns the conversation
    if (conversation.userId.toString() !== userId) {
      throw new Error('Unauthorized access to conversation');
    }
    
    return conversation;
  } catch (error) {
    console.error('Error fetching conversation:', error);
    throw error;
  }
}

module.exports = {
  generateResponse,
  getConversationHistory,
  getConversation
}; 
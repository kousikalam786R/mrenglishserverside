const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'assistant', 'system'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const aiConversationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    default: 'New Conversation'
  },
  messages: [messageSchema],
  contextInfo: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  topic: {
    type: String,
    default: 'general'
  },
  languageLevel: {
    type: String,
    default: 'intermediate'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  },
  feedbackRating: {
    type: Number,
    min: 1,
    max: 5
  }
});

// Update the updatedAt field before save
aiConversationSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Add an index for faster queries
aiConversationSchema.index({ userId: 1, createdAt: -1 });

const AIConversation = mongoose.model('AIConversation', aiConversationSchema);

module.exports = AIConversation; 
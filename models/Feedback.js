const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  // The user receiving feedback
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // The user giving feedback
  feedbackBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // Feedback type (positive/negative)
  feedbackType: {
    type: String,
    enum: ['positive', 'negative'],
    required: true,
  },
  // Optional feedback message
  message: {
    type: String,
    trim: true,
    maxlength: 1000,
  },
  // Type of interaction that led to this feedback
  interactionType: {
    type: String,
    enum: ['call', 'chat', 'ai_conversation'],
    default: 'call',
  },
  // Reference to the specific interaction
  interactionId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false,
  },
  // Whether feedback is public or private
  isPublic: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

// Virtual for formatted date
feedbackSchema.virtual('formattedDate').get(function() {
  return this.createdAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

const Feedback = mongoose.model('Feedback', feedbackSchema);

module.exports = Feedback;


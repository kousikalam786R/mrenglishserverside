const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema({
  // The user being rated
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // The user who gave the rating
  ratedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // Rating value (1-5 stars)
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
  // Optional comment/review
  comment: {
    type: String,
    trim: true,
    maxlength: 500,
  },
  // Type of interaction that led to this rating
  interactionType: {
    type: String,
    enum: ['call', 'chat', 'ai_conversation'],
    default: 'call',
  },
  // Reference to the specific interaction (call, chat, etc.)
  interactionId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false,
  },
}, {
  timestamps: true,
});

// Ensure a user can only rate another user once per interaction
ratingSchema.index({ user: 1, ratedBy: 1, interactionId: 1 }, { unique: true });

// Virtual for formatted date
ratingSchema.virtual('formattedDate').get(function() {
  return this.createdAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

const Rating = mongoose.model('Rating', ratingSchema);

module.exports = Rating;


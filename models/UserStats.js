const mongoose = require('mongoose');

const userStatsSchema = new mongoose.Schema({
  // Reference to the user
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  // Call statistics
  totalCalls: {
    type: Number,
    default: 0,
  },
  totalMinutes: {
    type: Number,
    default: 0,
  },
  totalHours: {
    type: Number,
    default: 0,
  },
  // Rating statistics
  totalRatings: {
    type: Number,
    default: 0,
  },
  averageRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5,
  },
  // Feedback statistics
  positiveFeedback: {
    type: Number,
    default: 0,
  },
  negativeFeedback: {
    type: Number,
    default: 0,
  },
  // Satisfaction percentage
  satisfactionPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  // Activity statistics
  lastActiveAt: {
    type: Date,
    default: Date.now,
  },
  // Streak information
  currentStreak: {
    type: Number,
    default: 0,
  },
  longestStreak: {
    type: Number,
    default: 0,
  },
  // Points system
  totalPoints: {
    type: Number,
    default: 0,
  },
  // Level based on activity
  level: {
    type: String,
    default: 'Beginner',
    enum: ['Beginner', 'Intermediate', 'Advanced', 'Expert', 'Master'],
  },
}, {
  timestamps: true,
});

// Method to calculate satisfaction percentage
userStatsSchema.methods.calculateSatisfactionPercentage = function() {
  const total = this.positiveFeedback + this.negativeFeedback;
  if (total === 0) return 0;
  return Math.round((this.positiveFeedback / total) * 100);
};

// Method to update stats when new rating is added
userStatsSchema.methods.updateRatingStats = function(newRating) {
  this.totalRatings += 1;
  // Recalculate average rating
  const totalRatingPoints = (this.averageRating * (this.totalRatings - 1)) + newRating;
  this.averageRating = totalRatingPoints / this.totalRatings;
};

// Method to update stats when new feedback is added
userStatsSchema.methods.updateFeedbackStats = function(feedbackType) {
  if (feedbackType === 'positive') {
    this.positiveFeedback += 1;
  } else {
    this.negativeFeedback += 1;
  }
  this.satisfactionPercentage = this.calculateSatisfactionPercentage();
};

const UserStats = mongoose.model('UserStats', userStatsSchema);

module.exports = UserStats;


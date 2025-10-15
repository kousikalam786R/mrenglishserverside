const mongoose = require('mongoose');

const complimentSchema = new mongoose.Schema({
  // The user receiving the compliment
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // The user giving the compliment
  complimentBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // Type of compliment
  complimentType: {
    type: String,
    enum: [
      'Great speaking partner',
      'Speaks clearly',
      'Interesting person',
      'Respectful and polite',
      'Attentive listener',
      'Helps me with my English',
      'Helps me express myself',
      'Patient teacher',
      'Good pronunciation',
      'Friendly and welcoming'
    ],
    required: true,
  },
  // Type of interaction that led to this compliment
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
}, {
  timestamps: true,
});

// Index for efficient queries
complimentSchema.index({ user: 1, complimentType: 1 });

const Compliment = mongoose.model('Compliment', complimentSchema);

module.exports = Compliment;


const mongoose = require('mongoose');

const adviceSchema = new mongoose.Schema({
  // The user receiving the advice
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // The user giving the advice
  adviceBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // Type of advice
  adviceType: {
    type: String,
    enum: [
      'Speak more',
      'Listen more',
      'Improve the audio quality',
      'Improve the pronunciation',
      'Be kinder',
      'Find a quiet place',
      'Get a stable internet',
      'Be less intrusive',
      'Don\'t flirt',
      'Speak slower',
      'Speak louder',
      'Use simpler words',
      'Ask more questions',
      'Be more patient',
      'Focus on grammar'
    ],
    required: true,
  },
  // Type of interaction that led to this advice
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
adviceSchema.index({ user: 1, adviceType: 1 });

const Advice = mongoose.model('Advice', adviceSchema);

module.exports = Advice;

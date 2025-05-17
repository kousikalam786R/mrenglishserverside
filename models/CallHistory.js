const mongoose = require('mongoose');

const callHistorySchema = new mongoose.Schema(
  {
    caller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    startTime: {
      type: Date,
      required: true,
      default: Date.now
    },
    endTime: {
      type: Date
    },
    duration: {
      type: Number,
      default: 0 // Duration in seconds
    },
    isVideoCall: {
      type: Boolean,
      default: false
    },
    status: {
      type: String,
      enum: ['missed', 'answered', 'rejected', 'failed', 'busy'],
      default: 'missed'
    },
    endedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

// Calculated virtual field for duration if not provided
callHistorySchema.virtual('calculatedDuration').get(function() {
  if (this.duration > 0) {
    return this.duration;
  }
  
  if (this.endTime && this.startTime) {
    // Calculate duration in seconds
    return Math.floor((this.endTime - this.startTime) / 1000);
  }
  
  return 0;
});

const CallHistory = mongoose.model('CallHistory', callHistorySchema);

module.exports = CallHistory; 
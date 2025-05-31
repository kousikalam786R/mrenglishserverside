const CallHistory = require('../models/CallHistory');
const User = require('../models/User');
// Remove the static Call import since we'll use dynamic requires
// const Call = require('../models/Call');

// Record a new call attempt
exports.recordCallAttempt = async (callerId, receiverId, isVideoCall) => {
  try {
    // Create new call history record
    const callHistory = new CallHistory({
      caller: callerId,
      receiver: receiverId,
      isVideoCall,
      status: 'missed' // Default status
    });
    
    await callHistory.save();
    return callHistory;
  } catch (error) {
    console.error('Error recording call attempt:', error);
    return null;
  }
};

// Update call status when answered
exports.callAnswered = async (callHistoryId) => {
  try {
    const callHistory = await CallHistory.findById(callHistoryId);
    
    if (!callHistory) {
      return null;
    }
    
    callHistory.status = 'answered';
    await callHistory.save();
    
    return callHistory;
  } catch (error) {
    console.error('Error updating call as answered:', error);
    return null;
  }
};

// Update call status when rejected
exports.callRejected = async (callHistoryId) => {
  try {
    const callHistory = await CallHistory.findById(callHistoryId);
    
    if (!callHistory) {
      return null;
    }
    
    callHistory.status = 'rejected';
    await callHistory.save();
    
    return callHistory;
  } catch (error) {
    console.error('Error updating call as rejected:', error);
    return null;
  }
};

// End a call and update duration
exports.endCall = async (callHistoryId, endedBy) => {
  try {
    const callHistory = await CallHistory.findById(callHistoryId);
    
    if (!callHistory) {
      return null;
    }
    
    callHistory.endTime = new Date();
    callHistory.endedBy = endedBy;
    
    // Calculate duration in seconds
    if (callHistory.startTime) {
      callHistory.duration = Math.floor(
        (callHistory.endTime - callHistory.startTime) / 1000
      );
    }
    
    await callHistory.save();
    return callHistory;
  } catch (error) {
    console.error('Error ending call:', error);
    return null;
  }
};

// Get call history for a user
exports.getCallHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Find calls where user is either caller or receiver
    const callHistory = await CallHistory.find({
      $or: [
        { caller: userId },
        { receiver: userId }
      ]
    })
    .populate('caller', 'name profilePic')
    .populate('receiver', 'name profilePic')
    .sort({ startTime: -1 })
    .limit(50);
    
    return res.status(200).json(callHistory);
  } catch (error) {
    console.error('Error getting call history:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Get call details
exports.getCallDetails = async (req, res) => {
  try {
    const { callId } = req.params;
    
    const callDetails = await CallHistory.findById(callId)
      .populate('caller', 'name profilePic')
      .populate('receiver', 'name profilePic')
      .populate('endedBy', 'name');
      
    if (!callDetails) {
      return res.status(404).json({ message: 'Call not found' });
    }
    
    return res.status(200).json(callDetails);
  } catch (error) {
    console.error('Error getting call details:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Update a call to indicate video is now used
 * @param {string} userId - The user ID of one participant
 * @param {string} otherUserId - The user ID of the other participant
 * @returns {Promise} - Promise resolving when the call is updated
 */
exports.updateCallToVideo = async (userId, otherUserId) => {
  try {
    let result = null;
    
    // Try to update using the Call model
    try {
      const Call = require('../models/Call');
      
      result = await Call.findOneAndUpdate(
        { 
          $or: [
            { caller: userId, recipient: otherUserId, status: 'connected' },
            { caller: otherUserId, recipient: userId, status: 'connected' }
          ]
        },
        { isVideo: true },
        { new: true }
      );
      
      if (result) {
        console.log(`Call between ${userId} and ${otherUserId} updated to video using Call model`);
        return result;
      }
    } catch (callModelError) {
      console.log('Call model not available, falling back to CallHistory:', callModelError.message);
    }
    
    // Fall back to CallHistory if Call model didn't work or no result found
    try {
      result = await CallHistory.findOneAndUpdate(
        { 
          $or: [
            { caller: userId, receiver: otherUserId, status: 'answered' },
            { caller: otherUserId, receiver: userId, status: 'answered' }
          ]
        },
        { isVideoCall: true },
        { new: true }
      );
      
      if (result) {
        console.log(`Call between ${userId} and ${otherUserId} updated to video using CallHistory model`);
      } else {
        console.log(`No active call found between ${userId} and ${otherUserId}`);
      }
    } catch (callHistoryError) {
      console.error('Error updating CallHistory:', callHistoryError);
    }
    
    return result;
  } catch (error) {
    console.error('Error updating call to video:', error);
    throw error;
  }
}; 
const CallHistory = require('../models/CallHistory');
const User = require('../models/User');

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
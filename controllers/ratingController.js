const Rating = require('../models/Rating');
const Feedback = require('../models/Feedback');
const Compliment = require('../models/Compliment');
const Advice = require('../models/Advice');
const UserStats = require('../models/UserStats');
const User = require('../models/User');
const mongoose = require('mongoose');

// Submit a rating for a user
exports.submitRating = async (req, res) => {
  try {
    const { userId, rating, comment, interactionType, interactionId } = req.body;
    const ratedBy = req.user.id;

    // Validate input
    if (!userId || !rating) {
      return res.status(400).json({
        success: false,
        message: 'User ID and rating are required'
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    if (userId === ratedBy) {
      return res.status(400).json({
        success: false,
        message: 'You cannot rate yourself'
      });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Create or update rating
    const ratingData = {
      user: userId,
      ratedBy,
      rating,
      comment: comment || '',
      interactionType: interactionType || 'call',
      interactionId: interactionId || null
    };

    const newRating = await Rating.create(ratingData);

    // Update user stats
    await updateUserStats(userId, 'rating', rating);

    res.status(201).json({
      success: true,
      message: 'Rating submitted successfully',
      rating: newRating
    });
  } catch (error) {
    console.error('Submit rating error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Submit feedback for a user
exports.submitFeedback = async (req, res) => {
  try {
    const { userId, feedbackType, message, interactionType, interactionId } = req.body;
    const feedbackBy = req.user._id || req.user.id;

    console.log('Submit feedback request:', { userId, feedbackType, interactionType, interactionId, feedbackBy });

    // Validate input
    if (!userId || !feedbackType) {
      return res.status(400).json({
        success: false,
        message: 'User ID and feedback type are required'
      });
    }

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      console.log('Invalid userId format:', userId);
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    if (!['positive', 'negative'].includes(feedbackType)) {
      return res.status(400).json({
        success: false,
        message: 'Feedback type must be positive or negative'
      });
    }

    if (userId === feedbackBy.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot give feedback to yourself'
      });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Create feedback
    const feedbackData = {
      user: userId,
      feedbackBy,
      feedbackType,
      message: message || '',
      interactionType: interactionType || 'call',
      interactionId: interactionId || null
    };

    const newFeedback = await Feedback.create(feedbackData);

    // Update user stats
    await updateUserStats(userId, 'feedback', feedbackType);

    res.status(201).json({
      success: true,
      message: 'Feedback submitted successfully',
      feedback: newFeedback
    });
  } catch (error) {
    console.error('Submit feedback error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Submit compliment for a user
exports.submitCompliment = async (req, res) => {
  try {
    const { userId, complimentType, interactionType, interactionId } = req.body;
    const complimentBy = req.user._id || req.user.id;

    console.log('Submit compliment request:', { userId, complimentType, interactionType, interactionId, complimentBy });

    // Validate input
    if (!userId || !complimentType) {
      return res.status(400).json({
        success: false,
        message: 'User ID and compliment type are required'
      });
    }

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      console.log('Invalid userId format:', userId);
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    if (userId === complimentBy.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot give compliments to yourself'
      });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Create compliment
    const complimentData = {
      user: userId,
      complimentBy,
      complimentType,
      interactionType: interactionType || 'call',
      interactionId: interactionId || null
    };

    const newCompliment = await Compliment.create(complimentData);

    console.log('Compliment created successfully:', newCompliment);

    res.status(201).json({
      success: true,
      message: 'Compliment submitted successfully',
      compliment: newCompliment
    });
  } catch (error) {
    console.error('Submit compliment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Submit advice for a user
exports.submitAdvice = async (req, res) => {
  try {
    const { userId, adviceType, interactionType, interactionId } = req.body;
    const adviceBy = req.user._id || req.user.id;

    console.log('Submit advice request:', { userId, adviceType, interactionType, interactionId, adviceBy });

    // Validate input
    if (!userId || !adviceType) {
      return res.status(400).json({
        success: false,
        message: 'User ID and advice type are required'
      });
    }

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      console.log('Invalid userId format:', userId);
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    if (userId === adviceBy.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot give advice to yourself'
      });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Create advice
    const adviceData = {
      user: userId,
      adviceBy,
      adviceType,
      interactionType: interactionType || 'call',
      interactionId: interactionId || null
    };

    const newAdvice = await Advice.create(adviceData);

    console.log('Advice created successfully:', newAdvice);

    res.status(201).json({
      success: true,
      message: 'Advice submitted successfully',
      advice: newAdvice
    });
  } catch (error) {
    console.error('Submit advice error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Get user's ratings and feedback summary
exports.getUserRatingSummary = async (req, res) => {
  try {
    const { userId } = req.params;

    console.log('Getting rating summary for userId:', userId);
    console.log('Is valid ObjectId?', mongoose.Types.ObjectId.isValid(userId));

    // Get or create user stats
    let userStats = await UserStats.findOneAndUpdate(
      { user: userId },
      {},
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log('User stats found/created:', userStats);

    // Get recent ratings
    const recentRatings = await Rating.find({ user: userId })
      .populate('ratedBy', 'name profilePic')
      .sort({ createdAt: -1 })
      .limit(5);

    // Get recent feedback
    const recentFeedback = await Feedback.find({ 
      user: userId, 
      isPublic: true 
    })
      .populate('feedbackBy', 'name profilePic')
      .sort({ createdAt: -1 })
      .limit(10);

    // Define all possible compliment types
    const allComplimentTypes = [
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
    ];

    // Define all possible advice types
    const allAdviceTypes = [
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
    ];

    // First, let's check what compliments exist for this user
    const totalCompliments = await Compliment.countDocuments({ user: userId });
    const totalAdvice = await Advice.countDocuments({ user: userId });
    
    console.log('Total compliments in DB for this user:', totalCompliments);
    console.log('Total advice in DB for this user:', totalAdvice);

    // Get a sample compliment to see the data structure
    const sampleCompliment = await Compliment.findOne({ user: userId });
    const sampleAdvice = await Advice.findOne({ user: userId });
    
    console.log('Sample compliment:', sampleCompliment);
    console.log('Sample advice:', sampleAdvice);

    // Get compliments with counts - convert userId to ObjectId
    const userObjectId = mongoose.Types.ObjectId.isValid(userId) 
      ? new mongoose.Types.ObjectId(userId) 
      : userId;
    
    const complimentsAggregation = await Compliment.aggregate([
      { $match: { user: userObjectId } },
      { $group: { _id: '$complimentType', count: { $sum: 1 } } }
    ]);

    console.log('Compliments aggregation result:', complimentsAggregation);

    // Get advice with counts
    const adviceAggregation = await Advice.aggregate([
      { $match: { user: userObjectId } },
      { $group: { _id: '$adviceType', count: { $sum: 1 } } }
    ]);

    console.log('Advice aggregation result:', adviceAggregation);

    // Create maps for quick lookup
    const complimentsMap = {};
    complimentsAggregation.forEach(item => {
      complimentsMap[item._id] = item.count;
    });

    const adviceMap = {};
    adviceAggregation.forEach(item => {
      adviceMap[item._id] = item.count;
    });

    // Create complete lists with all options and their counts
    const completeCompliments = allComplimentTypes.map(type => ({
      _id: type,
      count: complimentsMap[type] || 0
    })).sort((a, b) => b.count - a.count);

    const completeAdvice = allAdviceTypes.map(type => ({
      _id: type,
      count: adviceMap[type] || 0
    })).sort((a, b) => b.count - a.count);

    res.status(200).json({
      success: true,
      data: {
        stats: {
          totalRatings: userStats.totalRatings,
          averageRating: userStats.averageRating,
          positiveFeedback: userStats.positiveFeedback,
          negativeFeedback: userStats.negativeFeedback,
          satisfactionPercentage: userStats.satisfactionPercentage,
          totalCalls: userStats.totalCalls,
          totalHours: userStats.totalHours,
          totalMinutes: userStats.totalMinutes
        },
        recentRatings,
        recentFeedback,
        compliments: completeCompliments,
        advice: completeAdvice
      }
    });
  } catch (error) {
    console.error('Get user rating summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Get detailed ratings for a user
exports.getUserRatings = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const ratings = await Rating.find({ user: userId })
      .populate('ratedBy', 'name profilePic')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Rating.countDocuments({ user: userId });

    res.status(200).json({
      success: true,
      data: {
        ratings,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get user ratings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Get detailed feedback for a user
exports.getUserFeedback = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const feedback = await Feedback.find({ 
      user: userId, 
      isPublic: true 
    })
      .populate('feedbackBy', 'name profilePic')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Feedback.countDocuments({ 
      user: userId, 
      isPublic: true 
    });

    res.status(200).json({
      success: true,
      data: {
        feedback,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get user feedback error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Helper function to update user stats
async function updateUserStats(userId, type, value) {
  try {
    // Get or create user stats using upsert
    let userStats = await UserStats.findOneAndUpdate(
      { user: userId },
      {},
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    if (type === 'rating') {
      userStats.updateRatingStats(value);
    } else if (type === 'feedback') {
      userStats.updateFeedbackStats(value);
    }

    await userStats.save();
  } catch (error) {
    console.error('Error updating user stats:', error);
  }
}

module.exports = exports;

const User = require('../models/User');
const UserStats = require('../models/UserStats');
const Rating = require('../models/Rating');
const Feedback = require('../models/Feedback');

// Get user profile
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password -idToken -__v');
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }
    
    // Format the response to match frontend expectations
    const profileData = {
      id: user._id,
      name: user.name,
      email: user.email,
      bio: user.bio || '',
      age: user.age,
      gender: user.gender,
      country: user.country || '',
      nativeLanguage: user.nativeLanguage || '',
      englishLevel: user.englishLevel || 'A2',
      interests: user.interests || [],
      profilePic: user.profilePic,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    };
    
    res.status(200).json({
      success: true,
      user: profileData,
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
};

// Update user profile
exports.updateProfile = async (req, res) => {
  try {
    const updates = req.body;
    
    // Validate age if provided
    if (updates.age && (updates.age < 13 || updates.age > 120)) {
      return res.status(400).json({
        success: false,
        message: 'Age must be between 13 and 120'
      });
    }
    
    // Validate English level if provided
    if (updates.englishLevel && !['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(updates.englishLevel)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid English level. Must be one of: A1, A2, B1, B2, C1, C2'
      });
    }
    
    // Validate bio length if provided
    if (updates.bio && updates.bio.length > 500) {
      return res.status(400).json({
        success: false,
        message: 'Bio must be 500 characters or less'
      });
    }
    
    // Remove sensitive fields that shouldn't be updated through this endpoint
    delete updates.password;
    delete updates.email; // Email should be updated separately
    delete updates.googleId;
    delete updates.idToken;
    delete updates._id;
    delete updates.createdAt;
    
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password -idToken -__v');
    
    if (!updatedUser) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }
    
    // Format the response
    const profileData = {
      id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      bio: updatedUser.bio || '',
      age: updatedUser.age,
      gender: updatedUser.gender,
      country: updatedUser.country || '',
      nativeLanguage: updatedUser.nativeLanguage || '',
      englishLevel: updatedUser.englishLevel || 'A2',
      interests: updatedUser.interests || [],
      profilePic: updatedUser.profilePic,
      createdAt: updatedUser.createdAt,
      lastLoginAt: updatedUser.lastLoginAt,
    };
    
    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: profileData,
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
};

// Get user statistics (for stats tab)
exports.getUserStats = async (req, res) => {
  try {
    const CallHistory = require('../models/CallHistory');
    const mongoose = require('mongoose');
    
    // Get or create user stats
    let userStats = await UserStats.findOne({ user: req.user.id });
    if (!userStats) {
      userStats = await UserStats.create({ user: req.user.id });
    }
    
    // Convert user ID to ObjectId for aggregation query
    const userObjectId = new mongoose.Types.ObjectId(req.user.id);
    
    // Get user's call statistics
    const callStats = await CallHistory.aggregate([
      {
        $match: {
          $or: [
            { caller: userObjectId },
            { receiver: userObjectId }
          ],
          status: 'answered'
        }
      },
      {
        $group: {
          _id: null,
          totalCalls: { $sum: 1 },
          totalDuration: { $sum: '$duration' },
          averageCallDuration: { $avg: '$duration' }
        }
      }
    ]);
    
    // Get recent activity (last 10 calls)
    const recentActivity = await CallHistory.find({
      $or: [
        { caller: userObjectId },
        { receiver: userObjectId }
      ],
      status: 'answered'
    })
    .populate('caller', 'name')
    .populate('receiver', 'name')
    .sort({ createdAt: -1 })
    .limit(10)
    .select('caller receiver duration createdAt');
    
    // Format recent activity
    const formattedActivity = recentActivity.map(call => {
      const isCaller = call.caller._id.toString() === req.user.id;
      const otherUser = isCaller ? call.receiver : call.caller;
      const duration = Math.floor(call.duration / 60); // Convert to minutes
      
      return {
        text: `Talked with ${otherUser.name} for ${duration} minutes`,
        time: new Date(call.createdAt).toLocaleDateString(),
        timestamp: call.createdAt
      };
    });
    
    const stats = callStats[0] || { totalCalls: 0, totalDuration: 0, averageCallDuration: 0 };
    
    // Update user stats with latest call data
    userStats.totalCalls = stats.totalCalls;
    userStats.totalMinutes = Math.floor(stats.totalDuration / 60);
    userStats.totalHours = Math.floor(stats.totalDuration / 3600);
    userStats.totalPoints = Math.floor(stats.totalDuration / 60) * 10; // 10 points per minute
    await userStats.save();
    
    res.status(200).json({
      success: true,
      stats: {
        totalCalls: stats.totalCalls,
        totalMinutes: Math.floor(stats.totalDuration / 60),
        totalHours: Math.floor(stats.totalDuration / 3600),
        averageCallDuration: Math.floor(stats.averageCallDuration || 0),
        points: Math.floor(stats.totalDuration / 60) * 10,
        streak: userStats.currentStreak,
        recentActivity: formattedActivity,
        // Rating and feedback stats
        totalRatings: userStats.totalRatings,
        averageRating: userStats.averageRating,
        positiveFeedback: userStats.positiveFeedback,
        negativeFeedback: userStats.negativeFeedback,
        satisfactionPercentage: userStats.satisfactionPercentage
      }
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
};

// Get available options for dropdowns
exports.getProfileOptions = async (req, res) => {
  try {
    const options = {
      englishLevels: [
        { value: 'A1', label: 'A1 (Beginner)' },
        { value: 'A2', label: 'A2 (Elementary)' },
        { value: 'B1', label: 'B1 (Intermediate)' },
        { value: 'B2', label: 'B2 (Upper Intermediate)' },
        { value: 'C1', label: 'C1 (Advanced)' },
        { value: 'C2', label: 'C2 (Proficient)' }
      ],
      nativeLanguages: [
        'Arabic', 'Bengali', 'Chinese (Mandarin)', 'English', 'French', 
        'German', 'Hindi', 'Italian', 'Japanese', 'Korean', 'Portuguese', 
        'Russian', 'Spanish', 'Turkish', 'Other'
      ],
      countries: [
        'Afghanistan', 'Albania', 'Algeria', 'Argentina', 'Armenia', 
        'Australia', 'Austria', 'Bangladesh', 'Belgium', 'Brazil', 
        'Bulgaria', 'Canada', 'Chile', 'China', 'Colombia', 'Croatia', 
        'Czech Republic', 'Denmark', 'Egypt', 'Finland', 'France', 
        'Germany', 'Greece', 'Hungary', 'Iceland', 'India', 'Indonesia', 
        'Ireland', 'Israel', 'Italy', 'Japan', 'Kenya', 'Malaysia', 
        'Mexico', 'Netherlands', 'New Zealand', 'Nigeria', 'Norway', 
        'Pakistan', 'Philippines', 'Poland', 'Portugal', 'Romania', 
        'Russia', 'Saudi Arabia', 'Singapore', 'South Africa', 'South Korea', 
        'Spain', 'Sweden', 'Switzerland', 'Thailand', 'Turkey', 'Ukraine', 
        'United Arab Emirates', 'United Kingdom', 'United States', 'Vietnam'
      ],
      interests: [
        'Art & Design', 'Books & Literature', 'Business & Finance', 
        'Cooking & Food', 'Dancing', 'Education', 'Fashion & Beauty', 
        'Fitness & Sports', 'Gaming', 'Health & Wellness', 'Languages', 
        'Movies & TV', 'Music', 'Nature & Environment', 'Photography', 
        'Politics', 'Science & Technology', 'Travel', 'Writing', 'Programming',
        'Web Development', 'App Development', 'Reading Books'
      ],
      genders: [
        'Male', 'Female', 'Other', 'Prefer not to say'
      ]
    };
    
    res.status(200).json({
      success: true,
      options
    });
  } catch (error) {
    console.error('Get profile options error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
};

module.exports = exports;

const User = require('../models/User');
const UserStats = require('../models/UserStats');
const Rating = require('../models/Rating');
const Feedback = require('../models/Feedback');
const imagekitService = require('../utils/imagekit');

const formatUserProfile = (user) => ({
  id: user._id,
  _id: user._id,
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
  profilePicFileId: user.profilePicFileId || null,
  profilePicThumbnail: user.profilePicThumbnail || null,
  createdAt: user.createdAt,
  lastLoginAt: user.lastLoginAt,
  googleId: user.googleId,
  preferredLanguage: user.preferredLanguage || 'en',
  notificationsEnabled: user.notificationsEnabled !== false,
});

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
    const profileData = formatUserProfile(user);

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
    delete updates.profilePicFileId;
    delete updates.profilePicThumbnail;
    
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
    const profileData = formatUserProfile(updatedUser);
    
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

// Get ImageKit authentication parameters for client-side uploads
exports.getImageKitAuth = async (req, res) => {
  try {
    const client = imagekitService.getClient();
    const authParams = client.getAuthenticationParameters();

    res.status(200).json({
      success: true,
      token: authParams.token,
      signature: authParams.signature,
      expire: authParams.expire,
      publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
      urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
      folder: imagekitService.getConfiguredFolder(),
    });
  } catch (error) {
    console.error('Get ImageKit auth error:', error);
    res.status(500).json({
      success: false,
      message:
        error.message.includes('ImageKit is not configured')
          ? 'Image upload service is not configured on the server.'
          : 'Failed to generate ImageKit authentication parameters.',
      error: error.message,
    });
  }
};

// Update profile picture metadata after successful ImageKit upload
exports.updateProfilePicture = async (req, res) => {
  try {
    const { fileId, url, thumbnailUrl } = req.body;

    if (!fileId || !url) {
      return res.status(400).json({
        success: false,
        message: 'Both fileId and url are required to update profile picture.',
      });
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const previousFileId =
      user.profilePicFileId && user.profilePicFileId !== fileId
        ? user.profilePicFileId
        : null;

    user.profilePic = url;
    user.profilePicFileId = fileId;
    user.profilePicThumbnail = thumbnailUrl || null;

    await user.save();

    if (previousFileId) {
      try {
        const client = imagekitService.getClient();
        await client.deleteFile(previousFileId);
      } catch (cleanupError) {
        console.warn(
          `Failed to delete previous ImageKit file (${previousFileId}):`,
          cleanupError.message
        );
      }
    }

    res.status(200).json({
      success: true,
      message: 'Profile picture updated successfully',
      user: formatUserProfile(user),
    });
  } catch (error) {
    console.error('Update profile picture error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile picture',
      error: error.message,
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
    
    // Store previous stats for achievement checking
    const previousStats = {
      totalCalls: userStats.totalCalls,
      totalMinutes: userStats.totalMinutes,
      totalHours: userStats.totalHours,
      totalPoints: userStats.totalPoints
    };

    // Update user stats with latest call data
    userStats.totalCalls = stats.totalCalls;
    userStats.totalMinutes = Math.floor(stats.totalDuration / 60);
    userStats.totalHours = Math.floor(stats.totalDuration / 3600);
    userStats.totalPoints = Math.floor(stats.totalDuration / 60) * 10; // 10 points per minute
    await userStats.save();

    // Check for call-based achievements
    await checkCallAchievements(req.user.id, userStats, previousStats);
    
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

// Helper function to check and notify about call achievements
async function checkCallAchievements(userId, currentStats, previousStats) {
  try {
    const pushNotificationService = require('../utils/pushNotificationService');
    
    // Achievement thresholds
    const achievements = [];
    
    // Call milestones
    if (currentStats.totalCalls >= 5 && previousStats.totalCalls < 5) {
      achievements.push({
        type: 'call_milestone',
        title: '📞 First Steps!',
        message: 'You completed 5 practice calls!'
      });
    }
    
    if (currentStats.totalCalls >= 25 && previousStats.totalCalls < 25) {
      achievements.push({
        type: 'call_milestone',
        title: '🗣️ Conversation Pro!',
        message: 'Amazing! You completed 25 calls!'
      });
    }
    
    if (currentStats.totalCalls >= 100 && previousStats.totalCalls < 100) {
      achievements.push({
        type: 'call_milestone',
        title: '💬 Chatmaster!',
        message: 'Incredible! 100 practice calls completed!'
      });
    }
    
    // Hour milestones
    if (currentStats.totalHours >= 5 && previousStats.totalHours < 5) {
      achievements.push({
        type: 'time_milestone',
        title: '⏱️ Dedicated Learner!',
        message: 'You practiced for 5 hours total!'
      });
    }
    
    if (currentStats.totalHours >= 25 && previousStats.totalHours < 25) {
      achievements.push({
        type: 'time_milestone',
        title: '🕐 Practice Champion!',
        message: 'Wow! 25 hours of English practice!'
      });
    }
    
    if (currentStats.totalHours >= 100 && previousStats.totalHours < 100) {
      achievements.push({
        type: 'time_milestone',
        title: '🏅 English Master!',
        message: 'Legendary! 100 hours of practice!'
      });
    }
    
    // Points milestones
    if (currentStats.totalPoints >= 1000 && previousStats.totalPoints < 1000) {
      achievements.push({
        type: 'points_milestone',
        title: '🎯 Point Collector!',
        message: 'You earned 1,000 practice points!'
      });
    }
    
    if (currentStats.totalPoints >= 5000 && previousStats.totalPoints < 5000) {
      achievements.push({
        type: 'points_milestone',
        title: '💰 Point Master!',
        message: 'Incredible! 5,000 practice points!'
      });
    }
    
    // Send achievement notifications
    for (const achievement of achievements) {
      await pushNotificationService.sendToUser(userId, {
        title: achievement.title,
        body: achievement.message,
        channelId: 'achievements',
        data: {
          type: 'achievement',
          achievementType: achievement.type,
          timestamp: new Date().toISOString()
        }
      });
      
      console.log(`🏆 Sent call achievement notification to user ${userId}: ${achievement.title}`);
    }
    
  } catch (error) {
    console.error('Error checking call achievements:', error);
  }
}

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

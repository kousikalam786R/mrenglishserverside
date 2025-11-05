const User = require('../models/User');
const Message = require('../models/Message');
const CallHistory = require('../models/CallHistory');
const Feedback = require('../models/Feedback');
const Rating = require('../models/Rating');
const Compliment = require('../models/Compliment');
const Advice = require('../models/Advice');
const UserStats = require('../models/UserStats');
const jwt = require('jsonwebtoken');
const { getReadyToTalkUsers, isUserReadyToTalk } = require('../utils/onlineUsers');
const emailService = require('../utils/emailService');

// Google Sign In/Sign Up
exports.googleAuth = async (req, res) => {
  try {
    console.log('Google auth endpoint hit');
    console.log('Request headers:', req.headers);
    console.log('Request body:', {
      idTokenReceived: !!req.body.idToken,
      userData: req.body.userData
    });
    
    const { idToken, userData } = req.body;
    
    if (!idToken || !userData) {
      console.log('Invalid request data - missing idToken or userData');
      return res.status(400).json({ message: 'Invalid request data' });
    }

    const { email, name, id: googleId, photo: profilePic } = userData;
    console.log('Processing auth for user:', { email, name, googleId: !!googleId });

    // Check if user already exists
    let user = await User.findOne({ email: email });

    if (user) {
      // Update existing user
      user.lastLoginAt = new Date();
      user.idToken = idToken;
      
      // Update other fields if they've changed
      if (user.name !== name) user.name = name;
      if (user.googleId !== googleId) user.googleId = googleId;
      if (user.profilePic !== profilePic) user.profilePic = profilePic;
      
      await user.save();
    } else {
      // Create new user
      user = await User.create({
        email,
        name,
        googleId,
        profilePic,
        idToken,
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profilePic: user.profilePic,
      },
    });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get current user
exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-idToken -__v');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(301).json({ message: 'Server error', error: error.message });
  }
};

// Update current user
exports.updateCurrentUser = async (req, res) => {
  try {
    const updates = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-idToken -__v');

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({
      success: true,
      user: updatedUser,
    });
  } catch (error) {
    console.error('Update current user error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Change password for authenticated user
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body || {};

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide current password, new password, and confirmation.'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters long.'
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password and confirmation do not match.'
      });
    }

    const user = await User.findById(req.user.id).select('+password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (!user.password) {
      return res.status(400).json({
        success: false,
        message: 'Password change is not available for accounts created with Google sign-in.'
      });
    }

    const isMatch = await user.matchPassword(currentPassword);

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
    }

    user.password = newPassword;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Password updated successfully.'
    });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to update password. Please try again later.',
      error: error.message,
    });
  }
};

// Delete account for authenticated user
exports.deleteAccount = async (req, res) => {
  try {
    const { password } = req.body || {};

    if (!password) {
      return res.status(400).json({ success: false, message: 'Password is required to delete your account.' });
    }

    const user = await User.findById(req.user.id).select('+password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (!user.password) {
      return res.status(400).json({
        success: false,
        message: 'Password verification is required. Please set a password before deleting your account or contact support.'
      });
    }

    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Password is incorrect.' });
    }

    const userId = user._id;

    await Promise.all([
      Message.deleteMany({ $or: [{ sender: userId }, { receiver: userId }] }).catch(() => {}),
      CallHistory.deleteMany({ $or: [{ caller: userId }, { receiver: userId }, { endedBy: userId }] }).catch(() => {}),
      Feedback.deleteMany({ $or: [{ user: userId }, { feedbackBy: userId }] }).catch(() => {}),
      Rating.deleteMany({ $or: [{ user: userId }, { ratedBy: userId }] }).catch(() => {}),
      Compliment.deleteMany({ $or: [{ user: userId }, { complimentBy: userId }] }).catch(() => {}),
      Advice.deleteMany({ $or: [{ user: userId }, { adviceBy: userId }] }).catch(() => {}),
      UserStats.deleteOne({ user: userId }).catch(() => {}),
      user.deleteOne(),
    ]);

    return res.status(200).json({
      success: true,
      message: 'Your account has been deleted successfully.'
    });
  } catch (error) {
    console.error('Delete account error:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to delete account at this time. Please try again later.',
      error: error.message,
    });
  }
};

// Request account deletion via email (for Google/Firebase users)
exports.requestAccountDeletion = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (!user.email) {
      return res.status(400).json({
        success: false,
        message: 'No email address found for this account.',
      });
    }

    // Generate a secure token for account deletion (expires in 24 hours)
    const deletionToken = jwt.sign(
      { userId: user._id.toString(), purpose: 'delete-account' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Send deletion confirmation email
    try {
      await emailService.sendDeletionEmail(
        user.email,
        user.name,
        deletionToken
      );

      return res.status(200).json({
        success: true,
        message: 'A confirmation email has been sent to your email address. Please check your inbox and click the link to delete your account.',
      });
    } catch (emailError) {
      console.error('Error sending deletion email:', emailError);
      return res.status(500).json({
        success: false,
        message: 'Failed to send confirmation email. Please try again later or contact support.',
        error: emailError.message,
      });
    }
  } catch (error) {
    console.error('Request account deletion error:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to process deletion request. Please try again later.',
      error: error.message,
    });
  }
};

// Confirm account deletion via token (from email link)
exports.confirmAccountDeletion = async (req, res) => {
  try {
    const { token } = req.query || req.body || {};

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Deletion token is required.',
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(400).json({
          success: false,
          message: 'The deletion link has expired. Please request a new deletion link.',
        });
      }
      return res.status(400).json({
        success: false,
        message: 'Invalid deletion token.',
      });
    }

    // Verify token purpose
    if (decoded.purpose !== 'delete-account') {
      return res.status(400).json({
        success: false,
        message: 'Invalid token type.',
      });
    }

    const userId = decoded.userId;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found. Account may have already been deleted.',
      });
    }

    // Perform the same deletion cleanup as the password-based deletion
    await Promise.all([
      Message.deleteMany({ $or: [{ sender: userId }, { receiver: userId }] }).catch(() => {}),
      CallHistory.deleteMany({ $or: [{ caller: userId }, { receiver: userId }, { endedBy: userId }] }).catch(() => {}),
      Feedback.deleteMany({ $or: [{ user: userId }, { feedbackBy: userId }] }).catch(() => {}),
      Rating.deleteMany({ $or: [{ user: userId }, { ratedBy: userId }] }).catch(() => {}),
      Compliment.deleteMany({ $or: [{ user: userId }, { complimentBy: userId }] }).catch(() => {}),
      Advice.deleteMany({ $or: [{ user: userId }, { adviceBy: userId }] }).catch(() => {}),
      UserStats.deleteOne({ user: userId }).catch(() => {}),
    ]);

    // Save user email and name before deletion for confirmation email
    const userEmail = user.email;
    const userName = user.name;

    // Delete user
    await user.deleteOne();

    // Send confirmation email
    emailService.sendDeletionConfirmationEmail(userEmail, userName).catch(() => {
      // Don't fail if email fails
    });

    // If request is from browser (email link), return HTML page
    if (req.headers.accept && req.headers.accept.includes('text/html')) {
      return res.status(200).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Account Deleted - MrEnglish</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              padding: 20px;
            }
            .container {
              background: white;
              border-radius: 16px;
              padding: 40px;
              max-width: 500px;
              text-align: center;
              box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            }
            .icon {
              font-size: 64px;
              margin-bottom: 20px;
            }
            h1 {
              color: #2C2C47;
              margin-bottom: 16px;
            }
            p {
              color: #666;
              line-height: 1.6;
              margin-bottom: 12px;
            }
            .app-link {
              display: inline-block;
              margin-top: 24px;
              padding: 12px 24px;
              background: #4A90E2;
              color: white;
              text-decoration: none;
              border-radius: 8px;
              font-weight: 600;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">✅</div>
            <h1>Account Deleted</h1>
            <p>Your MrEnglish account has been successfully deleted.</p>
            <p>All your data has been permanently removed from our system.</p>
            <p style="margin-top: 24px; font-size: 14px; color: #999;">
              If you have the app installed, you can close this page and sign in again to create a new account.
            </p>
          </div>
        </body>
        </html>
      `);
    }

    // Otherwise return JSON response
    return res.status(200).json({
      success: true,
      message: 'Your account has been deleted successfully.',
    });
  } catch (error) {
    console.error('Confirm account deletion error:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to delete account at this time. Please try again later.',
      error: error.message,
    });
  }
};

// Get all users
exports.getAllUsers = async (req, res) => {
  try {
    // Include blockedUsers field to check if they've blocked the current user
    const users = await User.find({}).select('-idToken -__v blockedUsers');
    
    if (!users || users.length === 0) {
      return res.status(404).json({ message: 'No users found' });
    }
    
    // Get current user's blocked users list
    const currentUser = await User.findById(req.user.id).select('blockedUsers').lean();
    const currentUserBlockedIds = currentUser?.blockedUsers ? currentUser.blockedUsers.map((id: any) => id.toString()) : [];
    
    // Filter out the current user and blocked users
    const filteredUsers = users.filter(user => {
      const userId = user._id.toString();
      
      // Don't show current user
      if (userId === req.user.id.toString()) {
        return false;
      }
      
      // Don't show users that current user has blocked
      if (currentUserBlockedIds.includes(userId)) {
        return false;
      }
      
      // Don't show users who have blocked the current user
      // Check if current user is in this user's blockedUsers list
      if (user.blockedUsers && user.blockedUsers.length > 0) {
        const userBlockedIds = user.blockedUsers.map((id: any) => id.toString());
        if (userBlockedIds.includes(req.user.id.toString())) {
          return false;
        }
      }
      
      return true;
    });
    
    // Remove blockedUsers from response for privacy
    const usersResponse = filteredUsers.map(user => {
      const userObject = user.toObject();
      delete userObject.blockedUsers;
      return userObject;
    });
    
    res.status(200).json(usersResponse);
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get user by ID
exports.getUserById = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user?.id || req.user?.userId; // Handle both auth middleware formats
    
    // Validate MongoDB ObjectID format
    if (!userId || userId.length !== 24) {
      return res.status(400).json({ message: 'Invalid user ID format' });
    }
    
    // Check if trying to view own profile
    if (currentUserId && userId === currentUserId.toString()) {
      // Allow viewing own profile
      const user = await User.findById(userId).select('-idToken -__v');
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      return res.status(200).json(user);
    }
    
    // Get the profile owner to check their blocked list
    // Use lean() to get a plain JavaScript object and ensure fresh data from database
    const profileOwner = await User.findById(userId).select('blockedUsers').lean();
    
    if (!profileOwner) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if current user is blocked by profile owner
    // Return 404 (Not Found) instead of 403 to make it appear as if user doesn't exist
    if (currentUserId && profileOwner.blockedUsers && profileOwner.blockedUsers.length > 0) {
      const currentUserIdStr = currentUserId.toString();
      const isBlocked = profileOwner.blockedUsers.some(
        blockedId => {
          const blockedIdStr = blockedId.toString ? blockedId.toString() : String(blockedId);
          return blockedIdStr === currentUserIdStr;
        }
      );
      
      if (isBlocked) {
        console.log(`Profile access denied: User ${currentUserIdStr} is blocked by profile owner ${userId}`);
        return res.status(404).json({ 
          message: 'User not found',
          error: 'This user does not exist or may have been removed from the platform.',
          blocked: true
        });
      }
    }
    
    console.log(`Profile access granted: User ${currentUserId} can view profile of ${userId}`);
    
    // User is not blocked, return profile
    const user = await User.findById(userId).select('-idToken -__v -blockedUsers');
    
    res.status(200).json(user);
  } catch (error) {
    console.error('Get user by ID error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        message: 'Invalid ID format',
        details: error.message
      });
    }
    
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Manual User Sign Up
exports.signup = async (req, res) => {
  try {
    console.log('Signup endpoint hit');
    console.log('Request headers:', req.headers);
    console.log('Request body:', req.body);
    
    const { 
      name, 
      email, 
      password, 
      bio, 
      age, 
      country, 
      nativeLanguage, 
      englishLevel, 
      interests 
    } = req.body || {};
    
    // Validate required input
    if (!name || !email || !password) {
      return res.status(400).json({ 
        success: false,
        message: 'Please provide name, email and password',
        receivedData: { name, email, passwordReceived: !!password }
      });
    }
    
    // Validate age if provided
    if (age && (age < 13 || age > 120)) {
      return res.status(400).json({
        success: false,
        message: 'Age must be between 13 and 120'
      });
    }
    
    // Validate English level if provided
    if (englishLevel && !['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(englishLevel)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid English level. Must be one of: A1, A2, B1, B2, C1, C2'
      });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ 
        success: false,
        message: 'User with this email already exists' 
      });
    }
    
    // Create new user with profile data
    const user = await User.create({
      name,
      email,
      password,
      bio: bio || '',
      age: age || undefined,
      country: country || '',
      nativeLanguage: nativeLanguage || '',
      englishLevel: englishLevel || 'A2',
      interests: interests || [],
    });
    
    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
    
    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profilePic: user.profilePic,
      },
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
};

// Manual User Login
exports.login = async (req, res) => {
  try {
    console.log('Login endpoint hit');
    console.log('Request headers:', req.headers);
    console.log('Request body:', req.body);
    
    const { email, password } = req.body || {};
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ 
        success: false,
        message: 'Please provide email and password',
        receivedData: { email, passwordReceived: !!password }
      });
    }
    
    // Find user
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid credentials' 
      });
    }
    
    // Check password
    const isPasswordCorrect = await user.matchPassword(password);
    if (!isPasswordCorrect) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid credentials' 
      });
    }
    
    // Update last login
    user.lastLoginAt = new Date();
    await user.save();
    
    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
    
    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profilePic: user.profilePic,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
};

// Get all users for testing (everyone set as online)
exports.getTestUsers = async (req, res) => {
  try {
    const users = await User.find({}).select('-idToken -__v');
    
    if (!users || users.length === 0) {
      return res.status(404).json({ message: 'No users found' });
    }
    
    // Filter out the current user
    const filteredUsers = users.filter(user => user._id.toString() !== req.user.id);
    
    // Add online status to all users (for testing purposes)
    const onlineUsers = filteredUsers.map(user => ({
      ...user.toObject(),
      isOnline: true,
      level: user.level || 'Intermediate', // Add default level if not present
      country: user.country || '🌎 Global'  // Add default country if not present
    }));
    
    res.status(200).json(onlineUsers);
  } catch (error) {
    console.error('Get test users error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get only truly online users
exports.getOnlineUsers = async (req, res) => {
  try {
    console.log("Getting online users for user:", req.user.id);
    
    // Import the onlineUsers map from the server.js
    const { getOnlineUsersMap } = require('../utils/onlineUsers');
    const onlineUsersMap = getOnlineUsersMap();
    const readyToTalkUsers = getReadyToTalkUsers();
    
    // Log who's currently online
    console.log("Current online users from map:", Array.from(onlineUsersMap.keys()));
    console.log("Current ready-to-talk users:", Array.from(readyToTalkUsers.keys()));
    
    // Get all online user IDs
    const onlineUserIds = Array.from(onlineUsersMap.keys());
    
    // Find all users that are currently online
    // Include blockedUsers field to check if they've blocked the current user
    const users = await User.find({
      _id: { $in: onlineUserIds }
    }).select('-idToken -__v blockedUsers');
    
    console.log(`Found ${users?.length || 0} online users in database`);
    
    if (!users || users.length === 0) {
      return res.status(200).json([]); // Return empty array if no one is online
    }
    
    // Get current user's blocked users list
    const currentUser = await User.findById(req.user.id).select('blockedUsers').lean();
    const currentUserBlockedIds = currentUser?.blockedUsers ? currentUser.blockedUsers.map((id: any) => id.toString()) : [];
    
    // Filter out the current user and blocked users
    const filteredUsers = users.filter(user => {
      const userId = user._id.toString();
      
      // Don't show current user
      if (userId === req.user.id) {
        return false;
      }
      
      // Don't show users that current user has blocked
      if (currentUserBlockedIds.includes(userId)) {
        return false;
      }
      
      // Don't show users who have blocked the current user
      // Check if current user is in this user's blockedUsers list
      if (user.blockedUsers && user.blockedUsers.length > 0) {
        const userBlockedIds = user.blockedUsers.map((id: any) => id.toString());
        if (userBlockedIds.includes(req.user.id.toString())) {
          return false;
        }
      }
      
      return true;
    });
    
    console.log(`Returning ${filteredUsers.length} online users (after filtering blocked users)`);
    
    // Add online status and readyToTalk status to all users
    const onlineUsers = filteredUsers.map(user => {
      const userId = user._id.toString();
      const isReady = isUserReadyToTalk(userId);
      const readyData = isReady ? readyToTalkUsers.get(userId) : null;
      
      const userObject = user.toObject();
      // Remove blockedUsers from response for privacy
      delete userObject.blockedUsers;
      
      return {
        ...userObject,
        isOnline: true,
        readyToTalk: isReady,
        readyData: readyData || null,
        level: user.level || readyData?.level || 'Intermediate', // Add default level if not present
        country: user.country || '🌎 Global'  // Add default country if not present
      };
    });
    
    res.status(200).json(onlineUsers);
  } catch (error) {
    console.error('Get online users error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Debug endpoint to check which users are currently online
// Block/Unblock user
exports.blockUser = async (req, res) => {
  try {
    const currentUserId = req.user?.id || req.user?.userId;
    const { userId } = req.params;
    const { block } = req.body; // true to block, false to unblock
    
    if (!currentUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    // Validate MongoDB ObjectID format
    if (!userId || userId.length !== 24) {
      return res.status(400).json({ message: 'Invalid user ID format' });
    }
    
    // Cannot block yourself
    if (currentUserId.toString() === userId) {
      return res.status(400).json({ message: 'Cannot block yourself' });
    }
    
    const currentUser = await User.findById(currentUserId);
    if (!currentUser) {
      return res.status(404).json({ message: 'Current user not found' });
    }
    
    // Initialize blockedUsers array if it doesn't exist
    if (!currentUser.blockedUsers) {
      currentUser.blockedUsers = [];
    }
    
    if (block) {
      // Block user - add to blocked list if not already blocked
      if (!currentUser.blockedUsers.includes(userId)) {
        currentUser.blockedUsers.push(userId);
        await currentUser.save();
      }
      res.status(200).json({ 
        success: true, 
        message: 'User blocked successfully',
        blocked: true
      });
    } else {
      // Unblock user - remove from blocked list using MongoDB $pull operator
      // This is more reliable than filter + save for array updates
      const beforeUpdate = await User.findById(currentUserId).select('blockedUsers');
      const beforeCount = beforeUpdate.blockedUsers ? beforeUpdate.blockedUsers.length : 0;
      
      // Use $pull to remove the user from the blockedUsers array
      // This ensures proper ObjectId handling and atomic update
      const updateResult = await User.findByIdAndUpdate(
        currentUserId,
        { $pull: { blockedUsers: userId } },
        { new: true, select: 'blockedUsers' }
      );
      
      const afterCount = updateResult.blockedUsers ? updateResult.blockedUsers.length : 0;
      
      // Log for debugging
      console.log(`Unblock: User ${currentUserId} unblocking ${userId}`);
      console.log(`Blocked users before: ${beforeCount}, after: ${afterCount}`);
      
      res.status(200).json({ 
        success: true, 
        message: 'User unblocked successfully',
        blocked: false,
        blockedUsersCount: afterCount
      });
    }
  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.debugOnlineUsers = async (req, res) => {
  try {
    // Import the onlineUsers map
    const { getOnlineUsersMap } = require('../utils/onlineUsers');
    const onlineUsersMap = getOnlineUsersMap();
    const readyToTalkUsers = getReadyToTalkUsers();
    
    // Get all online user IDs
    const onlineUserIds = Array.from(onlineUsersMap.keys());
    const readyUserIds = Array.from(readyToTalkUsers.keys());
    
    // Find user info for online users
    const onlineUsers = await User.find({
      _id: { $in: onlineUserIds }
    }).select('name email');
    
    // Create a response with online users info
    const response = {
      onlineUsersCount: onlineUserIds.length,
      readyToTalkCount: readyUserIds.length,
      rawOnlineUserIds: onlineUserIds,
      rawReadyUserIds: readyUserIds,
      socketToUserMapping: Array.from(onlineUsersMap).map(([userId, socketId]) => ({
        userId,
        socketId,
        isReady: readyToTalkUsers.has(userId)
      })),
      onlineUsers: onlineUsers.map(user => {
        const userId = user._id.toString();
        return {
          _id: userId,
          name: user.name,
          email: user.email,
          isReady: readyToTalkUsers.has(userId)
        };
      })
    };
    
    return res.status(200).json(response);
  } catch (error) {
    console.error('Debug online users error:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
}; 
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { getReadyToTalkUsers, isUserReadyToTalk } = require('../utils/onlineUsers');

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


// Get all users
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}).select('-idToken -__v');
    
    if (!users || users.length === 0) {
      return res.status(404).json({ message: 'No users found' });
    }
    
    // Filter out the current user
    const filteredUsers = users.filter(user => user._id.toString() !== req.user.id);
    
    res.status(200).json(filteredUsers);
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get user by ID
exports.getUserById = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Validate MongoDB ObjectID format
    if (!userId || userId.length !== 24) {
      return res.status(400).json({ message: 'Invalid user ID format' });
    }
    
    const user = await User.findById(userId).select('-idToken -__v');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
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
    
    const { name, email, password } = req.body || {};
    
    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({ 
        success: false,
        message: 'Please provide name, email and password',
        receivedData: { name, email, passwordReceived: !!password }
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
    
    // Create new user
    const user = await User.create({
      name,
      email,
      password,
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
    const users = await User.find({
      _id: { $in: onlineUserIds }
    }).select('-idToken -__v');
    
    console.log(`Found ${users?.length || 0} online users in database`);
    
    if (!users || users.length === 0) {
      return res.status(200).json([]); // Return empty array if no one is online
    }
    
    // Filter out the current user
    const filteredUsers = users.filter(user => user._id.toString() !== req.user.id);
    console.log(`Returning ${filteredUsers.length} online users (not including current user)`);
    
    // Add online status and readyToTalk status to all users
    const onlineUsers = filteredUsers.map(user => {
      const userId = user._id.toString();
      const isReady = isUserReadyToTalk(userId);
      const readyData = isReady ? readyToTalkUsers.get(userId) : null;
      
      return {
        ...user.toObject(),
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
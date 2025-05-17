const Message = require('../models/Message');
const User = require('../models/User');
const { validationResult } = require('express-validator');

// Get all messages between two users
exports.getMessages = async (req, res) => {
  try {
    const { userId } = req;
    const { receiverId } = req.params;

    // Validate that receiverId is a valid MongoDB ObjectId
    if (!receiverId || receiverId === '0' || receiverId.length !== 24) {
      return res.status(400).json({ message: 'Invalid receiver ID format' });
    }

    const messages = await Message.find({
      $or: [
        { sender: userId, receiver: receiverId },
        { sender: receiverId, receiver: userId }
      ]
    })
    .sort({ createdAt: 1 })
    .populate('sender', 'name profilePic')
    .populate('receiver', 'name profilePic');

    // Mark messages as read
    await Message.updateMany(
      { sender: receiverId, receiver: userId, read: false },
      { read: true }
    );

    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    
    // Provide more specific error messages based on error type
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        message: `Invalid ID format: ${error.value} is not a valid ObjectID`,
        details: error.message
      });
    } else if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Validation error',
        details: error.message
      });
    }
    
    res.status(500).json({ message: 'Server error', details: error.message });
  }
};

// Send a new message
exports.sendMessage = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { userId } = req;
    const { receiverId, content } = req.body;

    // Validate receiverId format
    if (!receiverId || receiverId.length !== 24) {
      return res.status(400).json({ message: 'Invalid receiver ID format' });
    }

    // Check if receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ message: 'Receiver not found' });
    }

    const newMessage = new Message({
      sender: userId,
      receiver: receiverId,
      content
    });

    await newMessage.save();

    // Populate sender and receiver info
    await newMessage.populate('sender', 'name profilePic');
    await newMessage.populate('receiver', 'name profilePic');

    res.status(201).json(newMessage);
  } catch (error) {
    console.error('Error sending message:', error);
    
    // Provide more specific error messages based on error type
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        message: `Invalid ID format: ${error.value} is not a valid ObjectID`,
        details: error.message
      });
    } else if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Validation error',
        details: error.message
      });
    }
    
    res.status(500).json({ message: 'Server error', details: error.message });
  }
};

// Get recent chats (users with whom the current user has exchanged messages)
exports.getRecentChats = async (req, res) => {
  try {
    const { userId } = req;

    // Find all unique users the current user has interacted with
    const messages = await Message.find({
      $or: [{ sender: userId }, { receiver: userId }]
    })
    .sort({ createdAt: -1 });

    // Get unique user IDs from messages
    const chatUserIds = new Set();
    messages.forEach(message => {
      if (message.sender.toString() !== userId) {
        chatUserIds.add(message.sender.toString());
      }
      if (message.receiver.toString() !== userId) {
        chatUserIds.add(message.receiver.toString());
      }
    });

    // Get user details
    const chatUsers = await User.find({
      _id: { $in: Array.from(chatUserIds) }
    }).select('name email profilePic');

    // Count unread messages
    const recentChats = await Promise.all(
      chatUsers.map(async (user) => {
        const unreadCount = await Message.countDocuments({
          sender: user._id,
          receiver: userId,
          read: false
        });

        const lastMessage = await Message.findOne({
          $or: [
            { sender: userId, receiver: user._id },
            { sender: user._id, receiver: userId }
          ]
        }).sort({ createdAt: -1 });

        return {
          user,
          unreadCount,
          lastMessage
        };
      })
    );

    // Sort chats by most recent message
    recentChats.sort((a, b) => 
      b.lastMessage?.createdAt - a.lastMessage?.createdAt
    );

    res.json(recentChats);
  } catch (error) {
    console.error('Error getting recent chats:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get only connected users (users you've chatted with) in a simpler format
exports.getConnectedUsers = async (req, res) => {
  try {
    const { userId } = req;
    
    // Find all messages where the current user is either sender or receiver
    const messages = await Message.find({
      $or: [{ sender: userId }, { receiver: userId }]
    });
    
    // Extract unique user IDs excluding the current user
    const connectedUserIds = new Set();
    messages.forEach(message => {
      if (message.sender.toString() !== userId) {
        connectedUserIds.add(message.sender.toString());
      }
      if (message.receiver.toString() !== userId) {
        connectedUserIds.add(message.receiver.toString());
      }
    });
    
    // Get user details for connected users
    const connectedUsers = await User.find({
      _id: { $in: Array.from(connectedUserIds) }
    }).select('name email profilePic');
    
    res.json(connectedUsers);
  } catch (error) {
    console.error('Error getting connected users:', error);
    res.status(500).json({ message: 'Server error' });
  }
}; 
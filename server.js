const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
require('dotenv').config();
const { getCurrentUser } = require('./controllers/authController');
const callController = require('./controllers/callController');
const http = require('http');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const Message = require('./models/Message');
const { setOnlineUsersMap, getReadyToTalkUsers, setUserReadyToTalk, clearUserReadyToTalk, getUserSocketId } = require('./utils/onlineUsers');
const matchingQueue = require('./utils/partnerMatchingQueue');
const aiRoutes = require('./routes/aiRoutes');
const aiService = require('./utils/aiService');
const pushNotificationService = require('./utils/pushNotificationService');
const dailyReminderService = require('./utils/dailyReminderService');

// Connect to database
connectDB();

// Initialize Push Notification Service
pushNotificationService.initialize();

// Start Daily Reminder Service
dailyReminderService.start();

const app = express();
const server = http.createServer(app);

// Socket.io setup
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'auth'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000
});

// Online users map to track socket connections
const onlineUsers = new Map();
// Export the onlineUsers map to the utility module
setOnlineUsersMap(onlineUsers);

// Helper function to get a user's socket by userId
const getUserSocket = (userId) => {
  const socketId = onlineUsers.get(userId.toString());
  if (socketId) {
    return io.sockets.sockets.get(socketId);
  }
  return null;
};

// Broadcast ready to talk status to all clients
const broadcastReadyToTalkStatus = (userId, isReady, userData = {}) => {
  io.emit('user-ready-status', {
    userId,
    isReady,
    userData
  });
};

// Socket.io middleware for authentication
io.use(async (socket, next) => {
  try {
    // Get token from auth object or headers
    const token = socket.handshake.auth.token || 
                  socket.handshake.headers.authorization?.replace('Bearer ', '');
    
    console.log('Socket connection attempt with token:', token ? token.substring(0, 15) + '...' : 'No token');
    
    if (token) {
      try {
        // Verify the token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('Token decoded successfully, UserID:', decoded.id);
        
        // Get user from database
        const user = await User.findById(decoded.id);
        
        if (!user) {
          console.log('User not found in database');
          return next(new Error('Authentication error: User not found'));
        }
        
        // Set user data on socket
        socket.userId = user._id.toString(); // Ensure it's a string
        socket.user = user;
        console.log('User authenticated, socket ID:', socket.id, 'User ID:', socket.userId, 'Name:', user.name);
        
        // Check if this user is already connected with a different socket
        const existingSocketId = onlineUsers.get(socket.userId);
        if (existingSocketId) {
          console.log(`User ${socket.userId} already connected with socket ${existingSocketId}, updating to new socket ${socket.id}`);
        }
        
        next();
      } catch (jwtError) {
        console.error('JWT verification error:', jwtError.message);
        next(new Error('Authentication error: Invalid token'));
      }
    } else {
      console.log('No authentication token provided');
      next(new Error('Authentication error: No token provided'));
    }
  } catch (error) {
    console.error('Socket authentication error:', error);
    next(new Error('Authentication error: ' + error.message));
  }
});

// Socket.io connection handling
io.on('connection', async (socket) => {
  console.log(`User connected: ${socket.userId} with socket ID: ${socket.id}`);
  
  // Add user to online users map
  if (socket.userId) {
    onlineUsers.set(socket.userId.toString(), socket.id);
    console.log(`Added user ${socket.userId} to online users map. Total online: ${onlineUsers.size}`);
    console.log('Current online users:', Array.from(onlineUsers.keys()));
  
    // Update user's online status and lastSeenAt in database
    try {
      await User.findByIdAndUpdate(socket.userId, {
        isOnline: true,
        lastSeenAt: new Date(),
        lastLoginAt: new Date()
      });
      console.log(`✅ Updated user ${socket.userId} online status in database`);
    } catch (error) {
      console.error(`❌ Error updating user online status:`, error);
    }
  
    // Broadcast online status to all connected clients
    io.emit('user-status', {
      userId: socket.userId,
      status: 'online',
      lastSeen: new Date()
    });

    // Update user activity for daily reminders
    dailyReminderService.updateUserActivity(socket.userId);
  } else {
    console.warn('Socket connected without userId');
  }
  
  // WebRTC Call Signaling - Call Offer
  socket.on('call-offer', async (data) => {
    try {
      const { targetUserId, sdp, type, isVideo, renegotiation, isPartnerMatching } = data;
      
      // Check if this is a renegotiation or a new call
      if (renegotiation) {
        console.log(`Renegotiation offer from ${socket.userId} to ${targetUserId}`, isVideo ? '(adding video)' : '');
        
        // Get target user socket
        const targetSocket = getUserSocket(targetUserId);
        
        if (targetSocket) {
          // Forward renegotiation offer to target user
          targetSocket.emit('call-offer', {
            callerId: socket.userId,
            callerName: socket.user.name,
            sdp,
            type,
            isVideo,
            renegotiation: true
          });
          
          // Notify caller that the renegotiation offer was sent
          socket.emit('call-offer-sent', { 
            success: true, 
            targetUserId,
            renegotiation: true
          });
        } else {
          // Target user is offline
          socket.emit('call-offer-sent', { 
            success: false, 
            error: 'User is offline',
            targetUserId,
            renegotiation: true
          });
        }
        return;
      }
      
      // Original code for new calls
      console.log(`Call offer from ${socket.userId} to ${targetUserId}`, isVideo ? '(video)' : '(audio)', isPartnerMatching ? '(partner matching)' : '(regular)');
      
      // Record call attempt in database
      const callHistory = await callController.recordCallAttempt(socket.userId, targetUserId, isVideo);
      
      // Get target user socket
      const targetSocket = getUserSocket(targetUserId);
      
      if (targetSocket) {
        // Send call offer to target user
        targetSocket.emit('call-offer', {
          callerId: socket.userId,
          callerName: socket.user.name,
          sdp,
          type,
          isVideo,
          callHistoryId: callHistory?._id,
          isPartnerMatching: isPartnerMatching || false
        });
        
        // Notify caller that the offer was sent
        socket.emit('call-offer-sent', { 
          success: true, 
          targetUserId,
          callHistoryId: callHistory?._id
        });
        
        // Send push notification for incoming call
        await pushNotificationService.sendCallNotification(
          targetUserId,
          {
            _id: socket.userId,
            name: socket.user.name,
            profilePic: socket.user.profilePic
          },
          isVideo
        );
      } else {
        // Target user is offline - still send push notification
        socket.emit('call-offer-sent', { 
          success: false, 
          error: 'User is offline',
          targetUserId,
          callHistoryId: callHistory?._id
        });
        
        // Send push notification even if user is offline
        await pushNotificationService.sendCallNotification(
          targetUserId,
          {
            _id: socket.userId,
            name: socket.user.name,
            profilePic: socket.user.profilePic
          },
          isVideo
        );
      }
    } catch (error) {
      console.error('Error processing call offer:', error);
      socket.emit('call-offer-sent', { 
        success: false, 
        error: 'Failed to process call offer'
      });
    }
  });
  
  // WebRTC Call Signaling - Call Answer
  socket.on('call-answer', async (data) => {
    try {
      const { targetUserId, sdp, type, accepted, callHistoryId, renegotiation } = data;
      
      // Check if this is a renegotiation answer
      if (renegotiation) {
        console.log(`Renegotiation answer from ${socket.userId} to ${targetUserId}`);
        
        // Get caller socket
        const callerSocket = getUserSocket(targetUserId);
        
        if (callerSocket) {
          // Forward renegotiation answer to caller
          callerSocket.emit('call-answer', {
            responderId: socket.userId,
            responderName: socket.user.name,
            sdp,
            type,
            accepted: true,
            renegotiation: true
          });
        }
        return;
      }
      
      // Original code for regular call answers
      console.log(`Call ${accepted ? 'accepted' : 'rejected'} by ${socket.userId} for ${targetUserId}`);
      
      // Update call history in database
      if (callHistoryId) {
        if (accepted) {
          await callController.callAnswered(callHistoryId);
        } else {
          await callController.callRejected(callHistoryId);
          
          // Send missed call notification to caller when call is rejected
          await pushNotificationService.sendMissedCallNotification(
            targetUserId,
            {
              _id: socket.userId,
              name: socket.user.name,
              profilePic: socket.user.profilePic
            },
            false // Will get actual video status from call history if needed
          );
          
          console.log(`📞 Sent missed call notification to caller ${targetUserId}`);
        }
      }
      
      // Get caller socket
      const callerSocket = getUserSocket(targetUserId);
      
      if (callerSocket) {
        // Forward answer to caller
        callerSocket.emit('call-answer', {
          responderId: socket.userId,
          responderName: socket.user.name,
          sdp,
          type,
          accepted,
          callHistoryId
        });
      }
    } catch (error) {
      console.error('Error processing call answer:', error);
    }
  });
  
  // WebRTC Call Signaling - ICE Candidate
  socket.on('call-ice-candidate', (data) => {
    try {
      const { targetUserId, candidate, sdpMid, sdpMLineIndex } = data;
      
      // Get target user socket
      const targetSocket = getUserSocket(targetUserId);
      
      if (targetSocket) {
        // Forward ICE candidate
        targetSocket.emit('call-ice-candidate', {
          senderId: socket.userId,
          candidate,
          sdpMid,
          sdpMLineIndex
        });
      }
    } catch (error) {
      console.error('Error processing ICE candidate:', error);
    }
  });
  
  // WebRTC Call Signaling - End Call
  socket.on('call-end', async (data) => {
    try {
      const { targetUserId, callHistoryId, reason } = data;
      console.log(`Call ended by ${socket.userId} to ${targetUserId}, reason: ${reason || 'normal'}`);
      
      // Update call history in database
      if (callHistoryId) {
        await callController.endCall(callHistoryId, socket.userId);
        
        // If call ended due to timeout/no answer, send missed call notification
        if (reason === 'timeout' || reason === 'no_answer') {
          const CallHistory = require('./models/CallHistory');
          const callHistory = await CallHistory.findById(callHistoryId).populate('caller receiver');
          
          if (callHistory && callHistory.status === 'missed') {
            // Send missed call notification to receiver (who missed the call)
            await pushNotificationService.sendMissedCallNotification(
              callHistory.receiver._id,
              {
                _id: callHistory.caller._id,
                name: callHistory.caller.name,
                profilePic: callHistory.caller.profilePic
              },
              callHistory.isVideoCall
            );
            
            console.log(`📞 Sent missed call notification for timeout to ${callHistory.receiver._id}`);
          }
        }
      }
      
      // Get target user socket
      const targetSocket = getUserSocket(targetUserId);
      
      if (targetSocket) {
        // Notify target that call has ended
        targetSocket.emit('call-end', {
          endedBy: socket.userId,
          callHistoryId,
          reason
        });
      }
    } catch (error) {
      console.error('Error ending call:', error);
    }
  });
  
  // Handle private messages
  socket.on('private-message', async (data) => {
    try {
      const { receiverId, content } = data;
      const senderId = socket.user._id;
      
      console.log(`\n📨 MESSAGE FLOW STARTED`);
      console.log(`===============================`);
      console.log(`📤 From: ${socket.user.name} (${senderId})`);
      console.log(`📥 To: ${receiverId}`);
      console.log(`💬 Content: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`);
      
      // Basic validation
      if (!content || !receiverId) {
        console.log(`❌ Validation failed: Missing required fields`);
        socket.emit('message-sent', { 
          success: false, 
          error: 'Missing required fields' 
        });
        return;
      }
      
      // Check if receiver ID is a valid MongoDB ObjectId
      const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(receiverId);
      if (!isValidObjectId) {
        console.log(`❌ Invalid receiver ID format: ${receiverId}`);
        socket.emit('message-sent', { 
          success: false, 
          error: 'Invalid receiver ID format' 
        });
        return;
      }
      
      // Check if receiver exists
      const receiver = await User.findById(receiverId).select('name fcmToken');
      if (!receiver) {
        console.log(`❌ Receiver not found in database: ${receiverId}`);
        socket.emit('message-sent', { 
          success: false, 
          error: 'Receiver not found' 
        });
        return;
      }
      
      console.log(`👤 Receiver found: ${receiver.name}`);
      console.log(`🔑 Receiver has FCM token: ${receiver.fcmToken ? 'YES' : 'NO'}`);
      
      // Save the message to the database with enhanced status
      const newMessage = new Message({
        sender: senderId,
        receiver: receiverId,
        content,
        status: 'sent',
        sentAt: new Date(),
        read: false // Keep for backward compatibility
      });
      
      await newMessage.save();
      console.log(`💾 Message saved to database: ${newMessage._id}`);
      
      // Populate sender and receiver info
      await newMessage.populate('sender', 'name profilePic isOnline lastSeenAt');
      await newMessage.populate('receiver', 'name profilePic isOnline lastSeenAt');
      
      // Get receiver socket (if online)
      const receiverSocket = getUserSocket(receiverId);
      console.log(`🔌 Receiver online status: ${receiverSocket ? 'ONLINE' : 'OFFLINE'}`);
      
      // Update message status based on receiver online status
      if (receiverSocket) {
        // Mark as delivered since user is online
        newMessage.status = 'delivered';
        newMessage.deliveredAt = new Date();
        await newMessage.save();
        
        console.log(`📡 Sending real-time socket message to receiver...`);
        receiverSocket.emit('new-message', {
          from: socket.user,
          message: newMessage
        });
        
        // Send delivery confirmation to sender
        socket.emit('message-delivered', {
          messageId: newMessage._id,
          deliveredAt: newMessage.deliveredAt
        });
        
        console.log(`✅ Real-time message sent via socket - marked as delivered`);
      } else {
        console.log(`📤 Receiver offline - message remains as 'sent' status`);
      }
      
      // Send push notification (works even if user is offline)
      console.log(`🔔 Sending push notification to ${receiver.name}...`);
      const notificationResult = await pushNotificationService.sendMessageNotification(
        receiverId,
        {
          _id: socket.user._id,
          name: socket.user.name,
          profilePic: socket.user.profilePic
        }
      );
      
      console.log(`📊 Push notification result:`, notificationResult);
      
      // Send confirmation to sender
      socket.emit('message-sent', { 
        success: true, 
        message: newMessage
      });
      
      console.log(`✅ MESSAGE FLOW COMPLETED`);
      console.log(`===============================\n`);
      
    } catch (error) {
      console.error('❌ Error sending private message:', error);
      socket.emit('message-sent', { 
        success: false, 
        error: 'Failed to send message' 
      });
    }
  });
  
  // Enhanced typing indicators
  socket.on('typing', async (data) => {
    try {
      const { receiverId } = data;
      const receiverSocketId = onlineUsers.get(receiverId.toString());
      
      // Update user's typing status in database
      await User.findByIdAndUpdate(socket.userId, {
        isTyping: true,
        typingInChat: receiverId,
        lastSeenAt: new Date() // Update activity
      });
      
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('user-typing', {
          userId: socket.userId.toString(),
          userName: socket.user.name,
          chatId: receiverId
        });
        console.log(`⌨️  ${socket.user.name} started typing to ${receiverId}`);
      }
    } catch (error) {
      console.error('Error handling typing indicator:', error);
    }
  });
  
  socket.on('typing-stopped', async (data) => {
    try {
      const { receiverId } = data;
      const receiverSocketId = onlineUsers.get(receiverId.toString());
      
      // Update user's typing status in database
      await User.findByIdAndUpdate(socket.userId, {
        isTyping: false,
        typingInChat: null,
        lastSeenAt: new Date() // Update activity
      });
      
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('typing-stopped', {
          userId: socket.userId.toString(),
          userName: socket.user.name,
          chatId: receiverId
        });
        console.log(`⌨️  ${socket.user.name} stopped typing to ${receiverId}`);
      }
    } catch (error) {
      console.error('Error handling typing stopped:', error);
    }
  });
  
  // Handle message read receipts
  socket.on('mark-message-read', async (data) => {
    try {
      const { messageId, senderId } = data;
      
      // Update message as read
      const updatedMessage = await Message.findByIdAndUpdate(
        messageId,
        {
          status: 'read',
          read: true, // For backward compatibility
          readAt: new Date()
        },
        { new: true }
      );
      
      if (updatedMessage) {
        console.log(`✅ Message ${messageId} marked as read`);
        
        // Notify sender that message was read
        const senderSocketId = onlineUsers.get(senderId.toString());
        if (senderSocketId) {
          io.to(senderSocketId).emit('message-read', {
            messageId: messageId,
            readAt: updatedMessage.readAt,
            readBy: socket.userId
          });
        }
      }
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  });
  
  // Handle user activity updates (for last seen)
  socket.on('user-activity', async () => {
    try {
      await User.findByIdAndUpdate(socket.userId, {
        lastSeenAt: new Date(),
        isOnline: true
      });
    } catch (error) {
      console.error('Error updating user activity:', error);
    }
  });

  // Handle get user status request
  socket.on('get-user-status', async (data) => {
    try {
      const { userId } = data;
      if (!userId) return;

      console.log(`📡 User ${socket.userId} requesting status for user ${userId}`);
      
      const user = await User.findById(userId);
      if (user) {
        // Send current user status in the format expected by the client
        socket.emit('user-status', {
          userId: userId,
          status: user.isOnline ? 'online' : 'offline',
          lastSeen: user.lastSeenAt
        });
        
        console.log(`📡 Sent user status for ${userId}: ${user.isOnline ? 'online' : 'offline'}`);
      }
    } catch (error) {
      console.error('Error getting user status:', error);
    }
  });
  
  // Handle setting user as ready to talk
  socket.on('set-ready-to-talk', (data) => {
    try {
      const isReady = data?.status === true;
      console.log(`User ${socket.userId} setting ready status to: ${isReady}`);

      if (socket.userId) {
        // Get additional user data if available
        const userData = {
          name: socket.user?.name,
          profilePic: socket.user?.profilePic,
          level: data?.level || socket.user?.level,
          preferredTopics: data?.preferredTopics || []
        };

        // Update the ready to talk status
        setUserReadyToTalk(socket.userId, isReady, userData);
        
        // Broadcast to all clients
        broadcastReadyToTalkStatus(socket.userId, isReady, userData);
        
        // Send confirmation to the sender
        socket.emit('ready-status-updated', { 
          success: true, 
          isReady 
        });
        
        console.log(`Ready to talk users: ${Array.from(getReadyToTalkUsers().keys()).length}`);
      } else {
        socket.emit('ready-status-updated', { 
          success: false, 
          error: 'User not authenticated' 
        });
      }
    } catch (error) {
      console.error('Error setting ready to talk status:', error);
      socket.emit('ready-status-updated', { 
        success: false, 
        error: 'Failed to update status' 
      });
    }
  });
  
  // Handle a request to get all ready-to-talk users
  socket.on('get-ready-users', () => {
    try {
      const readyUsers = getReadyToTalkUsers();
      console.log(`Sending ${readyUsers.size} ready users to ${socket.userId}`);
      
      socket.emit('ready-users-list', {
        users: Array.from(readyUsers).map(([userId, data]) => ({
          userId,
          ...data
        }))
      });
    } catch (error) {
      console.error('Error getting ready users:', error);
      socket.emit('ready-users-list', { 
        users: [],
        error: 'Failed to get ready users' 
      });
    }
  });
  
  // Handle cancel partner search
  socket.on('cancel-partner-search', () => {
    try {
      console.log(`❌ User ${socket.userId} cancelled partner search`);
      
      // Remove from matching queue
      matchingQueue.removeFromQueue(socket.userId);
      
      // Clear ready to talk status when user cancels search
      clearUserReadyToTalk(socket.userId);
      
      // Broadcast the status change
      broadcastReadyToTalkStatus(socket.userId, false);
      
      socket.emit('partner-search-cancelled', {
        success: true
      });
      
      console.log(`✅ User ${socket.userId} no longer ready to talk`);
    } catch (error) {
      console.error('Error cancelling partner search:', error);
      socket.emit('partner-search-cancelled', {
        success: false,
        error: 'Failed to cancel search'
      });
    }
  });
  
  // Handle finding a random partner - using queue system
  socket.on('find-random-partner', async (data) => {
    try {
      const { preferences } = data || {};
      
      console.log(`🔍 User ${socket.userId} looking for partner`);
      console.log(`🔍 Socket ID: ${socket.id}, User ID: ${socket.userId}`);
      console.log(`🔍 Preferences:`, preferences);
      
      if (!socket.userId) {
        console.log(`❌ Socket not authenticated - no userId found`);
        socket.emit('partner-search-error', { error: 'Not authenticated' });
        return;
      }
      
      // Get user data
      const user = await User.findById(socket.userId).select('name profilePic englishLevel country gender');
      
      // Save preferences to user database if provided
      if (preferences && Object.keys(preferences).length > 0) {
        try {
          const updateData = {};
          if (preferences.gender) updateData['partnerPreferences.gender'] = preferences.gender;
          if (preferences.ratingMin !== undefined) updateData['partnerPreferences.ratingMin'] = preferences.ratingMin;
          if (preferences.ratingMax !== undefined) updateData['partnerPreferences.ratingMax'] = preferences.ratingMax;
          if (preferences.levelMin) updateData['partnerPreferences.levelMin'] = preferences.levelMin;
          if (preferences.levelMax) updateData['partnerPreferences.levelMax'] = preferences.levelMax;
          
          await User.findByIdAndUpdate(socket.userId, { $set: updateData });
          console.log(`✅ Saved partner preferences for user ${socket.userId}`);
        } catch (prefError) {
          console.error('Error saving preferences:', prefError);
        }
      }
      
      // Load saved preferences if not provided
      let finalPreferences = preferences || {};
      if (!preferences || Object.keys(preferences).length === 0) {
        const userWithPrefs = await User.findById(socket.userId).select('partnerPreferences');
        if (userWithPrefs && userWithPrefs.partnerPreferences) {
          finalPreferences = {
            gender: userWithPrefs.partnerPreferences.gender || 'all',
            ratingMin: userWithPrefs.partnerPreferences.ratingMin || 0,
            ratingMax: userWithPrefs.partnerPreferences.ratingMax || 100,
            levelMin: userWithPrefs.partnerPreferences.levelMin || 'A1',
            levelMax: userWithPrefs.partnerPreferences.levelMax || 'C2'
          };
          console.log(`📋 Loaded saved preferences:`, finalPreferences);
        }
      }
      
      if (!user) {
        socket.emit('random-partner-result', { 
          success: false,
          error: 'User not found'
        });
        return;
      }
      
      // ALWAYS set the current user as ready to talk when they search
      setUserReadyToTalk(socket.userId, true, {
        name: user.name,
        profilePic: user.profilePic,
        level: user.englishLevel || user.level
      });
      
      // Broadcast the current user's status to all clients
      broadcastReadyToTalkStatus(socket.userId, true, {
        name: user.name,
        profilePic: user.profilePic,
        level: user.englishLevel || user.level
      });
      
      console.log(`✅ User ${socket.userId} set as ready to talk`);
      
      // Add user to matching queue with preferences
      const match = matchingQueue.addToQueue(
        socket.userId,
        socket.id,
        {
          name: user.name,
          profilePic: user.profilePic,
          level: user.englishLevel,
          country: user.country,
          gender: user.gender,
          rating: user.rating || 0
        },
        finalPreferences
      );
      
      if (match) {
        // Match found! Notify both users
        console.log(`🎉 Match found between ${match.user1.userId} and ${match.user2.userId}`);
        
        const user1Socket = io.sockets.sockets.get(match.user1.socketId);
        const user2Socket = io.sockets.sockets.get(match.user2.socketId);
        
        // Notify user 1
        if (user1Socket) {
          console.log(`📤 Notifying user 1 (${match.user1.userId}) about match`);
          user1Socket.emit('partner-found', {
            partner: {
              _id: match.user2.userId,
              name: match.user2.userData.name,
              profilePic: match.user2.userData.profilePic,
              level: match.user2.userData.level,
              country: match.user2.userData.country,
              isOnline: true,
              readyToTalk: true
            }
          });
        }
        
        // Notify user 2
        if (user2Socket) {
          console.log(`📤 Notifying user 2 (${match.user2.userId}) about match`);
          user2Socket.emit('partner-found', {
            partner: {
              _id: match.user1.userId,
              name: match.user1.userData.name,
              profilePic: match.user1.userData.profilePic,
              level: match.user1.userData.level,
              country: match.user1.userData.country,
              isOnline: true,
              readyToTalk: true
            }
          });
        }
      } else {
        // No match yet, user added to queue
        console.log(`⏳ User ${socket.userId} added to queue, waiting for partner...`);
        
        // Notify the user they're in the queue
        socket.emit('partner-search-status', {
          success: true,
          message: 'Searching for partner...',
          queuePosition: matchingQueue.getQueueStatus().waitingUsers
        });
        
        // Send status to all clients about the queue
        io.emit('queue-status-updated', {
          waitingUsers: matchingQueue.getQueueStatus().waitingUsers
        });
      }
    } catch (error) {
      console.error('Error finding random partner:', error);
      socket.emit('random-partner-result', { 
        success: false,
        error: 'Failed to find partner'
      });
    }
  });
  
  // Video upgrade handling
  socket.on('video-upgrade-request', (data) => {
    console.log(`Video upgrade request from ${socket.userId} to ${data.targetUserId}`);
    
    // Forward the request to the target user
    const targetSocketId = onlineUsers.get(data.targetUserId);
    if (targetSocketId) {
      io.to(targetSocketId).emit('video-upgrade-request', {
        from: socket.userId
      });
    } else {
      console.log(`Target user ${data.targetUserId} not found or offline`);
    }
  });
  
  socket.on('video-upgrade-accepted', (data) => {
    console.log(`Video upgrade accepted by ${socket.userId} for ${data.targetUserId}`);
    
    // Update call record to indicate video is now used
    try {
      // Use the Call controller to update the call
      const callController = require('./controllers/callController');
      callController.updateCallToVideo(socket.userId, data.targetUserId)
        .then(() => {
          console.log('Call record updated to include video');
        })
        .catch(error => {
          console.error('Error updating call record for video:', error.message);
        });
    } catch (error) {
      console.error('Error importing call controller:', error.message);
    }
    
    // Forward the acceptance to the requesting user
    const targetSocketId = onlineUsers.get(data.targetUserId);
    if (targetSocketId) {
      io.to(targetSocketId).emit('video-upgrade-accepted', {
        from: socket.userId
      });
    } else {
      console.log(`Target user ${data.targetUserId} not found or offline`);
    }
  });
  
  socket.on('video-upgrade-rejected', (data) => {
    console.log(`Video upgrade rejected by ${socket.userId} for ${data.targetUserId}`);
    
    // Forward the rejection to the requesting user
    const targetSocketId = onlineUsers.get(data.targetUserId);
    if (targetSocketId) {
      io.to(targetSocketId).emit('video-upgrade-rejected', {
        from: socket.userId
      });
    } else {
      console.log(`Target user ${data.targetUserId} not found or offline`);
    }
  });
  
  // Call room handling for multiple devices
  socket.on('join-call-room', (data) => {
    console.log(`User ${socket.userId} joining call room ${data.roomId}`);
    socket.join(`call:${data.roomId}`);
  });
  
  socket.on('leave-call-room', (data) => {
    console.log(`User ${socket.userId} leaving call room ${data.roomId}`);
    socket.leave(`call:${data.roomId}`);
  });
  
  // Handle disconnect - update to also clear ready-to-talk status
  socket.on('disconnect', async () => {
    if (socket.userId) {
      console.log(`User disconnected: ${socket.userId} with socket ID: ${socket.id}`);
    
      // Check if this user has another socket connection before removing
      const currentSocketId = onlineUsers.get(socket.userId.toString());
      if (currentSocketId === socket.id) {
        try {
          // Update user's offline status and last seen in database
          await User.findByIdAndUpdate(socket.userId, {
            isOnline: false,
            lastSeenAt: new Date(),
            isTyping: false,
            typingInChat: null
          });
          console.log(`✅ Updated user ${socket.userId} offline status in database`);
        } catch (error) {
          console.error(`❌ Error updating user offline status:`, error);
        }
        
        // Remove user from online users map only if this is the socket that put them online
        onlineUsers.delete(socket.userId.toString());
        console.log(`Removed user ${socket.userId} from online users map. Total online: ${onlineUsers.size}`);
        
        // Remove from matching queue
        matchingQueue.removeFromQueue(socket.userId);
        
        // Clear ready to talk status
        clearUserReadyToTalk(socket.userId);
    
        // Broadcast offline status to all connected clients with last seen
        io.emit('user-status', {
          userId: socket.userId,
          status: 'offline',
          lastSeen: new Date()
        });
        
        // Broadcast ready status change
        broadcastReadyToTalkStatus(socket.userId, false);
      } else {
        console.log(`Not removing user ${socket.userId} from online users map because socket IDs don't match: ${currentSocketId} vs ${socket.id}`);
      }
    } else {
      console.log('Socket disconnected without userId');
    }
  });
  
  // Handle AI chat message
  socket.on('ai-message', async (data) => {
    try {
      const { message, conversationId, options } = data;
      
      if (!socket.userId) {
        socket.emit('ai-response-error', {
          error: 'Authentication required'
        });
        return;
      }
      
      // Start typing indicator
      socket.emit('ai-typing', { isTyping: true });
      
      // Generate AI response
      const result = await aiService.generateResponse(
        socket.userId,
        message,
        conversationId,
        options
      );
      
      // Stop typing indicator
      socket.emit('ai-typing', { isTyping: false });
      
      // Send response back to user
      socket.emit('ai-response', {
        success: true,
        response: result.response,
        conversationId: result.conversationId
      });
    } catch (error) {
      console.error('Error processing AI message:', error);
      
      // Stop typing indicator
      socket.emit('ai-typing', { isTyping: false });
      
      // Send error back to user
      socket.emit('ai-response-error', {
        success: false,
        error: error.message || 'Error processing AI request'
      });
    }
  });
});

// Middleware
// Configure CORS for all routes with more permissive settings for development
const corsOptions = {
  origin: [
    '*', 
    'http://localhost:5000', 
    'http://127.0.0.1:5000', 
    'http://10.0.2.2:5000',
    // React Native emulator addresses
    'http://localhost:8081',
    'http://10.0.2.2:8081',
    'http://localhost:19000',
    'http://10.0.2.2:19000',
    'exp://*',
    'file://*',
    // Production server URL
    'https://mrenglishserverside.onrender.com',
    // Allow all origins for React Native apps
    'capacitor://*',
    'ionic://*'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
};
app.use(cors(corsOptions));

// Body parser middleware - make sure this is before routes
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: '10mb' })); // Increase JSON payload limit

// Debug middleware - log all requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log('Headers:', JSON.stringify(req.headers));
  
  // For debugging body parsing issues
  if (req.method !== 'GET' && req.method !== 'OPTIONS') {
    console.log('Request body:', req.body);
  }
  
  // If this is a preflight OPTIONS request, respond immediately
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS preflight request');
    return res.status(204).end();
  }
  
  next();
});

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/messages', require('./routes/messageRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
// Fix for call routes issue
const expressCallRoutes = require('./routes/callRoutes');
app.use('/api/calls', expressCallRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/rankings', require('./routes/rankingRoutes'));
app.use('/api/profile', require('./routes/profileRoutes'));
app.use('/api/ratings', require('./routes/ratingRoutes'));

// Simple test endpoint for connectivity testing
app.get('/test', (req, res) => {
  // Log detailed request info
  console.log('Test endpoint called');
  console.log('  Headers:', JSON.stringify(req.headers));
  console.log('  IP:', req.ip);
  console.log('  Original URL:', req.originalUrl);

  // Return simple response
  res.json({
    success: true,
    message: 'Server connectivity test successful',
    source: 'Android Emulator Server',
    timestamp: new Date().toISOString(),
    clientInfo: {
      ip: req.ip,
      userAgent: req.headers['user-agent']
    }
  });
});

// Debug token endpoint
app.post('/api/debug/token', (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') || 
                  req.body.token;
    
    console.log('Token debug endpoint called with token:', token ? token.substring(0, 15) + '...' : 'No token');
    
    if (!token) {
      return res.status(400).json({ message: 'No token provided' });
    }
    
    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('Token decoded successfully:', decoded);
      
      return res.status(200).json({ 
        message: 'Token is valid',
        decoded 
      });
    } catch (jwtError) {
      console.error('JWT verification error:', jwtError.message);
      return res.status(401).json({ 
        message: 'Invalid token',
        error: jwtError.message
      });
    }
  } catch (error) {
    console.error('Token debug endpoint error:', error);
    return res.status(500).json({ 
      message: 'Server error',
      error: error.message
    });
  }
});

// Add a health check endpoint that doesn't require auth
app.get('/', (req, res) => {
  res.status(200).send('Server is running');
});

app.get('/healthcheck', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});

// API documentation endpoint
app.get('/api', (req, res) => {
  res.json({ 
    message: 'API is running',
    endpoints: {
      auth: '/api/auth/*',
      messages: '/api/messages/*',
      debug: '/api/debug/token'
    },
    status: 'ok' 
  });
});

// Hard-set port to 5001 to avoid conflicts
const PORT = 5000;
const HOST = '0.0.0.0'; // Listen on all network interfaces

// Log server network interfaces for debugging
const os = require('os');
const networkInterfaces = os.networkInterfaces();
console.log('Server network interfaces:');
Object.keys(networkInterfaces).forEach(ifname => {
  networkInterfaces[ifname].forEach(iface => {
    if (iface.family === 'IPv4') {
      console.log(`  ${ifname}: ${iface.address}`);
    }
  });
});

server.listen(PORT, HOST, () => {
  console.log(`\n---- SERVER STARTED ----`);
  console.log(`Server running on http://${HOST}:${PORT}`);
  console.log(`For local testing: http://localhost:${PORT}`);
  console.log(`For emulator testing: http://10.0.2.2:${PORT}`);
  console.log(`LAN testing: http://[YOUR-LOCAL-IP]:${PORT}`);
  
  // Log all available routes
  console.log('\nAvailable routes:');
  console.log(`  GET  /`);
  console.log(`  GET  /api`);
  console.log(`  POST /api/auth/google`);
  
  // Print settings
  console.log('\nServer settings:');
  console.log(`  CORS origin: ${JSON.stringify(corsOptions.origin)}`);
});
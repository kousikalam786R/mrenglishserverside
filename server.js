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

// Connect to database
connectDB();

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
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.userId} with socket ID: ${socket.id}`);
  
  // Add user to online users map
  if (socket.userId) {
    onlineUsers.set(socket.userId.toString(), socket.id);
    console.log(`Added user ${socket.userId} to online users map. Total online: ${onlineUsers.size}`);
    console.log('Current online users:', Array.from(onlineUsers.keys()));
    
    // Broadcast online status to all connected clients
    io.emit('user-status', {
      userId: socket.userId,
      status: 'online'
    });
  } else {
    console.warn('Socket connected without userId');
  }
  
  // WebRTC Call Signaling - Call Offer
  socket.on('call-offer', async (data) => {
    try {
      const { targetUserId, sdp, type, isVideo } = data;
      console.log(`Call offer from ${socket.userId} to ${targetUserId}`, isVideo ? '(video)' : '(audio)');
      
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
          callHistoryId: callHistory?._id
        });
        
        // Notify caller that the offer was sent
        socket.emit('call-offer-sent', { 
          success: true, 
          targetUserId,
          callHistoryId: callHistory?._id
        });
      } else {
        // Target user is offline
        socket.emit('call-offer-sent', { 
          success: false, 
          error: 'User is offline',
          targetUserId,
          callHistoryId: callHistory?._id
        });
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
      const { targetUserId, sdp, type, accepted, callHistoryId } = data;
      console.log(`Call ${accepted ? 'accepted' : 'rejected'} by ${socket.userId} for ${targetUserId}`);
      
      // Update call history in database
      if (callHistoryId) {
        if (accepted) {
          await callController.callAnswered(callHistoryId);
        } else {
          await callController.callRejected(callHistoryId);
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
      const { targetUserId, callHistoryId } = data;
      console.log(`Call ended by ${socket.userId} to ${targetUserId}`);
      
      // Update call history in database
      if (callHistoryId) {
        await callController.endCall(callHistoryId, socket.userId);
      }
      
      // Get target user socket
      const targetSocket = getUserSocket(targetUserId);
      
      if (targetSocket) {
        // Notify target that call has ended
        targetSocket.emit('call-end', {
          endedBy: socket.userId,
          callHistoryId
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
      
      // Log all message attempts
      console.log(`Message attempt: From ${senderId} to ${receiverId}: ${content.substring(0, 20)}...`);
      
      // Basic validation
      if (!content || !receiverId) {
        socket.emit('message-sent', { 
          success: false, 
          error: 'Missing required fields' 
        });
        return;
      }
      
      // Check if receiver ID is a valid MongoDB ObjectId
      const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(receiverId);
      if (!isValidObjectId) {
        console.log(`Invalid receiver ID format: ${receiverId}`);
        socket.emit('message-sent', { 
          success: false, 
          error: 'Invalid receiver ID format' 
        });
        return;
      }
      
      // Save the message to the database
      const newMessage = new Message({
        sender: senderId,
        receiver: receiverId,
        content,
        read: false
      });
      
      await newMessage.save();
      
      // Populate sender and receiver info
      await newMessage.populate('sender', 'name profilePic');
      await newMessage.populate('receiver', 'name profilePic');
      
      // Get receiver socket (if online)
      const receiverSocket = getUserSocket(receiverId);
      
      // Notify the receiver
      if (receiverSocket) {
        receiverSocket.emit('new-message', {
          from: socket.user,
          message: newMessage
        });
      }
      
      // Send confirmation to sender
      socket.emit('message-sent', { 
        success: true, 
        message: newMessage
      });
    } catch (error) {
      console.error('Error sending private message:', error);
      socket.emit('message-sent', { 
        success: false, 
        error: 'Failed to send message' 
      });
    }
  });
  
  // Handle typing indicator
  socket.on('typing', (data) => {
    const { receiverId } = data;
    const receiverSocketId = onlineUsers.get(receiverId.toString());
    
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('user-typing', {
        userId: socket.userId.toString()
      });
    }
  });
  
  socket.on('typing-stopped', (data) => {
    const { receiverId } = data;
    const receiverSocketId = onlineUsers.get(receiverId.toString());
    
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('typing-stopped', {
        userId: socket.userId.toString()
      });
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
  
  // Handle finding a random partner
  socket.on('find-random-partner', async () => {
    try {
      const readyUsers = getReadyToTalkUsers();
      
      // Filter out the current user and convert to array
      const otherReadyUsers = Array.from(readyUsers.entries())
        .filter(([userId]) => userId !== socket.userId);
      
      if (otherReadyUsers.length === 0) {
        socket.emit('random-partner-result', { 
          success: false,
          error: 'No users available for matching'
        });
        return;
      }
      
      // Select a random user
      const randomIndex = Math.floor(Math.random() * otherReadyUsers.length);
      const [partnerId, partnerData] = otherReadyUsers[randomIndex];
      
      // Set the current user as ready to talk if not already
      if (!readyUsers.has(socket.userId)) {
        setUserReadyToTalk(socket.userId, true, {
          name: socket.user?.name,
          profilePic: socket.user?.profilePic
        });
        
        // Broadcast the current user's status
        broadcastReadyToTalkStatus(socket.userId, true, {
          name: socket.user?.name,
          profilePic: socket.user?.profilePic
        });
      }
      
      // Get partner's full user info
      const partnerUser = await User.findById(partnerId).select('-idToken -__v');
      
      // Return the partner
      socket.emit('random-partner-result', {
        success: true,
        partner: {
          _id: partnerId,
          name: partnerData.name || partnerUser?.name,
          profilePic: partnerData.profilePic || partnerUser?.profilePic,
          level: partnerData.level || partnerUser?.level,
          isOnline: true,
          readyToTalk: true
        }
      });
      
      // Get partner's socket
      const partnerSocketId = getUserSocketId(partnerId);
      if (partnerSocketId) {
        const partnerSocket = io.sockets.sockets.get(partnerSocketId);
        if (partnerSocket) {
          // Notify partner about the match
          partnerSocket.emit('partner-found', {
            partner: {
              _id: socket.userId,
              name: socket.user?.name,
              profilePic: socket.user?.profilePic,
              isOnline: true,
              readyToTalk: true
            }
          });
        }
      }
    } catch (error) {
      console.error('Error finding random partner:', error);
      socket.emit('random-partner-result', { 
        success: false,
        error: 'Failed to find partner'
      });
    }
  });
  
  // Handle disconnect - update to also clear ready-to-talk status
  socket.on('disconnect', () => {
    if (socket.userId) {
      console.log(`User disconnected: ${socket.userId} with socket ID: ${socket.id}`);
      
      // Check if this user has another socket connection before removing
      const currentSocketId = onlineUsers.get(socket.userId.toString());
      if (currentSocketId === socket.id) {
        // Remove user from online users map only if this is the socket that put them online
        onlineUsers.delete(socket.userId.toString());
        console.log(`Removed user ${socket.userId} from online users map. Total online: ${onlineUsers.size}`);
        
        // Clear ready to talk status
        clearUserReadyToTalk(socket.userId);
        
        // Broadcast offline status to all connected clients
        io.emit('user-status', {
          userId: socket.userId,
          status: 'offline'
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
});

// Middleware
// Configure CORS for all routes with more permissive settings for development
const corsOptions = {
  origin: ['*', 'http://localhost:5000', 'http://127.0.0.1:5000', 'http://10.0.2.2:5000'],
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
// Fix for call routes issue
const expressCallRoutes = require('./routes/callRoutes');
app.use('/api/calls', expressCallRoutes);

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
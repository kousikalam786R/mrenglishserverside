/**
 * QUICK SERVER INTEGRATION FOR PARTNER MATCHING
 * 
 * Copy and paste these code blocks into your server.js file
 */

// ============================================
// STEP 1: Add at the top with other imports
// ============================================

const matchingQueue = require('./utils/partnerMatchingQueue');

// ============================================
// STEP 2: Add these socket event handlers
// Replace or add to existing socket.on('connection') block
// ============================================

// Add inside io.on('connection', (socket) => { ... })

// Handle finding a random partner - NEW
socket.on('find-random-partner', async (data) => {
  try {
    const { preferences } = data || {};
    
    console.log(`🔍 User ${socket.userId} looking for partner`);
    console.log(`🔍 Socket ID: ${socket.id}, User ID: ${socket.userId}`);
    console.log(`🔍 Socket authenticated: ${!!socket.userId}`);
    
    if (!socket.userId) {
      console.log(`❌ Socket not authenticated - no userId found`);
      socket.emit('partner-search-error', { error: 'Not authenticated' });
      return;
    }
    
    // Get user data
    const user = await User.findById(socket.userId).select('name profilePic englishLevel country gender');
    
    if (!user) {
      socket.emit('random-partner-result', { 
        success: false,
        error: 'User not found'
      });
      return;
    }
    
    // Set user as ready to talk (important for receiver)
    socket.emit('set-ready-to-talk', { status: true });
    
    // Add user to matching queue
    const match = matchingQueue.addToQueue(
      socket.userId,
      socket.id,
      {
        name: user.name,
        profilePic: user.profilePic,
        level: user.englishLevel,
        country: user.country,
        gender: user.gender
      },
      preferences || {}
    );
    
    if (match) {
      // Match found immediately!
      console.log(`✅ Match found: ${match.user1.userId} <-> ${match.user2.userId}`);
      
      // Find sockets by user ID (more reliable than using stored socket IDs)
      let user1Socket = null;
      let user2Socket = null;
      
      for (const [socketId, sock] of io.sockets.sockets) {
        if (sock.userId === match.user1.userId) {
          user1Socket = sock;
        }
        if (sock.userId === match.user2.userId) {
          user2Socket = sock;
        }
      }
      
      console.log(`🔍 Found sockets - User1: ${user1Socket ? 'YES' : 'NO'}, User2: ${user2Socket ? 'YES' : 'NO'}`);
      console.log(`🔍 User1 socket ID: ${user1Socket?.id}, User2 socket ID: ${user2Socket?.id}`);
      console.log(`🔍 Looking for User1 ID: ${match.user1.userId}, User2 ID: ${match.user2.userId}`);
      console.log(`🔍 All connected sockets:`, Array.from(io.sockets.sockets.keys()));
      console.log(`🔍 Socket user mappings:`, Array.from(io.sockets.sockets.entries()).map(([id, sock]) => ({ socketId: id, userId: sock.userId, connected: sock.connected })));
      
      if (!user1Socket) {
        console.log(`❌ Could not find socket for User1: ${match.user1.userId}`);
      }
      if (!user2Socket) {
        console.log(`❌ Could not find socket for User2: ${match.user2.userId}`);
      }
      
      // Add a small delay to ensure both users are ready to receive events
      setTimeout(() => {
        // Notify user 1
        if (user1Socket) {
        console.log(`📤 SENDING partner-found to user1 (${match.user1.userId}) via socket ${user1Socket.id}`);
        console.log(`📤 USER1 EVENT DATA:`, {
          success: true,
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
        user1Socket.emit('partner-found', {
          success: true,
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
        // Backup: Force close search screen
        user1Socket.emit('close-partner-search');
        // Additional backup: Force close
        user1Socket.emit('force-close-search');
        // Ultimate backup: Force close
        user1Socket.emit('partner-search-force-close');
        console.log(`📤 Sent all close events to user1: ${match.user1.userId}`);

        // Debug: Send debug event
        user1Socket.emit('debug-socket-events', {
          event: 'partner-found',
          timestamp: new Date().toISOString(),
          userId: match.user1.userId,
          partnerId: match.user2.userId
        });
      } else {
        console.log(`❌ User1 socket not found for user: ${match.user1.userId}`);
      }

      // Notify user 2
      if (user2Socket) {
        console.log(`📤 SENDING partner-found to user2 (${match.user2.userId}) via socket ${user2Socket.id}`);
        console.log(`📤 USER2 EVENT DATA:`, {
          success: true,
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
        user2Socket.emit('partner-found', {
          success: true,
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
        // Backup: Force close search screen
        user2Socket.emit('close-partner-search');
        // Additional backup: Force close
        user2Socket.emit('force-close-search');
        // Ultimate backup: Force close
        user2Socket.emit('partner-search-force-close');
        console.log(`📤 Sent all close events to user2: ${match.user2.userId}`);

        // Debug: Send debug event
        user2Socket.emit('debug-socket-events', {
          event: 'partner-found',
          timestamp: new Date().toISOString(),
          userId: match.user2.userId,
          partnerId: match.user1.userId
        });
        } else {
          console.log(`❌ User2 socket not found for user: ${match.user2.userId}`);
        }
        
        // Both users are now matched and will automatically connect
        console.log(`🎉 Both users notified - automatic connection will start`);
      }, 100); // 100ms delay to ensure both users are ready
    } else {
      // No match yet, user added to queue
      console.log(`⏳ User ${socket.userId} added to queue, waiting...`);
      
      socket.emit('partner-search-status', {
        success: true,
        message: 'Searching for partner...',
        queuePosition: matchingQueue.getQueueStatus().waitingUsers
      });
    }
  } catch (error) {
    console.error('❌ Error finding random partner:', error);
    socket.emit('random-partner-result', { 
      success: false,
      error: 'Failed to find partner'
    });
  }
});

// Handle cancel partner search - NEW
socket.on('cancel-partner-search', () => {
  console.log(`❌ User ${socket.userId} cancelled partner search`);
  matchingQueue.removeFromQueue(socket.userId);
  
  socket.emit('partner-search-cancelled', {
    success: true,
    message: 'Search cancelled'
  });
});

// Handle call ended - clear matched pairs - NEW
socket.on('call-ended', (data) => {
  console.log(`📞 Call ended for user ${socket.userId}`);
  
  // Remove matched pair to prevent reconnection
  matchingQueue.removeMatchedPair(socket.userId);
  
  // Set user as not ready to talk
  socket.emit('set-ready-to-talk', { status: false });
});

// Handle call disconnected - clear matched pairs - NEW  
socket.on('call-disconnected', (data) => {
  console.log(`📞 Call disconnected for user ${socket.userId}`);
  
  // Remove matched pair to prevent reconnection
  matchingQueue.removeMatchedPair(socket.userId);
});

// Handle test event (for debugging)
socket.on('test-event', (data) => {
  console.log(`🔍 Test event received from ${socket.userId}:`, data);
  socket.emit('test-event-response', { 
    success: true, 
    message: 'Test event received',
    userId: socket.userId,
    timestamp: new Date().toISOString()
  });
});

// Partner matching calls now use regular call flow
// No need for separate partner call events

// ============================================
// STEP 3: Update disconnect handler
// Find your existing socket.on('disconnect') and add this line
// ============================================

socket.on('disconnect', () => {
  if (socket.userId) {
    console.log(`User disconnected: ${socket.userId}`);
    
    // Remove from matching queue - ADD THIS LINE
    matchingQueue.removeFromQueue(socket.userId);
    
    // ... rest of your existing disconnect code ...
  }
});

// ============================================
// STEP 4: Add debug endpoint (Optional but recommended)
// Add this with your other app.get/app.post routes
// ============================================

app.get('/api/debug/matching-queue', (req, res) => {
  const status = matchingQueue.getQueueStatus();
  res.json({
    ...status,
    timestamp: new Date().toISOString()
  });
});

// ============================================
// THAT'S IT! Now test it:
// ============================================
// 1. Restart your server: node server.js
// 2. Open app on two devices
// 3. Both click "Find a perfect partner"
// 4. They should match instantly!
//
// Check queue status: http://localhost:5000/api/debug/matching-queue
// ============================================


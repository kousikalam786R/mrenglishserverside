# Server Integration Guide
## Adding Partner Matching & Push Notifications to server.js

This guide shows how to integrate the partner matching queue and push notifications into your existing `server.js` file.

## Step 1: Add Required Imports

Add these imports at the top of `server.js`:

```javascript
// Add after existing imports
const matchingQueue = require('./utils/partnerMatchingQueue');
const pushNotificationService = require('./utils/pushNotificationService');
```

## Step 2: Initialize Push Notification Service

Add this after `connectDB()`:

```javascript
// Connect to database
connectDB();

// Initialize Push Notification Service
pushNotificationService.initialize();
```

## Step 3: Add Notification Routes

Add this with other route definitions:

```javascript
// Add after existing routes
app.use('/api/notifications', require('./routes/notificationRoutes'));
```

## Step 4: Update Socket Events

### A. Update `find-random-partner` Event

Replace the existing `find-random-partner` listener with:

```javascript
// Handle finding a random partner - UPDATED
socket.on('find-random-partner', async (data) => {
  try {
    const { preferences } = data || {};
    
    console.log(`User ${socket.userId} looking for partner with preferences:`, preferences);
    
    // Get user data
    const user = await User.findById(socket.userId).select('name profilePic englishLevel country gender');
    
    if (!user) {
      socket.emit('random-partner-result', { 
        success: false,
        error: 'User not found'
      });
      return;
    }
    
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
      preferences
    );
    
    if (match) {
      // Match found immediately! Notify both users
      console.log(`✅ Match found: ${match.user1.userId} <-> ${match.user2.userId}`);
      
      const user1Socket = io.sockets.sockets.get(match.user1.socketId);
      const user2Socket = io.sockets.sockets.get(match.user2.socketId);
      
      // Notify user 1
      if (user1Socket) {
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
        
        // Send push notification to user 1
        await pushNotificationService.sendPartnerFoundNotification(
          match.user1.userId,
          {
            _id: match.user2.userId,
            name: match.user2.userData.name,
            profilePic: match.user2.userData.profilePic
          }
        );
      }
      
      // Notify user 2
      if (user2Socket) {
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
        
        // Send push notification to user 2
        await pushNotificationService.sendPartnerFoundNotification(
          match.user2.userId,
          {
            _id: match.user1.userId,
            name: match.user1.userData.name,
            profilePic: match.user1.userData.profilePic
          }
        );
      }
    } else {
      // No match yet, user added to queue
      console.log(`User ${socket.userId} added to queue, waiting for match...`);
      
      socket.emit('partner-search-status', {
        success: true,
        message: 'Searching for partner...',
        queuePosition: matchingQueue.getQueueStatus().waitingUsers
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

// Add cancel partner search handler
socket.on('cancel-partner-search', () => {
  console.log(`User ${socket.userId} cancelled partner search`);
  matchingQueue.removeFromQueue(socket.userId);
  
  socket.emit('partner-search-cancelled', {
    success: true
  });
});
```

### B. Update `private-message` Event

Add push notification to existing message handler:

```javascript
// Handle private messages - UPDATE
socket.on('private-message', async (data) => {
  try {
    const { receiverId, content } = data;
    const senderId = socket.user._id;
    
    // Log all message attempts
    console.log(`Message attempt: From ${senderId} to ${receiverId}`);
    
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
    
    // Notify the receiver if online
    if (receiverSocket) {
      receiverSocket.emit('new-message', {
        from: socket.user,
        message: newMessage
      });
    }
    
    // Send push notification (works even if user is offline)
    await pushNotificationService.sendMessageNotification(
      receiverId,
      {
        _id: socket.user._id,
        name: socket.user.name,
        profilePic: socket.user.profilePic
      }
    );
    
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
```

### C. Update `call-offer` Event

Add push notification to call offer:

```javascript
// WebRTC Call Signaling - Call Offer - UPDATE
socket.on('call-offer', async (data) => {
  try {
    const { targetUserId, sdp, type, isVideo, renegotiation } = data;
    
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
    
    // Send push notification (works even if user is offline)
    await pushNotificationService.sendCallNotification(
      targetUserId,
      {
        _id: socket.userId,
        name: socket.user.name,
        profilePic: socket.user.profilePic
      },
      isVideo
    );
  } catch (error) {
    console.error('Error processing call offer:', error);
    socket.emit('call-offer-sent', { 
      success: false, 
      error: 'Failed to process call offer'
    });
  }
});
```

### D. Update `disconnect` Event

Remove users from matching queue on disconnect:

```javascript
// Handle disconnect - UPDATE
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
      
      // Remove from matching queue
      matchingQueue.removeFromQueue(socket.userId);
      
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
```

## Step 5: Add Queue Status Endpoint (Optional)

Add this endpoint for monitoring:

```javascript
// Debug endpoint to check matching queue status
app.get('/api/debug/matching-queue', (req, res) => {
  const status = matchingQueue.getQueueStatus();
  res.json(status);
});
```

## Step 6: Environment Variables

Add to your `.env` file:

```env
# Firebase Service Account for Push Notifications
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"..."}

# OR use file path
GOOGLE_APPLICATION_CREDENTIALS=./firebase-service-account.json
```

## Complete Integration Checklist

- [ ] Import `matchingQueue` and `pushNotificationService`
- [ ] Initialize push notification service after `connectDB()`
- [ ] Add notification routes
- [ ] Update `find-random-partner` event handler
- [ ] Add `cancel-partner-search` event handler
- [ ] Update `private-message` with push notifications
- [ ] Update `call-offer` with push notifications
- [ ] Update `disconnect` to remove from matching queue
- [ ] Add Firebase credentials to `.env`
- [ ] Test partner matching with two users
- [ ] Test push notifications

## Testing

### Test Partner Matching

```bash
# Open 3 terminal windows

# Terminal 1: Start server
cd mrenglishserverside
node server.js

# Terminal 2: Check queue status
curl http://localhost:5000/api/debug/matching-queue

# Terminal 3: Monitor logs
cd mrenglishserverside
tail -f server.log
```

### Test Push Notifications

```bash
# Send test notification via API
curl -X POST http://localhost:5000/api/notifications/test \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

## Monitoring

Add logging for better monitoring:

```javascript
// Log queue status every 30 seconds
setInterval(() => {
  const status = matchingQueue.getQueueStatus();
  if (status.waitingUsers > 0) {
    console.log(`📊 Matching Queue: ${status.waitingUsers} users waiting`);
  }
}, 30000);
```

## Troubleshooting

### Partner Matching Not Working

1. Check if both users are online
2. Verify socket connections
3. Check console logs for errors
4. Test queue status endpoint
5. Verify user data is being passed correctly

### Push Notifications Not Working

1. Check Firebase credentials are set
2. Verify FCM tokens are being registered
3. Check notification permissions on device
4. Test with Firebase Console
5. Check backend logs for errors

## Next Steps

After integration:

1. Test with multiple users
2. Monitor queue statistics
3. Set up notification analytics
4. Add rate limiting for searches
5. Implement advanced matching algorithms
6. Add notification preferences

---

Your server is now ready with partner matching and push notifications! 🎉


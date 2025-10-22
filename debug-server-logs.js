/**
 * Debug Server Socket Emission
 * Add enhanced logging to see exactly what's happening in the socket flow
 */

// Add this to your server.js private-message handler for enhanced debugging:

/*
socket.on('private-message', async (data) => {
  try {
    const { receiverId, content } = data;
    const senderId = socket.user._id;
    
    console.log(`\n🔥 ENHANCED DEBUG: MESSAGE FLOW STARTED`);
    console.log(`========================================`);
    console.log(`📤 Sender: ${socket.user.name} (${senderId})`);
    console.log(`📥 Receiver ID: ${receiverId}`);
    console.log(`💬 Content: "${content}"`);
    console.log(`🆔 Sender Socket ID: ${socket.id}`);
    
    // Check online users map
    console.log(`\n👥 ONLINE USERS DEBUG:`);
    console.log(`📊 Total online users: ${onlineUsers.size}`);
    console.log(`👤 All online user IDs:`, Array.from(onlineUsers.keys()));
    console.log(`🔍 Looking for receiver ${receiverId} in online users...`);
    
    // Check if receiver is in online users map
    const receiverSocketId = onlineUsers.get(receiverId.toString());
    console.log(`🔌 Receiver socket ID from map: ${receiverSocketId || 'NOT FOUND'}`);
    
    // Check direct getUserSocket function
    const receiverSocket = getUserSocket(receiverId);
    console.log(`🔌 Receiver socket from getUserSocket: ${receiverSocket ? receiverSocket.id : 'NOT FOUND'}`);
    
    // Basic validation
    if (!content || !receiverId) {
      console.log(`❌ Validation failed: Missing required fields`);
      socket.emit('message-sent', { 
        success: false, 
        error: 'Missing required fields' 
      });
      return;
    }
    
    // Save message to database...
    const newMessage = new Message({
      sender: senderId,
      receiver: receiverId,
      content,
      read: false
    });
    
    await newMessage.save();
    console.log(`💾 Message saved to database: ${newMessage._id}`);
    
    // Populate sender and receiver info
    await newMessage.populate('sender', 'name profilePic');
    await newMessage.populate('receiver', 'name profilePic');
    console.log(`📝 Message populated with user data`);
    
    // Emit to receiver if online
    if (receiverSocket) {
      console.log(`\n📡 SOCKET EMISSION DEBUG:`);
      console.log(`🎯 Emitting 'new-message' to receiver socket ${receiverSocket.id}`);
      console.log(`📦 Emission payload:`, {
        from: {
          _id: socket.user._id,
          name: socket.user.name,
          profilePic: socket.user.profilePic
        },
        message: {
          _id: newMessage._id,
          content: newMessage.content,
          sender: newMessage.sender,
          receiver: newMessage.receiver,
          createdAt: newMessage.createdAt
        }
      });
      
      receiverSocket.emit('new-message', {
        from: socket.user,
        message: newMessage
      });
      console.log(`✅ new-message event emitted successfully`);
      
      // Also emit to sender for confirmation (optional)
      console.log(`📤 Emitting 'message-sent' confirmation to sender ${socket.id}`);
    } else {
      console.log(`⚠️  Receiver not online, no socket emission`);
    }
    
    // Send confirmation to sender
    socket.emit('message-sent', { 
      success: true, 
      message: newMessage
    });
    
    console.log(`✅ MESSAGE FLOW DEBUG COMPLETED`);
    console.log(`========================================\n`);
    
  } catch (error) {
    console.error('❌ Error in private-message handler:', error);
    socket.emit('message-sent', { 
      success: false, 
      error: 'Failed to send message' 
    });
  }
});
*/

console.log('📋 Enhanced debugging logs ready to be added to server.js');
console.log('📝 Copy the socket.on("private-message") handler above and replace the existing one in server.js');


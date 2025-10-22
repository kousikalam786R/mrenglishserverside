const socketIo = require('socket.io-client');
const jwt = require('jsonwebtoken');
require('dotenv').config();

/**
 * Test Enhanced Chat Features
 * This script tests the real-time functionality of our enhanced chat features
 */
class EnhancedFeaturesTest {
  constructor() {
    this.baseUrl = 'http://192.168.29.151:5000';
    this.sockets = {};
    this.testResults = {
      messageStatus: false,
      onlineStatus: false,
      typingIndicators: false,
      readReceipts: false
    };
  }

  // Generate test tokens
  generateTestToken(userId, email) {
    return jwt.sign(
      { id: userId, email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );
  }

  // Create socket connection
  async createSocket(userId, userName, userEmail) {
    return new Promise((resolve, reject) => {
      console.log(`\n🔗 Creating socket for ${userName} (${userId})`);
      
      const token = this.generateTestToken(userId, userEmail);
      
      const socket = socketIo(this.baseUrl, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: 1000
      });

      socket.on('connect', () => {
        console.log(`✅ ${userName} connected with socket ID: ${socket.id}`);
        this.sockets[userId] = socket;
        resolve(socket);
      });

      socket.on('connect_error', (error) => {
        console.error(`❌ ${userName} connection error:`, error.message);
        reject(error);
      });

      // Listen for enhanced events
      socket.on('user-status', (data) => {
        console.log(`📡 ${userName} received user-status:`, {
          userId: data.userId,
          status: data.status,
          lastSeen: data.lastSeen ? 'Present' : 'Missing'
        });
        this.testResults.onlineStatus = true;
      });

      socket.on('user-typing', (data) => {
        console.log(`⌨️  ${userName} received typing:`, {
          userId: data.userId,
          userName: data.userName || 'Missing',
          chatId: data.chatId || 'Missing'
        });
        this.testResults.typingIndicators = true;
      });

      socket.on('typing-stopped', (data) => {
        console.log(`⌨️  ${userName} received typing-stopped:`, {
          userId: data.userId,
          userName: data.userName || 'Missing'
        });
      });

      socket.on('new-message', (data) => {
        console.log(`📨 ${userName} received new-message:`, {
          messageId: data.message?._id,
          status: data.message?.status || 'Missing',
          deliveredAt: data.message?.deliveredAt ? 'Present' : 'Missing',
          content: data.message?.content?.substring(0, 30) + '...'
        });
        this.testResults.messageStatus = true;
      });

      socket.on('message-delivered', (data) => {
        console.log(`✅ ${userName} received message-delivered:`, {
          messageId: data.messageId,
          deliveredAt: data.deliveredAt ? 'Present' : 'Missing'
        });
        this.testResults.messageStatus = true;
      });

      socket.on('message-read', (data) => {
        console.log(`👁️  ${userName} received message-read:`, {
          messageId: data.messageId,
          readAt: data.readAt ? 'Present' : 'Missing'
        });
        this.testResults.readReceipts = true;
      });

      socket.on('message-sent', (data) => {
        console.log(`📤 ${userName} received message-sent confirmation:`, {
          success: data.success,
          messageId: data.message?._id
        });
      });
    });
  }

  // Test message sending
  async sendMessage(fromUserId, toUserId, content) {
    const socket = this.sockets[fromUserId];
    if (!socket) {
      console.error(`❌ No socket for user ${fromUserId}`);
      return;
    }

    console.log(`\n📤 Sending: "${content}"`);
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Message timeout'));
      }, 5000);

      const onMessageSent = (data) => {
        clearTimeout(timeout);
        if (data.success) {
          console.log(`✅ Message confirmed sent`);
          resolve(data);
        } else {
          console.error(`❌ Message failed:`, data.error);
          reject(new Error(data.error));
        }
        socket.off('message-sent', onMessageSent);
      };

      socket.once('message-sent', onMessageSent);
      socket.emit('private-message', { receiverId: toUserId, content });
    });
  }

  // Test typing indicators
  testTyping(fromUserId, toUserId) {
    const socket = this.sockets[fromUserId];
    if (!socket) return;

    console.log(`\n⌨️  Testing typing indicators`);
    
    // Start typing
    socket.emit('typing', { receiverId: toUserId });
    
    // Stop typing after 2 seconds
    setTimeout(() => {
      socket.emit('typing-stopped', { receiverId: toUserId });
    }, 2000);
  }

  // Test read receipts
  markMessageAsRead(userId, messageId, senderId) {
    const socket = this.sockets[userId];
    if (!socket) return;

    console.log(`\n👁️  Testing read receipt for message ${messageId}`);
    socket.emit('mark-message-read', { messageId, senderId });
  }

  // Run comprehensive test
  async runTest() {
    console.log('🚀 Testing Enhanced Chat Features');
    console.log('=====================================');

    try {
      // Test user IDs
      const user1 = {
        id: '68132e25736f7b73216b9632', // Alamgir
        name: 'Alamgir',
        email: 'neeraj@gmail.com'
      };

      const user2 = {
        id: '68138900736f7b73216b9643', // Sabib  
        name: 'Sabib',
        email: 'sabibhasan905@gmail.com'
      };

      // Create connections
      console.log('\n🔗 Step 1: Creating Connections');
      await this.createSocket(user1.id, user1.name, user1.email);
      await this.createSocket(user2.id, user2.name, user2.email);

      await new Promise(resolve => setTimeout(resolve, 2000));

      // Test typing indicators
      console.log('\n⌨️  Step 2: Testing Typing Indicators');
      this.testTyping(user1.id, user2.id);

      await new Promise(resolve => setTimeout(resolve, 3000));

      // Test message sending with status
      console.log('\n📨 Step 3: Testing Message Status');
      const messageResult = await this.sendMessage(
        user1.id, 
        user2.id, 
        'Testing enhanced message status! 🚀'
      );

      await new Promise(resolve => setTimeout(resolve, 2000));

      // Test read receipt
      if (messageResult && messageResult.message) {
        console.log('\n👁️  Step 4: Testing Read Receipt');
        this.markMessageAsRead(user2.id, messageResult.message._id, user1.id);
      }

      await new Promise(resolve => setTimeout(resolve, 3000));

      // Show test results
      console.log('\n📊 Test Results:');
      console.log('================');
      console.log(`📨 Message Status: ${this.testResults.messageStatus ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`🟢 Online Status: ${this.testResults.onlineStatus ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`⌨️  Typing Indicators: ${this.testResults.typingIndicators ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`👁️  Read Receipts: ${this.testResults.readReceipts ? '✅ PASS' : '❌ FAIL'}`);

      const totalPassed = Object.values(this.testResults).filter(Boolean).length;
      console.log(`\n🎯 Overall: ${totalPassed}/4 features working`);

      if (totalPassed === 4) {
        console.log('🎉 ALL ENHANCED FEATURES WORKING!');
      } else {
        console.log('⚠️  Some features need attention');
      }

    } catch (error) {
      console.error('❌ Test failed:', error);
    }
  }

  // Clean up
  cleanup() {
    console.log('\n🧹 Cleaning up connections...');
    Object.values(this.sockets).forEach(socket => {
      socket.disconnect();
    });
    process.exit(0);
  }
}

// Run the test
const tester = new EnhancedFeaturesTest();

// Handle graceful shutdown
process.on('SIGINT', () => {
  tester.cleanup();
});

// Start test
tester.runTest()
  .then(() => {
    console.log('\n✅ Test completed. Press Ctrl+C to exit.');
  })
  .catch(error => {
    console.error('❌ Test error:', error);
    tester.cleanup();
  });


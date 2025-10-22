const socketIo = require('socket.io-client');
const jwt = require('jsonwebtoken');
require('dotenv').config();

/**
 * Comprehensive Socket Flow Debugger
 * Tests the complete message flow from sender to receiver
 */
class SocketFlowDebugger {
  constructor() {
    this.baseUrl = 'http://192.168.29.151:5000';
    this.sockets = {};
    this.tokens = {};
  }

  // Generate test tokens for users
  generateTestToken(userId, email) {
    return jwt.sign(
      { id: userId, email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );
  }

  // Create socket connection for a user
  async createUserSocket(userId, userName, userEmail) {
    return new Promise((resolve, reject) => {
      console.log(`\n🔗 Creating socket for ${userName} (${userId})`);
      
      const token = this.generateTestToken(userId, userEmail);
      this.tokens[userId] = token;
      
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

      socket.on('disconnect', (reason) => {
        console.log(`❌ ${userName} disconnected:`, reason);
      });

      // Listen for all possible events
      socket.on('user-status', (data) => {
        console.log(`📡 ${userName} received user-status:`, data);
      });

      socket.on('new-message', (data) => {
        console.log(`📨 ${userName} received new-message:`, data);
        console.log(`📋 Message details:`, {
          from: data.from?.name || 'Unknown',
          messageId: data.message?._id,
          content: data.message?.content,
          sender: data.message?.sender,
          receiver: data.message?.receiver
        });
      });

      socket.on('message-sent', (data) => {
        console.log(`✅ ${userName} received message-sent confirmation:`, data);
      });

      socket.on('user-typing', (data) => {
        console.log(`⌨️  ${userName} received typing indicator:`, data);
      });

      socket.on('typing-stopped', (data) => {
        console.log(`⌨️  ${userName} received typing stopped:`, data);
      });
    });
  }

  // Send a test message
  async sendTestMessage(fromUserId, toUserId, content) {
    const senderSocket = this.sockets[fromUserId];
    if (!senderSocket) {
      console.error(`❌ No socket found for sender ${fromUserId}`);
      return;
    }

    console.log(`\n📤 Sending message from ${fromUserId} to ${toUserId}: "${content}"`);
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Message sending timeout'));
      }, 10000);

      const onMessageSent = (data) => {
        clearTimeout(timeout);
        if (data.success) {
          console.log(`✅ Message confirmed sent:`, data);
          resolve(data);
        } else {
          console.error(`❌ Message sending failed:`, data.error);
          reject(new Error(data.error));
        }
        senderSocket.off('message-sent', onMessageSent);
      };

      senderSocket.once('message-sent', onMessageSent);
      senderSocket.emit('private-message', { 
        receiverId: toUserId, 
        content 
      });
    });
  }

  // Test complete flow
  async testCompleteFlow() {
    try {
      console.log('🚀 Starting Complete Socket Flow Test');
      console.log('=====================================');

      // Test user IDs (replace with your actual user IDs)
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

      // Create socket connections
      console.log('\n🔗 Step 1: Creating Socket Connections');
      await this.createUserSocket(user1.id, user1.name, user1.email);
      await this.createUserSocket(user2.id, user2.name, user2.email);

      // Wait a bit for connections to stabilize
      await new Promise(resolve => setTimeout(resolve, 2000));

      console.log('\n📨 Step 2: Testing Message Flow');
      
      // Test message from User 1 to User 2
      console.log('\n--- Test 1: User1 → User2 ---');
      await this.sendTestMessage(user1.id, user2.id, 'Hello from User1! Testing socket flow.');
      
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Test message from User 2 to User 1  
      console.log('\n--- Test 2: User2 → User1 ---');
      await this.sendTestMessage(user2.id, user1.id, 'Hello from User2! Testing socket flow back.');

      await new Promise(resolve => setTimeout(resolve, 2000));

      console.log('\n✅ Socket Flow Test Completed!');
      console.log('=====================================');

    } catch (error) {
      console.error('❌ Socket Flow Test Failed:', error);
    }
  }

  // Clean up connections
  cleanup() {
    console.log('\n🧹 Cleaning up socket connections...');
    Object.values(this.sockets).forEach(socket => {
      socket.disconnect();
    });
    process.exit(0);
  }
}

// Run the test
const socketTester = new SocketFlowDebugger();

// Handle graceful shutdown
process.on('SIGINT', () => {
  socketTester.cleanup();
});

process.on('SIGTERM', () => {
  socketTester.cleanup();
});

// Start the test
socketTester.testCompleteFlow()
  .then(() => {
    console.log('\n⏰ Test completed. Press Ctrl+C to exit.');
  })
  .catch(error => {
    console.error('❌ Test failed:', error);
    socketTester.cleanup();
  });

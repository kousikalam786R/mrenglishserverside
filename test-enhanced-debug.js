const socketIo = require('socket.io-client');
const jwt = require('jsonwebtoken');
require('dotenv').config();

/**
 * Enhanced Features Debug Test
 * This script tests the enhanced message data flow
 */
class EnhancedDebugTest {
  constructor() {
    this.baseUrl = 'http://192.168.29.151:5000';
    this.sockets = {};
  }

  generateTestToken(userId, email) {
    return jwt.sign(
      { id: userId, email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );
  }

  async createSocket(userId, userName, userEmail) {
    return new Promise((resolve, reject) => {
      console.log(`\n🔗 Creating socket for ${userName}`);
      
      const token = this.generateTestToken(userId, userEmail);
      
      const socket = socketIo(this.baseUrl, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: 1000
      });

      socket.on('connect', () => {
        console.log(`✅ ${userName} connected: ${socket.id}`);
        this.sockets[userId] = socket;
        resolve(socket);
      });

      socket.on('connect_error', (error) => {
        console.error(`❌ ${userName} connection error:`, error.message);
        reject(error);
      });

      // Enhanced message events
      socket.on('new-message', (data) => {
        console.log(`\n📨 ${userName} received NEW-MESSAGE:`);
        console.log(`   Message ID: ${data.message?._id}`);
        console.log(`   Status: ${data.message?.status || 'undefined'}`);
        console.log(`   Sent At: ${data.message?.sentAt || 'undefined'}`);
        console.log(`   Delivered At: ${data.message?.deliveredAt || 'undefined'}`);
        console.log(`   Read At: ${data.message?.readAt || 'undefined'}`);
        console.log(`   Content: ${data.message?.content?.substring(0, 30)}...`);
        console.log(`   Read (legacy): ${data.message?.read}`);
      });

      socket.on('message-delivered', (data) => {
        console.log(`\n✅ ${userName} received MESSAGE-DELIVERED:`);
        console.log(`   Message ID: ${data.messageId}`);
        console.log(`   Delivered At: ${data.deliveredAt || 'undefined'}`);
      });

      socket.on('message-read', (data) => {
        console.log(`\n👁️  ${userName} received MESSAGE-READ:`);
        console.log(`   Message ID: ${data.messageId}`);
        console.log(`   Read At: ${data.readAt || 'undefined'}`);
      });

      socket.on('message-sent', (data) => {
        console.log(`\n📤 ${userName} received MESSAGE-SENT:`);
        console.log(`   Success: ${data.success}`);
        console.log(`   Message ID: ${data.message?._id}`);
        console.log(`   Status: ${data.message?.status || 'undefined'}`);
      });
    });
  }

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
          console.log(`✅ Message sent successfully`);
          resolve(data);
        } else {
          reject(new Error(data.error));
        }
        socket.off('message-sent', onMessageSent);
      };

      socket.once('message-sent', onMessageSent);
      socket.emit('private-message', { receiverId: toUserId, content });
    });
  }

  async runTest() {
    console.log('🔍 Enhanced Features Debug Test');
    console.log('=================================');

    try {
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

      // Send test message
      console.log('\n📨 Step 2: Testing Enhanced Message Data');
      const messageResult = await this.sendMessage(
        user1.id, 
        user2.id, 
        'Testing enhanced message data flow! 🔍'
      );

      await new Promise(resolve => setTimeout(resolve, 3000));

      console.log('\n✅ Test completed. Check the logs above for enhanced data.');

    } catch (error) {
      console.error('❌ Test failed:', error);
    }
  }

  cleanup() {
    console.log('\n🧹 Cleaning up...');
    Object.values(this.sockets).forEach(socket => {
      socket.disconnect();
    });
    process.exit(0);
  }
}

// Run the test
const tester = new EnhancedDebugTest();

process.on('SIGINT', () => {
  tester.cleanup();
});

tester.runTest()
  .then(() => {
    console.log('\nPress Ctrl+C to exit.');
  })
  .catch(error => {
    console.error('❌ Test error:', error);
    tester.cleanup();
  });


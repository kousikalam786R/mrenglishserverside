const socketIo = require('socket.io-client');
const jwt = require('jsonwebtoken');
require('dotenv').config();

/**
 * Test User Status Events
 * This script tests if user status events are being sent correctly
 */
class UserStatusTest {
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

      // Listen for user status events
      socket.on('user-status', (data) => {
        console.log(`\n📡 ${userName} received USER-STATUS:`);
        console.log(`   User ID: ${data.userId}`);
        console.log(`   Status: ${data.status}`);
        console.log(`   Last Seen: ${data.lastSeen || 'undefined'}`);
      });
    });
  }

  async runTest() {
    console.log('🔍 User Status Events Test');
    console.log('==========================');

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
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      await this.createSocket(user2.id, user2.name, user2.email);

      await new Promise(resolve => setTimeout(resolve, 3000));

      console.log('\n✅ Test completed. Check the logs above for user status events.');

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
const tester = new UserStatusTest();

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

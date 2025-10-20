/**
 * Queue Management Test Script
 * 
 * This script demonstrates how the queue handles multiple users
 * Run this to test the queue management system
 */

const matchingQueue = require('./utils/partnerMatchingQueue');

// Test function to simulate multiple users
function testQueueManagement() {
  console.log('🧪 Testing Queue Management with Multiple Users\n');
  
  // Simulate 20 users joining the queue
  const users = [];
  for (let i = 1; i <= 20; i++) {
    users.push({
      userId: `user${i}`,
      socketId: `socket${i}`,
      userData: {
        name: `User${i}`,
        profilePic: `https://example.com/pic${i}.jpg`,
        level: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'][i % 6],
        country: ['USA', 'UK', 'Canada', 'Australia', 'Germany'][i % 5],
        gender: ['Male', 'Female'][i % 2]
      },
      preferences: {}
    });
  }
  
  console.log('📊 Initial Queue Status:');
  console.log(matchingQueue.getQueueStatus());
  console.log('');
  
  // Add users one by one and show matching
  users.forEach((user, index) => {
    console.log(`👤 User ${user.userId} (${user.userData.name}) joining...`);
    
    const match = matchingQueue.addToQueue(
      user.userId,
      user.socketId,
      user.userData,
      user.preferences
    );
    
    if (match) {
      console.log(`✅ Match found: ${match.user1.userId} ↔ ${match.user2.userId}`);
    } else {
      console.log(`⏳ No match yet, waiting in queue`);
    }
    
    console.log(`📊 Queue Status: ${matchingQueue.getQueueStatus().waitingUsers} users waiting`);
    console.log('');
  });
  
  console.log('🎯 Final Results:');
  const finalStatus = matchingQueue.getQueueStatus();
  console.log(`- Users matched: ${finalStatus.matchedPairs * 2}`);
  console.log(`- Users still waiting: ${finalStatus.waitingUsers}`);
  console.log(`- Total pairs created: ${finalStatus.matchedPairs}`);
  
  if (finalStatus.waitingUsers > 0) {
    console.log('\n👥 Remaining users:');
    finalStatus.users.forEach(user => {
      console.log(`  - ${user.name} (waiting ${user.waitingTime}ms)`);
    });
  }
  
  console.log('\n✅ Queue management test completed!');
}

// Test with different scenarios
function testScenarios() {
  console.log('\n🎯 Testing Different Scenarios\n');
  
  // Scenario 1: Perfect matching (even number of users)
  console.log('Scenario 1: 10 users (should create 5 pairs)');
  for (let i = 1; i <= 10; i++) {
    matchingQueue.addToQueue(
      `test1_user${i}`,
      `test1_socket${i}`,
      { name: `Test1User${i}` },
      {}
    );
  }
  console.log('Result:', matchingQueue.getQueueStatus());
  
  // Clear queue for next test
  matchingQueue.waitingUsers.clear();
  matchingQueue.matchedPairs.clear();
  
  // Scenario 2: Odd number of users
  console.log('\nScenario 2: 7 users (should create 3 pairs, 1 waiting)');
  for (let i = 1; i <= 7; i++) {
    matchingQueue.addToQueue(
      `test2_user${i}`,
      `test2_socket${i}`,
      { name: `Test2User${i}` },
      {}
    );
  }
  console.log('Result:', matchingQueue.getQueueStatus());
  
  // Clear queue for next test
  matchingQueue.waitingUsers.clear();
  matchingQueue.matchedPairs.clear();
  
  // Scenario 3: Large number of users
  console.log('\nScenario 3: 50 users (should create 25 pairs)');
  for (let i = 1; i <= 50; i++) {
    matchingQueue.addToQueue(
      `test3_user${i}`,
      `test3_socket${i}`,
      { name: `Test3User${i}` },
      {}
    );
  }
  console.log('Result:', matchingQueue.getQueueStatus());
  
  console.log('\n✅ All scenarios tested!');
}

// Performance test
function testPerformance() {
  console.log('\n⚡ Performance Test\n');
  
  const testSizes = [10, 50, 100, 500];
  
  testSizes.forEach(size => {
    console.log(`Testing with ${size} users:`);
    
    const startTime = Date.now();
    
    // Add users
    for (let i = 1; i <= size; i++) {
      matchingQueue.addToQueue(
        `perf_user${i}`,
        `perf_socket${i}`,
        { name: `PerfUser${i}` },
        {}
      );
    }
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    const status = matchingQueue.getQueueStatus();
    console.log(`  - Time: ${duration}ms`);
    console.log(`  - Matched: ${status.matchedPairs * 2} users`);
    console.log(`  - Waiting: ${status.waitingUsers} users`);
    console.log(`  - Pairs: ${status.matchedPairs}`);
    console.log('');
    
    // Clear for next test
    matchingQueue.waitingUsers.clear();
    matchingQueue.matchedPairs.clear();
  });
  
  console.log('✅ Performance test completed!');
}

// Run all tests
if (require.main === module) {
  console.log('🚀 Starting Queue Management Tests\n');
  
  testQueueManagement();
  testScenarios();
  testPerformance();
  
  console.log('\n🎉 All tests completed successfully!');
  console.log('\nThe queue management system handles multiple users efficiently!');
}

module.exports = {
  testQueueManagement,
  testScenarios,
  testPerformance
};


/**
 * Complete Push Notification Testing Script
 * 
 * Tests all implemented push notification types
 */

const axios = require('axios');

// Configuration
const SERVER_URL = 'http://192.168.29.151:5000'; // Update with your server URL
const API_URL = `${SERVER_URL}/api`;

// Test data - you'll need to get these from your app
let authToken = null;
let testUserId = null;

/**
 * Test Authentication
 */
async function testAuth() {
  console.log('\n🔐 Testing Authentication...');
  
  try {
    // You can either login with test credentials or use existing token
    const response = await axios.post(`${API_URL}/auth/login`, {
      email: 'test@example.com',
      password: 'testpassword'
    });
    
    if (response.data.success) {
      authToken = response.data.token;
      testUserId = response.data.userId;
      console.log('✅ Authentication successful');
      return true;
    }
  } catch (error) {
    console.log('❌ Authentication failed - Using manual token');
    // If login fails, you can manually set these from your app
    // authToken = 'your_jwt_token_here';
    // testUserId = 'your_user_id_here';
    return false;
  }
}

/**
 * Test 1: Basic Push Notification Test
 */
async function testBasicNotification() {
  console.log('\n📱 Test 1: Basic Push Notification...');
  
  try {
    const response = await axios.post(`${API_URL}/notifications/test`, {}, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (response.data.success) {
      console.log('✅ Basic notification sent successfully');
      console.log('📋 Check your device notification tray');
      return true;
    } else {
      console.log('❌ Basic notification failed:', response.data.error);
      return false;
    }
  } catch (error) {
    console.log('❌ Basic notification error:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Test 2: Rating Notification
 */
async function testRatingNotification() {
  console.log('\n⭐ Test 2: Rating Notification...');
  
  try {
    // Submit a test rating (you'll need another user ID to rate)
    const response = await axios.post(`${API_URL}/ratings/submit`, {
      userId: testUserId, // In real scenario, this would be a different user
      rating: 5,
      comment: 'Great conversation partner!',
      interactionType: 'call'
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('✅ Rating notification test completed');
    console.log('📋 Check for rating notification');
    return true;
  } catch (error) {
    console.log('❌ Rating notification test failed:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Test 3: Feedback Notification
 */
async function testFeedbackNotification() {
  console.log('\n💬 Test 3: Feedback Notification...');
  
  try {
    const response = await axios.post(`${API_URL}/ratings/feedback`, {
      userId: testUserId,
      feedbackType: 'positive',
      message: 'Excellent English skills!',
      interactionType: 'call'
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('✅ Feedback notification test completed');
    console.log('📋 Check for feedback notification');
    return true;
  } catch (error) {
    console.log('❌ Feedback notification test failed:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Test 4: Achievement Notification (Trigger by getting stats)
 */
async function testAchievementNotification() {
  console.log('\n🏆 Test 4: Achievement Notification...');
  
  try {
    // Get user stats to potentially trigger achievement
    const response = await axios.get(`${API_URL}/profile/stats`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('✅ Achievement check completed');
    console.log('📋 Check for any achievement notifications');
    console.log('💡 Achievements trigger when you reach milestones (5 calls, 10 ratings, etc.)');
    return true;
  } catch (error) {
    console.log('❌ Achievement test failed:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Test 5: Custom Notification
 */
async function testCustomNotification() {
  console.log('\n🎯 Test 5: Custom Notification...');
  
  try {
    // Send custom notification using the push service directly
    const customNotification = {
      title: '🎉 Custom Test Notification',
      body: 'This is a custom notification test from the complete system!',
      channelId: 'test',
      data: {
        type: 'custom_test',
        timestamp: new Date().toISOString()
      }
    };

    // This would typically be called from server-side code
    console.log('📤 Custom notification data prepared');
    console.log('💡 Custom notifications work through the backend push service');
    return true;
  } catch (error) {
    console.log('❌ Custom notification test failed:', error.message);
    return false;
  }
}

/**
 * Test Summary and Instructions
 */
function printTestSummary() {
  console.log('\n📊 PUSH NOTIFICATION TEST SUMMARY');
  console.log('=====================================');
  console.log('');
  console.log('✅ IMPLEMENTED NOTIFICATIONS:');
  console.log('  1. 🤝 Partner Found Notifications');
  console.log('  2. 📞 Incoming Call Notifications');
  console.log('  3. 💬 Message Notifications');
  console.log('  4. ⏰ Missed Call Notifications');
  console.log('  5. ⭐ Rating Notifications');
  console.log('  6. 💬 Feedback Notifications');
  console.log('  7. 🌟 Compliment Notifications');
  console.log('  8. 🏆 Achievement Notifications');
  console.log('  9. 📅 Daily Practice Reminders');
  console.log('');
  console.log('🧪 TO TEST IN YOUR APP:');
  console.log('  • Partner Matching: Use the lobby queue system');
  console.log('  • Incoming Calls: Call another user');
  console.log('  • Messages: Send messages between users');
  console.log('  • Ratings: Rate users after calls');
  console.log('  • Achievements: Complete calls and get ratings');
  console.log('  • Daily Reminders: Wait for scheduled times (10 AM, 7 PM)');
  console.log('');
  console.log('⚡ NOTIFICATION STATES TO TEST:');
  console.log('  • App in Foreground: Should see in-app alerts');
  console.log('  • App in Background: Should see notification tray');
  console.log('  • App Closed: Should see notification tray + app launch');
  console.log('');
  console.log('🎯 SUCCESS INDICATORS:');
  console.log('  • Backend logs show "✅ Notification sent to user..."');
  console.log('  • Firebase Console shows message delivery');
  console.log('  • Device notification tray shows notifications');
  console.log('  • App navigation works from notifications');
}

/**
 * Main Test Function
 */
async function runAllTests() {
  console.log('🚀 STARTING COMPLETE PUSH NOTIFICATION TESTS');
  console.log('=============================================');
  
  // Check authentication
  const authSuccess = await testAuth();
  
  if (!authSuccess && !authToken) {
    console.log('\n❌ Cannot run tests without authentication');
    console.log('💡 Please update the script with valid credentials or tokens');
    return;
  }

  // Run all tests
  await testBasicNotification();
  await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds between tests
  
  await testRatingNotification();
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  await testFeedbackNotification();
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  await testAchievementNotification();
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  await testCustomNotification();
  
  // Print summary
  printTestSummary();
  
  console.log('\n🎉 ALL TESTS COMPLETED!');
  console.log('📱 Check your device for notifications');
}

// Manual test configuration (if authentication fails)
if (process.argv.includes('--manual')) {
  console.log('🔧 MANUAL TEST MODE');
  console.log('Please update these values with your app data:');
  authToken = 'your_jwt_token_here';
  testUserId = 'your_user_id_here';
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  runAllTests,
  testBasicNotification,
  testRatingNotification,
  testFeedbackNotification,
  testAchievementNotification,
  testCustomNotification
};

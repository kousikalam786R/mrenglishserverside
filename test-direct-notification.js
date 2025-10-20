/**
 * Direct FCM Test Script
 * Send notification directly to a specific FCM token
 */

const admin = require('firebase-admin');
require('dotenv').config();

async function testDirectNotification() {
  try {
    console.log('🔧 Initializing Firebase Admin SDK...');
    
    // Initialize Firebase Admin SDK
    if (admin.apps.length === 0) {
      if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        admin.initializeApp({
          credential: admin.credential.applicationDefault()
        });
      } else {
        console.error('❌ No Firebase credentials found');
        return;
      }
    }

    // Test FCM tokens (from previous debug)
    const testTokens = [
      {
        name: 'Sabib',
        token: 'd6qq7CHYTHyIKAb0XhmcQH:APA91bESbeIgfTNt7PYlrOCl7h1V6n2X6Q8CrQzK6-VeLm_gY5Pk9EJRoqlj9_Zt5p3zehL9d3-Dm_UXcpiGfVwY7vI02DJL_W8-mhKrFWoN-7Lh_kgJPMCXF8hO9--SeEjLQxfL7W9O'
      },
      {
        name: 'Alamgir Mondal',
        token: 'fD6NVeeuSzKaa3KpVyAwWF:APA91bH4rVQkWeLAGE3-Bz_Q2gNQFp1DAPhEOGweCfysQ7p9rJmZT0_S21A4oIe-J8bKxXxLlHD-XQAMOFe5H-XYX_Xdby5QrjNsOhHQCUbMdWCQm6Gl1dsLiGYrG6VmoGvRm9Ix5xrr'
      }
    ];

    console.log('\n🧪 Testing Direct Notifications...');
    console.log('=====================================');

    for (const user of testTokens) {
      console.log(`\n📱 Testing notification to ${user.name}:`);
      console.log(`   Token: ${user.token.substring(0, 20)}...`);
      
      try {
        // Simple test message
        const message = {
          token: user.token,
          notification: {
            title: '🧪 Direct Test Notification',
            body: `Hello ${user.name}! This is a direct FCM test.`
          },
          data: {
            type: 'test',
            timestamp: new Date().toISOString(),
            testId: 'direct-test-' + Date.now()
          },
          android: {
            notification: {
              channelId: 'default',
              priority: 'high',
              sound: 'default'
            }
          }
        };

        console.log(`   🚀 Sending notification...`);
        const response = await admin.messaging().send(message);
        console.log(`   ✅ SUCCESS: ${response}`);
        
        // Validate token
        console.log(`   🔍 Token validation: Valid`);
        
      } catch (error) {
        console.log(`   ❌ FAILED: ${error.code} - ${error.message}`);
        
        if (error.code === 'messaging/invalid-registration-token') {
          console.log(`   🔧 Token is invalid/expired`);
        } else if (error.code === 'messaging/registration-token-not-registered') {
          console.log(`   🔧 Token not registered with FCM`);
        } else {
          console.log(`   🔧 Other error: ${error.code}`);
        }
      }
    }

    console.log('\n💡 DEBUGGING TIPS:');
    console.log('==================');
    console.log('✅ If notifications sent successfully:');
    console.log('   • Check device notification settings');
    console.log('   • Verify app is not in Do Not Disturb');
    console.log('   • Check battery optimization settings');
    console.log('   • Try with app in different states (foreground/background/closed)');
    console.log('');
    console.log('❌ If tokens are invalid:');
    console.log('   • User needs to restart app to get new token');
    console.log('   • Check if app version/build changed');
    console.log('   • Verify Firebase project configuration');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testDirectNotification();

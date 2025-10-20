const admin = require('firebase-admin');
require('dotenv').config();

async function testRealTokens() {
  try {
    console.log('🔧 Testing with ACTUAL FCM tokens...');
    
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

    // Real tokens from database
    const testUsers = [
      {
        name: 'Alamgir Mondal',
        userId: '68138900736f7b73216b9643',
        token: 'fD6NVeeuSzKaa3KpVyAw60:APA91bERTxPCLaY_ZU4GDVdMlrnRXdfOd6NEDFnaV946xlvC7iPyQzDa4CPWbxewTs7v2eY6n8Kul-PjCA7pehwXtV1Iy-tJ_01D3ZVevf5qOJdI7g9D0R0'
      },
      {
        name: 'Sabib', 
        userId: '6858288e64adc0147bdf2e4e',
        token: 'd6qq7CHYTHyIKAb0Xhmcsy:APA91bFHG3-DCpf5BubfIbWAJenffIiAVN8uq5bPFL9pTBniSASI8ZBoR61RI8UhY4cAJBJYJdYMLtfhsGQf-4CfjPJ1rievXnSVQI_26YUiyVKSoNb2oMU'
      }
    ];

    for (const user of testUsers) {
      console.log(`\n📱 Testing notification to ${user.name}:`);
      
      try {
        const message = {
          token: user.token,
          notification: {
            title: '🎯 Real Token Test',
            body: `Hello ${user.name}! Your FCM token is working!`
          },
          data: {
            type: 'test',
            userId: user.userId,
            timestamp: new Date().toISOString()
          },
          android: {
            notification: {
              channelId: 'default', 
              priority: 'high',
              sound: 'default'
            }
          }
        };

        console.log(`   🚀 Sending to: ${user.token.substring(0, 30)}...`);
        const response = await admin.messaging().send(message);
        console.log(`   ✅ SUCCESS! Message ID: ${response}`);
        console.log(`   📱 Check ${user.name}'s device NOW!`);
        
      } catch (error) {
        console.log(`   ❌ FAILED: ${error.code}`);
        console.log(`   📝 Error: ${error.message}`);
        
        if (error.code === 'messaging/invalid-registration-token') {
          console.log(`   🔧 Solution: ${user.name} needs to restart the app`);
        }
      }
    }

    console.log('\n🎯 NEXT STEPS:');
    console.log('===============');
    console.log('1. Check BOTH devices for test notifications');
    console.log('2. If received: FCM is working, issue is elsewhere');
    console.log('3. If NOT received: Check device settings below');
    console.log('');
    console.log('📱 DEVICE CHECKLIST:');
    console.log('• App notifications enabled in Settings');
    console.log('• Battery optimization disabled for app'); 
    console.log('• Do Not Disturb mode OFF');
    console.log('• App has notification permission');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testRealTokens();

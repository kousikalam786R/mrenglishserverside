/**
 * Complete Messaging System Test
 * Test real-time messaging + push notifications
 */

const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function testMessagingSystem() {
  try {
    console.log('🧪 MESSAGING SYSTEM COMPREHENSIVE TEST');
    console.log('=====================================');
    
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/mrenglish');
    
    // Get our test users
    const users = await User.find({ 
      _id: { $in: ['68138900736f7b73216b9643', '6858288e64adc0147bdf2e4e'] }
    }).select('name email fcmToken');
    
    console.log('\n👥 TEST USERS:');
    users.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.name} (${user.email})`);
      console.log(`      ID: ${user._id}`);
      console.log(`      FCM Token: ${user.fcmToken ? 'EXISTS' : 'MISSING'}`);
    });
    
    console.log('\n📋 TESTING SCENARIOS:');
    console.log('====================');
    
    console.log('\n🔥 SCENARIO 1: Message Flow Test');
    console.log('--------------------------------');
    console.log('1. Device A (Alamgir): Open messaging app');
    console.log('2. Device A: Send message to Sabib');
    console.log('3. Device B (Sabib): Should receive:');
    console.log('   • Real-time message (if app open)');
    console.log('   • Push notification (if app background/closed)');
    
    console.log('\n🧪 SCENARIO 2: Notification States');
    console.log('-----------------------------------');
    console.log('Test with receiver app in different states:');
    console.log('• FOREGROUND: App open → Should see real-time message');
    console.log('• BACKGROUND: App minimized → Should see notification tray');
    console.log('• CLOSED: App closed → Should see notification tray + app open on tap');
    
    console.log('\n📱 EXPECTED BACKEND LOGS:');
    console.log('==========================');
    console.log('When you send a message, watch for:');
    console.log('```');
    console.log('📨 MESSAGE FLOW STARTED');
    console.log('===============================');
    console.log('📤 From: Alamgir Mondal (68138900736f7b73216b9643)');
    console.log('📥 To: 6858288e64adc0147bdf2e4e');
    console.log('💬 Content: "Hello from Alamgir!"');
    console.log('👤 Receiver found: Sabib');
    console.log('🔑 Receiver has FCM token: YES');
    console.log('💾 Message saved to database: [messageId]');
    console.log('🔌 Receiver online status: ONLINE/OFFLINE');
    console.log('📡 Sending real-time socket message to receiver...');
    console.log('✅ Real-time message sent via socket');
    console.log('🔔 Sending push notification to Sabib...');
    console.log('✅ Notification sent successfully to user...');
    console.log('📊 Push notification result: { success: true, ... }');
    console.log('✅ MESSAGE FLOW COMPLETED');
    console.log('```');
    
    console.log('\n📍 HOW TO TEST:');
    console.log('================');
    console.log('1. Restart your backend server (npm start)');
    console.log('2. Open messaging app on Device A (Alamgir)');
    console.log('3. Navigate to chat with Sabib');
    console.log('4. Send a test message: "Hello from Alamgir!"');
    console.log('5. Watch backend logs for MESSAGE FLOW');
    console.log('6. Check Device B (Sabib) for:');
    console.log('   • Real-time message (if app open)');
    console.log('   • Push notification (if app closed/background)');
    
    console.log('\n🔧 IF REAL-TIME WORKS BUT PUSH DOESN\'T:');
    console.log('=========================================');
    console.log('✅ Socket connection: Working');
    console.log('✅ Message delivery: Working');  
    console.log('❌ Push notifications: Device settings issue');
    console.log('');
    console.log('📱 CHECK DEVICE SETTINGS:');
    console.log('• App notifications enabled');
    console.log('• Battery optimization disabled');
    console.log('• Do Not Disturb mode OFF');
    console.log('• Notification channels enabled');
    
    console.log('\n🔧 IF NEITHER REAL-TIME NOR PUSH WORKS:');
    console.log('=======================================');
    console.log('❌ Socket connection: Check app connection');
    console.log('❌ Authentication: Check user login');
    console.log('❌ Network: Check server connectivity');
    
    console.log('\n🎯 SUCCESS INDICATORS:');
    console.log('======================');
    console.log('✅ Backend shows "MESSAGE FLOW COMPLETED"');
    console.log('✅ Firebase shows successful delivery');
    console.log('✅ Receiver gets real-time message (if app open)');
    console.log('✅ Receiver gets push notification (if app closed)');
    console.log('✅ Message appears in chat history');
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testMessagingSystem();

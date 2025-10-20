/**
 * Debug FCM Tokens Script
 * Check if users have FCM tokens registered
 */

const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function checkFCMTokens() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/mrenglish');
    console.log('📊 Connected to MongoDB');

    // Check specific user FCM tokens
    const targetUserId = '68138900736f7b73216b9643'; // Alamgir Mondal
    const currentUserId = '6858288e64adc0147bdf2e4e'; // Your user ID from logs

    console.log('\n🔍 Checking FCM Tokens:');
    console.log('========================');

    // Check target user (feedback recipient)
    const targetUser = await User.findById(targetUserId).select('name email fcmToken');
    if (targetUser) {
      console.log(`\n👤 Target User (${targetUser.name}):`);
      console.log(`   ID: ${targetUserId}`);
      console.log(`   Email: ${targetUser.email}`);
      console.log(`   FCM Token: ${targetUser.fcmToken ? '✅ EXISTS' : '❌ MISSING'}`);
      if (targetUser.fcmToken) {
        console.log(`   Token Preview: ${targetUser.fcmToken.substring(0, 20)}...`);
      }
    } else {
      console.log(`❌ Target user not found: ${targetUserId}`);
    }

    // Check current user (feedback sender)
    const currentUser = await User.findById(currentUserId).select('name email fcmToken');
    if (currentUser) {
      console.log(`\n👤 Current User (${currentUser.name}):`);
      console.log(`   ID: ${currentUserId}`);
      console.log(`   Email: ${currentUser.email}`);
      console.log(`   FCM Token: ${currentUser.fcmToken ? '✅ EXISTS' : '❌ MISSING'}`);
      if (currentUser.fcmToken) {
        console.log(`   Token Preview: ${currentUser.fcmToken.substring(0, 20)}...`);
      }
    } else {
      console.log(`❌ Current user not found: ${currentUserId}`);
    }

    // Check all users with FCM tokens
    const usersWithTokens = await User.find({ fcmToken: { $exists: true, $ne: null } }).select('name email fcmToken');
    console.log(`\n📊 Total users with FCM tokens: ${usersWithTokens.length}`);
    
    usersWithTokens.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.name} (${user.email})`);
    });

    console.log('\n💡 DEBUGGING TIPS:');
    console.log('==================');
    console.log('✅ If target user has FCM token: Check Firebase logs');
    console.log('❌ If target user missing FCM token: They need to login and grant permissions');
    console.log('🧪 Test with your own token using the test button in Profile screen');

    await mongoose.disconnect();
    console.log('\n📊 Database disconnected');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkFCMTokens();

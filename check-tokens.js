const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function checkTokens() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/mrenglish');
    
    const users = await User.find({ 
      _id: { $in: ['68138900736f7b73216b9643', '6858288e64adc0147bdf2e4e'] }
    }).select('name email fcmToken');
    
    console.log('🔍 FCM Token Analysis:');
    console.log('======================');
    
    users.forEach(user => {
      console.log(`\n👤 ${user.name} (${user.email}):`);
      if (user.fcmToken) {
        console.log(`   Token: ${user.fcmToken}`);
        console.log(`   Length: ${user.fcmToken.length} characters`);
        console.log(`   Format: ${user.fcmToken.includes(':') ? 'Valid format (has :)' : 'Invalid format (missing :)'}`);
        console.log(`   Starts with: ${user.fcmToken.substring(0, 20)}...`);
      } else {
        console.log(`   ❌ No FCM token found`);
      }
    });
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkTokens();



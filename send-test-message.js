/**
 * Send Test Message Script
 * Directly trigger the message system for testing
 */

const mongoose = require('mongoose');
const User = require('./models/User');
const Message = require('./models/Message');
const pushNotificationService = require('./utils/pushNotificationService');
require('dotenv').config();

async function sendTestMessage() {
  try {
    console.log('🧪 SENDING TEST MESSAGE...');
    console.log('===========================');
    
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/mrenglish');
    
    // Initialize push notification service
    pushNotificationService.initialize();
    
    // Test message data
    const senderId = '68138900736f7b73216b9643'; // Alamgir
    const receiverId = '6858288e64adc0147bdf2e4e'; // Sabib
    const content = '🧪 Test Message: Hello Nawaj da jodi help lage to bolo';
    
    // Get users
    const sender = await User.findById(senderId).select('name profilePic');
    const receiver = await User.findById(receiverId).select('name fcmToken');
    
    console.log(`📤 From: ${sender.name}`);
    console.log(`📥 To: ${receiver.name}`);
    console.log(`💬 Content: "${content}"`);
    console.log(`🔑 Receiver has FCM token: ${receiver.fcmToken ? 'YES' : 'NO'}`);
    
    // Save message to database
    const newMessage = new Message({
      sender: senderId,
      receiver: receiverId,
      content,
      read: false
    });
    
    await newMessage.save();
    console.log(`💾 Message saved to database: ${newMessage._id}`);
    
    // Send push notification
    console.log(`🔔 Sending push notification to ${receiver.name}...`);
    
    const notificationResult = await pushNotificationService.sendMessageNotification(
      receiverId,
      {
        _id: senderId,
        name: sender.name,
        profilePic: sender.profilePic
      }
    );
    
    console.log(`📊 Push notification result:`, notificationResult);
    
    if (notificationResult.success) {
      console.log(`✅ TEST MESSAGE SENT SUCCESSFULLY!`);
      console.log(`📱 Check Sabib's device for notification:`);
      console.log(`   Title: ${sender.name}`);
      console.log(`   Body: Sent you a message`);
    } else {
      console.log(`❌ TEST MESSAGE FAILED:`, notificationResult.error);
    }
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

sendTestMessage();

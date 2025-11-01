/**
 * Push Notification Service
 * 
 * Handles sending push notifications via Firebase Cloud Messaging (FCM)
 * for messages, calls, and other events
 */

const admin = require('firebase-admin');
const User = require('../models/User');

class PushNotificationService {
  constructor() {
    this.isInitialized = false;
  }

  /**
   * Initialize Firebase Admin SDK
   */
  initialize() {
    try {
      // Check if Firebase Admin is already initialized
      if (admin.apps.length === 0) {
        // Initialize with service account credentials
        // Make sure to set GOOGLE_APPLICATION_CREDENTIALS environment variable
        // or provide the path to your service account key file
        
        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
          const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
          
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
          });
          
          this.isInitialized = true;
          console.log('✅ Firebase Admin SDK initialized successfully');
        } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
          admin.initializeApp({
            credential: admin.credential.applicationDefault()
          });
          
          this.isInitialized = true;
          console.log('✅ Firebase Admin SDK initialized with application default credentials');
        } else {
          console.warn('⚠️  Firebase credentials not found. Push notifications will be disabled.');
          console.warn('Set FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS environment variable');
        }
      } else {
        this.isInitialized = true;
        console.log('✅ Firebase Admin SDK already initialized');
      }
    } catch (error) {
      console.error('❌ Error initializing Firebase Admin SDK:', error.message);
      this.isInitialized = false;
    }
  }

  /**
   * Send push notification to a user
   */
  async sendToUser(userId, notification) {
    console.log(`🔥 sendToUser called for userId: ${userId}`);
    console.log(`📋 Notification data:`, notification);
    
    if (!this.isInitialized) {
      console.log('Push notifications not initialized. Skipping notification.');
      return { success: false, error: 'Not initialized' };
    }

    try {
      // Get user's FCM token and notification preferences from database
      const user = await User.findById(userId).select('fcmToken notificationsEnabled');
      
      console.log(`👤 User found:`, user ? 'YES' : 'NO');
      console.log(`🔑 FCM Token exists:`, user && user.fcmToken ? 'YES' : 'NO');
      console.log(`🔔 Notifications enabled:`, user && user.notificationsEnabled !== false ? 'YES' : 'NO');
      
      // Check if notifications are disabled for this user
      if (user && user.notificationsEnabled === false) {
        console.log(`📴 Notifications are disabled for user ${userId}. Skipping notification.`);
        return { success: false, error: 'Notifications disabled' };
      }
      
      if (!user || !user.fcmToken) {
        console.log(`User ${userId} does not have an FCM token`);
        return { success: false, error: 'No FCM token' };
      }

      // Send notification
      const message = {
        token: user.fcmToken,
        notification: {
          title: notification.title,
          body: notification.body,
          imageUrl: notification.imageUrl
        },
        data: this.convertDataToStrings(notification.data || {}),
        android: {
          priority: 'high',
          notification: {
            channelId: notification.channelId || 'default',
            sound: notification.sound || 'default',
            priority: 'high',
            visibility: 'public'
          }
        },
        apns: {
          payload: {
            aps: {
              alert: {
                title: notification.title,
                body: notification.body
              },
              sound: notification.sound || 'default',
              badge: 1
            }
          }
        }
      };

      const response = await admin.messaging().send(message);
      console.log(`✅ Notification sent to user ${userId}:`, response);
      
      return { success: true, response };
    } catch (error) {
      console.error(`❌ Error sending notification to user ${userId}:`, error.message);
      
      // If token is invalid, remove it from user
      if (error.code === 'messaging/invalid-registration-token' || 
          error.code === 'messaging/registration-token-not-registered') {
        await User.findByIdAndUpdate(userId, { $unset: { fcmToken: 1 } });
        console.log(`Removed invalid FCM token for user ${userId}`);
      }
      
      return { success: false, error: error.message };
    }
  }

  /**
   * Send notification for incoming message
   */
  async sendMessageNotification(recipientId, sender) {
    return this.sendToUser(recipientId, {
      title: sender.name,
      body: 'Sent you a message',
      imageUrl: sender.profilePic,
      channelId: 'messages',
      sound: 'message_sound',
      data: {
        type: 'message',
        senderId: sender._id.toString(),
        senderName: sender.name,
        senderProfilePic: sender.profilePic || '',
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Send notification for incoming call
   */
  async sendCallNotification(recipientId, caller, isVideoCall = false) {
    return this.sendToUser(recipientId, {
      title: `${isVideoCall ? 'Video' : 'Voice'} Call`,
      body: `${caller.name} is calling you...`,
      imageUrl: caller.profilePic,
      channelId: 'calls',
      sound: 'call_ringtone',
      data: {
        type: 'call',
        callType: isVideoCall ? 'video' : 'audio',
        callerId: caller._id.toString(),
        callerName: caller.name,
        callerProfilePic: caller.profilePic || '',
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Send notification for missed call
   */
  async sendMissedCallNotification(recipientId, caller, isVideoCall = false) {
    return this.sendToUser(recipientId, {
      title: 'Missed Call',
      body: `You missed a ${isVideoCall ? 'video' : 'voice'} call from ${caller.name}`,
      imageUrl: caller.profilePic,
      channelId: 'notifications',
      data: {
        type: 'missed_call',
        callType: isVideoCall ? 'video' : 'audio',
        callerId: caller._id.toString(),
        callerName: caller.name,
        callerProfilePic: caller.profilePic || '',
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Send notification for partner found
   */
  async sendPartnerFoundNotification(userId, partner) {
    return this.sendToUser(userId, {
      title: 'Partner Found!',
      body: `${partner.name} wants to talk with you`,
      imageUrl: partner.profilePic,
      channelId: 'notifications',
      data: {
        type: 'partner_found',
        partnerId: partner._id.toString(),
        partnerName: partner.name,
        partnerProfilePic: partner.profilePic || '',
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Send notification for feedback received
   */
  async sendFeedbackNotification(userId, feedback) {
    // Handle different feedback object structures
    let feedbackText, senderName, senderProfilePic, feedbackId;
    
    if (feedback.feedbackType === 'positive') {
      feedbackText = 'gave you positive feedback!';
    } else if (feedback.feedbackType === 'negative') {
      feedbackText = 'gave you some feedback';
    } else if (feedback.feedbackType === 'rating') {
      feedbackText = `rated you ${feedback.rating} stars!`;
    } else if (feedback.feedbackType === 'compliment') {
      feedbackText = `gave you a compliment!`;
    } else {
      feedbackText = 'gave you feedback!';
    }
    
    // Handle different sender object structures
    if (feedback.feedbackBy) {
      senderName = feedback.feedbackBy.name || 'Someone';
      senderProfilePic = feedback.feedbackBy.profilePic;
    } else {
      senderName = 'Someone';
      senderProfilePic = null;
    }
    
    // Handle feedback ID safely
    if (feedback._id) {
      feedbackId = feedback._id.toString();
    } else {
      feedbackId = 'unknown';
    }
    
    // Prepare data payload - FCM requires all values to be strings
    const dataPayload = {
      type: 'feedback',
      feedbackType: String(feedback.feedbackType || 'unknown'),
      feedbackId: String(feedbackId),
      timestamp: new Date().toISOString()
    };

    // Only add non-null values as strings
    if (feedback.rating) {
      dataPayload.rating = String(feedback.rating);
    }
    if (feedback.complimentType) {
      dataPayload.complimentType = String(feedback.complimentType);
    }
    if (feedback.message) {
      dataPayload.message = String(feedback.message);
    }

    return this.sendToUser(userId, {
      title: 'New Feedback',
      body: `${senderName} ${feedbackText}`,
      imageUrl: senderProfilePic,
      channelId: 'notifications',
      data: dataPayload
    });
  }

  /**
   * Convert all data values to strings (FCM requirement)
   */
  convertDataToStrings(data) {
    const convertedData = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== null && value !== undefined) {
        convertedData[key] = String(value);
      }
    }
    return convertedData;
  }

  /**
   * Send bulk notifications to multiple users
   */
  async sendToMultipleUsers(userIds, notification) {
    const promises = userIds.map(userId => this.sendToUser(userId, notification));
    const results = await Promise.allSettled(promises);
    
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.length - successful;
    
    console.log(`Bulk notification: ${successful} sent, ${failed} failed`);
    
    return { successful, failed, results };
  }

  /**
   * Update user's FCM token
   */
  async updateUserToken(userId, fcmToken) {
    try {
      await User.findByIdAndUpdate(userId, { fcmToken });
      console.log(`✅ Updated FCM token for user ${userId}`);
      return { success: true };
    } catch (error) {
      console.error(`❌ Error updating FCM token for user ${userId}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Remove user's FCM token
   */
  async removeUserToken(userId) {
    try {
      await User.findByIdAndUpdate(userId, { $unset: { fcmToken: 1 } });
      console.log(`✅ Removed FCM token for user ${userId}`);
      return { success: true };
    } catch (error) {
      console.error(`❌ Error removing FCM token for user ${userId}:`, error.message);
      return { success: false, error: error.message };
    }
  }
}

// Create singleton instance
const pushNotificationService = new PushNotificationService();

module.exports = pushNotificationService;


/**
 * Daily Practice Reminder Service
 * 
 * Sends daily reminder notifications to inactive users
 */

const cron = require('node-cron');
const User = require('../models/User');
const UserStats = require('../models/UserStats');
const pushNotificationService = require('./pushNotificationService');

class DailyReminderService {
  constructor() {
    this.isRunning = false;
  }

  /**
   * Start the daily reminder service
   */
  start() {
    if (this.isRunning) {
      console.log('⏰ Daily reminder service is already running');
      return;
    }

    // Schedule daily reminders at 7 PM (19:00) every day
    cron.schedule('0 19 * * *', async () => {
      console.log('⏰ Running daily practice reminder task...');
      await this.sendDailyReminders();
    });

    // Schedule gentle reminder at 10 AM for users who haven't practiced recently
    cron.schedule('0 10 * * *', async () => {
      console.log('🌅 Running morning practice reminder task...');
      await this.sendMorningReminders();
    });

    this.isRunning = true;
    console.log('✅ Daily reminder service started');
    console.log('📅 Evening reminders: 7:00 PM daily');
    console.log('🌅 Morning reminders: 10:00 AM daily');
  }

  /**
   * Send daily reminders to inactive users (evening)
   */
  async sendDailyReminders() {
    try {
      // Find users who haven't been active in the last 24 hours
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const inactiveUsers = await UserStats.find({
        lastActiveAt: { $lt: oneDayAgo }
      }).populate('user', 'name fcmToken');

      console.log(`📊 Found ${inactiveUsers.length} inactive users for evening reminders`);

      let remindersSent = 0;
      const reminderMessages = [
        {
          title: '🗣️ Ready for English Practice?',
          body: 'Your language partners are waiting! Start a conversation today.'
        },
        {
          title: '📚 Daily English Time!',
          body: 'Just 10 minutes of practice can boost your confidence!'
        },
        {
          title: '🌟 Keep Your Streak Going!',
          body: 'Practice makes perfect. Find a partner and chat!'
        },
        {
          title: '🎯 English Practice Reminder',
          body: 'Connect with native speakers and improve your skills!'
        }
      ];

      for (const userStats of inactiveUsers) {
        if (userStats.user && userStats.user.fcmToken) {
          // Randomize reminder message
          const randomMessage = reminderMessages[Math.floor(Math.random() * reminderMessages.length)];
          
          await pushNotificationService.sendToUser(userStats.user._id, {
            title: randomMessage.title,
            body: randomMessage.body,
            channelId: 'reminders',
            data: {
              type: 'daily_reminder',
              timestamp: new Date().toISOString()
            }
          });

          remindersSent++;
          
          // Rate limit: Wait 100ms between sends to avoid overwhelming Firebase
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log(`📤 Sent ${remindersSent} evening practice reminders`);
      
    } catch (error) {
      console.error('❌ Error sending daily reminders:', error);
    }
  }

  /**
   * Send morning reminders to users who haven't practiced in 48+ hours
   */
  async sendMorningReminders() {
    try {
      // Find users who haven't been active in the last 48 hours
      const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
      
      const veryInactiveUsers = await UserStats.find({
        lastActiveAt: { $lt: twoDaysAgo }
      }).populate('user', 'name fcmToken');

      console.log(`📊 Found ${veryInactiveUsers.length} very inactive users for morning reminders`);

      let remindersSent = 0;
      const morningMessages = [
        {
          title: '☀️ Good Morning, Learner!',
          body: 'Start your day with English practice. Your partners miss you!'
        },
        {
          title: '🌅 Morning English Boost',
          body: 'A quick chat can energize your whole day!'
        },
        {
          title: '💪 Get Back to Practice',
          body: 'Your English skills are waiting for you. Let\'s practice!'
        }
      ];

      for (const userStats of veryInactiveUsers) {
        if (userStats.user && userStats.user.fcmToken) {
          // Randomize reminder message
          const randomMessage = morningMessages[Math.floor(Math.random() * morningMessages.length)];
          
          await pushNotificationService.sendToUser(userStats.user._id, {
            title: randomMessage.title,
            body: randomMessage.body,
            channelId: 'reminders',
            data: {
              type: 'morning_reminder',
              timestamp: new Date().toISOString()
            }
          });

          remindersSent++;
          
          // Rate limit: Wait 200ms between sends for morning reminders
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      console.log(`🌅 Sent ${remindersSent} morning practice reminders`);
      
    } catch (error) {
      console.error('❌ Error sending morning reminders:', error);
    }
  }

  /**
   * Send custom reminder to specific user
   */
  async sendCustomReminder(userId, message) {
    try {
      await pushNotificationService.sendToUser(userId, {
        title: '🎯 Custom Reminder',
        body: message,
        channelId: 'reminders',
        data: {
          type: 'custom_reminder',
          timestamp: new Date().toISOString()
        }
      });

      console.log(`📤 Sent custom reminder to user ${userId}`);
      
    } catch (error) {
      console.error('❌ Error sending custom reminder:', error);
    }
  }

  /**
   * Update user's last active time
   */
  async updateUserActivity(userId) {
    try {
      await UserStats.findOneAndUpdate(
        { user: userId },
        { lastActiveAt: new Date() },
        { upsert: true }
      );
    } catch (error) {
      console.error('❌ Error updating user activity:', error);
    }
  }

  /**
   * Stop the reminder service
   */
  stop() {
    this.isRunning = false;
    console.log('⏹️ Daily reminder service stopped');
  }
}

// Create singleton instance
const dailyReminderService = new DailyReminderService();

module.exports = dailyReminderService;

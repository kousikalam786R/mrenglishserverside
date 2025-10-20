const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const pushNotificationService = require('../utils/pushNotificationService');

/**
 * @route   POST /api/notifications/token
 * @desc    Register FCM token for push notifications
 * @access  Private
 */
router.post('/token', protect, async (req, res) => {
  try {
    const { fcmToken } = req.body;
    
    if (!fcmToken) {
      return res.status(400).json({
        success: false,
        message: 'FCM token is required'
      });
    }
    
    console.log(`Registering FCM token for user ${req.user.id}`);
    
    const result = await pushNotificationService.updateUserToken(
      req.user.id,
      fcmToken
    );
    
    res.status(200).json(result);
  } catch (error) {
    console.error('Error registering FCM token:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update FCM token',
      error: error.message
    });
  }
});

/**
 * @route   DELETE /api/notifications/token
 * @desc    Remove FCM token (on logout)
 * @access  Private
 */
router.delete('/token', protect, async (req, res) => {
  try {
    console.log(`Removing FCM token for user ${req.user.id}`);
    
    const result = await pushNotificationService.removeUserToken(req.user.id);
    
    res.status(200).json(result);
  } catch (error) {
    console.error('Error removing FCM token:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove FCM token',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/notifications/test
 * @desc    Send test notification to current user
 * @access  Private
 */
router.post('/test', protect, async (req, res) => {
  try {
    console.log(`Sending test notification to user ${req.user.id}`);
    
    const result = await pushNotificationService.sendToUser(
      req.user.id,
      {
        title: 'Test Notification',
        body: 'This is a test notification from MrEnglish',
        channelId: 'notifications',
        data: {
          type: 'test',
          timestamp: new Date().toISOString()
        }
      }
    );
    
    res.status(200).json(result);
  } catch (error) {
    console.error('Error sending test notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test notification',
      error: error.message
    });
  }
});

module.exports = router;


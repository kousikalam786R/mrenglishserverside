// This file provides access to the onlineUsers map used in server.js

// Creating a mutable reference to the online users map
// This will be updated by server.js
let onlineUsersMapRef = new Map();

// Map to track which users are ready to talk
let readyToTalkUsersRef = new Map();

/**
 * Set the online users map reference
 * This should be called from server.js when initializing
 * @param {Map} onlineUsersMap - The Map object tracking online users
 */
exports.setOnlineUsersMap = (onlineUsersMap) => {
  onlineUsersMapRef = onlineUsersMap;
};

/**
 * Get the current online users map
 * @returns {Map} The map of online user IDs to socket IDs
 */
exports.getOnlineUsersMap = () => {
  return onlineUsersMapRef;
};

/**
 * Set a user's ready to talk status
 * @param {string} userId - The user ID
 * @param {boolean} isReady - Whether the user is ready to talk
 * @param {Object} userData - Additional user data (optional)
 */
exports.setUserReadyToTalk = (userId, isReady, userData = {}) => {
  if (isReady) {
    readyToTalkUsersRef.set(userId, {
      readySince: new Date(),
      ...userData
    });
  } else {
    readyToTalkUsersRef.delete(userId);
  }
};

/**
 * Check if a user is ready to talk
 * @param {string} userId - The user ID
 * @returns {boolean} Whether the user is ready to talk
 */
exports.isUserReadyToTalk = (userId) => {
  return readyToTalkUsersRef.has(userId);
};

/**
 * Get all users who are ready to talk
 * @returns {Map} The map of user IDs to ready status data
 */
exports.getReadyToTalkUsers = () => {
  return readyToTalkUsersRef;
};

/**
 * Clear the ready to talk status for a user
 * @param {string} userId - The user ID
 */
exports.clearUserReadyToTalk = (userId) => {
  readyToTalkUsersRef.delete(userId);
};

/**
 * Get the socket ID for a user
 * @param {string} userId - The user ID
 * @returns {string|null} The socket ID or null if not found
 */
exports.getUserSocketId = (userId) => {
  return onlineUsersMapRef.get(userId.toString()) || null;
}; 
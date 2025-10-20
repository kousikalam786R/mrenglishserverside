/**
 * Partner Matching Queue System
 * 
 * Manages a queue of users looking for conversation partners
 * and matches them based on availability and preferences
 */

class PartnerMatchingQueue {
  constructor() {
    // Queue of users waiting to be matched
    this.waitingUsers = new Map(); // userId -> { userId, socketId, userData, timestamp, preferences }
    
    // Currently matched pairs
    this.matchedPairs = new Map(); // userId -> partnerId
    
    // Timeout for waiting users (remove after 60 seconds)
    this.TIMEOUT_MS = 60000;
  }

  /**
   * Add a user to the waiting queue
   */
  addToQueue(userId, socketId, userData = {}, preferences = {}) {
    console.log(`Adding user ${userId} to matching queue`);
    
    // Remove user if already in queue
    this.removeFromQueue(userId);
    
    // Add user to queue
    this.waitingUsers.set(userId, {
      userId,
      socketId,
      userData: {
        name: userData.name,
        profilePic: userData.profilePic,
        level: userData.level,
        country: userData.country,
        gender: userData.gender
      },
      preferences: {
        level: preferences.level || null,
        gender: preferences.gender || null,
        country: preferences.country || null
      },
      timestamp: Date.now()
    });
    
    console.log(`Queue size: ${this.waitingUsers.size}`);
    
    // Try to find a match immediately
    return this.findMatch(userId);
  }

  /**
   * Remove a user from the waiting queue
   */
  removeFromQueue(userId) {
    if (this.waitingUsers.has(userId)) {
      console.log(`Removing user ${userId} from matching queue`);
      this.waitingUsers.delete(userId);
    }
  }

  /**
   * Find a match for a user
   */
  findMatch(userId) {
    const currentUser = this.waitingUsers.get(userId);
    
    if (!currentUser) {
      console.log(`User ${userId} not in queue`);
      return null;
    }
    
    console.log(`Looking for match for user ${userId}`);
    
    // Find a suitable partner
    for (const [potentialPartnerId, potentialPartner] of this.waitingUsers) {
      // Skip self
      if (potentialPartnerId === userId) {
        continue;
      }
      
      // Check if this is a good match
      if (this.isGoodMatch(currentUser, potentialPartner)) {
        console.log(`Found match: ${userId} <-> ${potentialPartnerId}`);
        
        // Remove both users from queue
        this.removeFromQueue(userId);
        this.removeFromQueue(potentialPartnerId);
        
        // Add to matched pairs
        this.matchedPairs.set(userId, potentialPartnerId);
        this.matchedPairs.set(potentialPartnerId, userId);
        
        return {
          user1: currentUser,
          user2: potentialPartner
        };
      }
    }
    
    console.log(`No match found for user ${userId} yet`);
    return null;
  }

  /**
   * Check if two users are a good match based on preferences
   */
  isGoodMatch(user1, user2) {
    // Check user1's preferences against user2
    if (user1.preferences.level && user2.userData.level) {
      if (user1.preferences.level !== user2.userData.level) {
        return false;
      }
    }
    
    if (user1.preferences.gender && user2.userData.gender) {
      if (user1.preferences.gender !== user2.userData.gender) {
        return false;
      }
    }
    
    if (user1.preferences.country && user2.userData.country) {
      if (user1.preferences.country !== user2.userData.country) {
        return false;
      }
    }
    
    // Check user2's preferences against user1
    if (user2.preferences.level && user1.userData.level) {
      if (user2.preferences.level !== user1.userData.level) {
        return false;
      }
    }
    
    if (user2.preferences.gender && user1.userData.gender) {
      if (user2.preferences.gender !== user1.userData.gender) {
        return false;
      }
    }
    
    if (user2.preferences.country && user1.userData.country) {
      if (user2.preferences.country !== user1.userData.country) {
        return false;
      }
    }
    
    // If all checks pass, it's a good match
    return true;
  }

  /**
   * Get current queue status
   */
  getQueueStatus() {
    return {
      waitingUsers: this.waitingUsers.size,
      matchedPairs: this.matchedPairs.size / 2,
      users: Array.from(this.waitingUsers.values()).map(u => ({
        userId: u.userId,
        name: u.userData.name,
        waitingTime: Date.now() - u.timestamp
      }))
    };
  }

  /**
   * Clean up expired users from queue
   */
  cleanupExpiredUsers() {
    const now = Date.now();
    const expiredUsers = [];
    
    for (const [userId, user] of this.waitingUsers) {
      if (now - user.timestamp > this.TIMEOUT_MS) {
        expiredUsers.push(userId);
      }
    }
    
    expiredUsers.forEach(userId => {
      console.log(`Removing expired user ${userId} from queue`);
      this.removeFromQueue(userId);
    });
    
    return expiredUsers;
  }

  /**
   * Remove a matched pair
   */
  removeMatchedPair(userId) {
    const partnerId = this.matchedPairs.get(userId);
    
    if (partnerId) {
      this.matchedPairs.delete(userId);
      this.matchedPairs.delete(partnerId);
    }
  }

  /**
   * Get partner for a user
   */
  getPartner(userId) {
    return this.matchedPairs.get(userId);
  }
}

// Create singleton instance
const matchingQueue = new PartnerMatchingQueue();

// Clean up expired users every 10 seconds
setInterval(() => {
  matchingQueue.cleanupExpiredUsers();
}, 10000);

module.exports = matchingQueue;


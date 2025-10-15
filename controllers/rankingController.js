const CallHistory = require('../models/CallHistory');
const User = require('../models/User');
const mongoose = require('mongoose');

/**
 * Get user rankings based on call duration
 * Points are calculated based on call duration in seconds
 * Only answered calls are counted
 */
exports.getRankings = async (req, res) => {
  try {
    const { period } = req.query; // 'today', 'week', 'month'
    
    // Calculate date range based on period
    const now = new Date();
    let startDate;
    
    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        break;
      case 'week':
        // Get start of current week (Monday)
        const dayOfWeek = now.getDay();
        const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        startDate = new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    }
    
    console.log(`Getting rankings for ${period} starting from ${startDate}`);
    
    // Aggregate call durations by user
    const rankings = await CallHistory.aggregate([
      {
        // Only consider answered calls within the date range
        $match: {
          status: 'answered',
          startTime: { $gte: startDate },
          duration: { $gt: 0 }
        }
      },
      {
        // Create a document for each participant (caller and receiver)
        $facet: {
          callers: [
            {
              $group: {
                _id: '$caller',
                totalDuration: { $sum: '$duration' }
              }
            }
          ],
          receivers: [
            {
              $group: {
                _id: '$receiver',
                totalDuration: { $sum: '$duration' }
              }
            }
          ]
        }
      },
      {
        // Combine callers and receivers
        $project: {
          users: { $concatArrays: ['$callers', '$receivers'] }
        }
      },
      {
        $unwind: '$users'
      },
      {
        // Group by user ID and sum durations
        $group: {
          _id: '$users._id',
          totalDuration: { $sum: '$users.totalDuration' }
        }
      },
      {
        // Sort by total duration (highest first)
        $sort: { totalDuration: -1 }
      },
      {
        // Limit to top 100 users
        $limit: 100
      }
    ]);
    
    // Populate user details
    const rankedUsers = await Promise.all(
      rankings.map(async (ranking, index) => {
        const user = await User.findById(ranking._id).select('name profilePic country');
        
        if (!user) return null;
        
        return {
          id: user._id.toString(),
          name: user.name,
          avatar: user.profilePic || `https://randomuser.me/api/portraits/men/${(index + 1) % 50}.jpg`,
          score: ranking.totalDuration, // Duration in seconds as score
          level: getLevel(ranking.totalDuration), // Calculate level based on total duration
          rank: index + 1,
          country: user.country || 'Unknown'
        };
      })
    );
    
    // Filter out null values (users that weren't found)
    const validRankings = rankedUsers.filter(user => user !== null);
    
    return res.status(200).json({
      success: true,
      period,
      rankings: validRankings
    });
  } catch (error) {
    console.error('Error getting rankings:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Server error while fetching rankings' 
    });
  }
};

/**
 * Get current user's ranking and stats
 */
exports.getMyRanking = async (req, res) => {
  try {
    const userId = req.user.id;
    const { period } = req.query; // 'today', 'week', 'month'
    
    // Calculate date range based on period
    const now = new Date();
    let startDate;
    
    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        break;
      case 'week':
        const dayOfWeek = now.getDay();
        const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        startDate = new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    }
    
    // Convert userId to ObjectId for aggregation
    const userObjectId = new mongoose.Types.ObjectId(userId);
    
    // Get user's total duration
    const userCalls = await CallHistory.aggregate([
      {
        $match: {
          status: 'answered',
          startTime: { $gte: startDate },
          duration: { $gt: 0 },
          $or: [
            { caller: userObjectId },
            { receiver: userObjectId }
          ]
        }
      },
      {
        $group: {
          _id: null,
          totalDuration: { $sum: '$duration' },
          totalCalls: { $sum: 1 }
        }
      }
    ]);
    
    const myStats = userCalls[0] || { totalDuration: 0, totalCalls: 0 };
    
    // Get count of users with higher duration (to calculate rank)
    const higherRanked = await CallHistory.aggregate([
      {
        $match: {
          status: 'answered',
          startTime: { $gte: startDate },
          duration: { $gt: 0 }
        }
      },
      {
        $facet: {
          callers: [
            {
              $group: {
                _id: '$caller',
                totalDuration: { $sum: '$duration' }
              }
            }
          ],
          receivers: [
            {
              $group: {
                _id: '$receiver',
                totalDuration: { $sum: '$duration' }
              }
            }
          ]
        }
      },
      {
        $project: {
          users: { $concatArrays: ['$callers', '$receivers'] }
        }
      },
      {
        $unwind: '$users'
      },
      {
        $group: {
          _id: '$users._id',
          totalDuration: { $sum: '$users.totalDuration' }
        }
      },
      {
        $match: {
          totalDuration: { $gt: myStats.totalDuration }
        }
      },
      {
        $count: 'count'
      }
    ]);
    
    const myRank = (higherRanked[0]?.count || 0) + 1;
    
    // Get user details
    const user = await User.findById(userId).select('name profilePic country');
    
    return res.status(200).json({
      success: true,
      period,
      myRanking: {
        id: userId,
        name: user.name,
        avatar: user.profilePic || 'https://randomuser.me/api/portraits/men/1.jpg',
        score: myStats.totalDuration,
        level: getLevel(myStats.totalDuration),
        rank: myRank,
        totalCalls: myStats.totalCalls,
        country: user.country || 'Unknown'
      }
    });
  } catch (error) {
    console.error('Error getting my ranking:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Server error while fetching your ranking' 
    });
  }
};

/**
 * Helper function to determine user level based on total duration
 * @param {number} totalDuration - Total call duration in seconds
 * @returns {string} - User level
 */
function getLevel(totalDuration) {
  // Convert seconds to minutes
  const totalMinutes = Math.floor(totalDuration / 60);
  
  if (totalMinutes < 60) {
    return 'Beginner';
  } else if (totalMinutes < 300) {
    return 'Intermediate';
  } else {
    return 'Advanced';
  }
}

module.exports = exports;


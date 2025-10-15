# Ranking System Implementation

## Overview
This document describes the implementation of a real-time ranking system for the MR English app based on call duration data stored in the database.

## Database Schema
The ranking system uses the existing `CallHistory` collection which tracks:
- `caller` and `receiver` (User references)
- `duration` (in seconds)
- `status` (only 'answered' calls are counted)
- `startTime` (used to filter by time period)

## API Endpoints

### 1. GET `/api/rankings?period={period}`
Get rankings for all users for a specific time period.

**Query Parameters:**
- `period`: `today` | `week` | `month`

**Response:**
```json
{
  "success": true,
  "period": "today",
  "rankings": [
    {
      "id": "user_id",
      "name": "User Name",
      "avatar": "profile_pic_url",
      "score": 3600,  // Duration in seconds
      "level": "Advanced",
      "rank": 1,
      "country": "USA"
    }
  ]
}
```

### 2. GET `/api/rankings/me?period={period}`
Get current user's ranking and statistics.

**Query Parameters:**
- `period`: `today` | `week` | `month`

**Response:**
```json
{
  "success": true,
  "period": "today",
  "myRanking": {
    "id": "user_id",
    "name": "User Name",
    "avatar": "profile_pic_url",
    "score": 1800,
    "level": "Intermediate",
    "rank": 5,
    "totalCalls": 10,
    "country": "USA"
  }
}
```

## Ranking Calculation

### Score Calculation
- **Score = Total Call Duration** (in seconds) for answered calls only
- Both caller and receiver get credit for the same call duration

### Level Determination
Based on total call duration:
- **Beginner**: < 60 minutes
- **Intermediate**: 60 - 300 minutes
- **Advanced**: > 300 minutes

### Time Periods
- **Today**: From 00:00:00 of current day
- **Week**: From Monday 00:00:00 of current week
- **Month**: From 1st day 00:00:00 of current month

## Frontend Implementation

### RankingScreen Component
Located at: `mrenglish/app/screens/RankingScreen.tsx`

**Features:**
1. **Tab Navigation**: Switch between Today/Week/Month rankings
2. **My Ranking Card**: Displays user's current position prominently
3. **Leaderboard List**: Shows top 100 users with:
   - Gold/Silver/Bronze badges for top 3
   - User avatar, name, and level
   - Talk time (formatted as "Xm Ys")
4. **Pull to Refresh**: Update rankings manually
5. **Loading States**: Spinner while fetching data
6. **Empty States**: Helpful message when no data available

**Score Display:**
- Scores are displayed as talk time (e.g., "45m 30s")
- Previously showed raw points, now shows actual speaking time

## Server-Side Files

### New Files Created:
1. **`controllers/rankingController.js`**
   - Handles ranking calculation and API logic
   - Uses MongoDB aggregation for efficient queries

2. **`routes/rankingRoutes.js`**
   - Defines ranking API endpoints
   - Applies authentication middleware

### Modified Files:
1. **`server.js`**
   - Added ranking routes: `app.use('/api/rankings', require('./routes/rankingRoutes'))`

## How It Works

### Data Aggregation Pipeline:
1. **Match Stage**: Filter answered calls within date range
2. **Facet Stage**: Separate callers and receivers
3. **Group Stage**: Sum durations for each user ID
4. **Combine Stage**: Merge caller and receiver data
5. **Final Group**: Sum total duration per user
6. **Sort**: Order by total duration (descending)
7. **Limit**: Top 100 users

### Authentication
All ranking endpoints are protected with JWT authentication middleware.

## Testing the System

### Prerequisites:
1. Users must have made calls (with status 'answered')
2. Calls must have valid duration (> 0 seconds)
3. Server must be running with MongoDB connected

### Test Steps:
1. Make some test calls between users
2. Ensure calls are answered (not rejected/missed)
3. Let calls run for at least a few seconds
4. Navigate to Rankings screen in the app
5. Try switching between Today/Week/Month tabs
6. Pull to refresh to update data

### Sample Data:
To add test data, you can run calls through the app or manually insert call records:
```javascript
await CallHistory.create({
  caller: userId1,
  receiver: userId2,
  startTime: new Date(),
  endTime: new Date(Date.now() + 60000), // 1 minute later
  duration: 60, // 60 seconds
  status: 'answered',
  isVideoCall: false
});
```

## Performance Considerations

### Optimizations:
1. **Indexes**: Ensure indexes on `CallHistory.startTime` and `CallHistory.status`
2. **Caching**: Consider caching rankings for frequently accessed periods
3. **Limit Results**: Only fetch top 100 to keep queries fast
4. **Parallel Queries**: Fetch user's ranking and leaderboard simultaneously

### Recommended Indexes:
```javascript
// In CallHistory model or MongoDB shell
db.callhistories.createIndex({ startTime: -1, status: 1 });
db.callhistories.createIndex({ caller: 1, startTime: -1 });
db.callhistories.createIndex({ receiver: 1, startTime: -1 });
```

## Future Enhancements

### Possible Improvements:
1. **Real-time Updates**: Use WebSockets to update rankings live
2. **Achievements**: Badge system for milestones
3. **Streaks**: Track consecutive days of calling
4. **Language Pairs**: Separate rankings by language combinations
5. **Topics**: Rankings per conversation topic
6. **Leaderboard Filters**: Filter by country, level, etc.
7. **Historical Data**: Charts showing progress over time
8. **Rewards**: Points/coins for top performers

## Troubleshooting

### Issue: Rankings not showing
**Solution**: 
- Check if users have made answered calls
- Verify MongoDB connection
- Check server logs for errors

### Issue: Scores are 0
**Solution**:
- Ensure calls have valid duration
- Check that `status` is 'answered' not 'missed' or 'rejected'
- Verify `startTime` and `endTime` are set correctly

### Issue: My ranking not showing
**Solution**:
- User must have at least one answered call
- Check authentication token is valid
- Verify user ID is correct

## Conclusion

The ranking system provides gamification to encourage users to practice English more frequently. It's based on real usage data (call duration) and updates in real-time as users make more calls.


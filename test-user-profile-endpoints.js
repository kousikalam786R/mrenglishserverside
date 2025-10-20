/**
 * Test script for User Profile Endpoints
 * 
 * This script tests the endpoints used by the UserProfileScreen
 * to ensure real data is being returned correctly.
 */

const BASE_URL = 'http://localhost:5000/api';

// You'll need to replace this with a valid JWT token from your app
const AUTH_TOKEN = 'YOUR_JWT_TOKEN_HERE';

// Test user ID - replace with an actual user ID from your database
const TEST_USER_ID = 'USER_ID_HERE';

/**
 * Test the user profile endpoint
 */
async function testGetUserProfile() {
  console.log('\n=== Testing User Profile Endpoint ===');
  console.log(`GET ${BASE_URL}/auth/users/${TEST_USER_ID}`);
  
  try {
    const response = await fetch(`${BASE_URL}/auth/users/${TEST_USER_ID}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Success!');
      console.log('\nUser Data:');
      console.log('- ID:', data._id);
      console.log('- Name:', data.name);
      console.log('- Email:', data.email);
      console.log('- Age:', data.age || 'Not set');
      console.log('- Gender:', data.gender || 'Not set');
      console.log('- Country:', data.country || 'Not set');
      console.log('- Native Language:', data.nativeLanguage || 'Not set');
      console.log('- English Level:', data.englishLevel || 'Not set');
      console.log('- Profile Pic:', data.profilePic ? 'Yes' : 'No');
      console.log('- Bio:', data.bio || 'Not set');
      console.log('- Interests:', data.interests?.length || 0);
      return data;
    } else {
      console.log('❌ Failed!');
      console.log('Status:', response.status);
      console.log('Error:', data);
      return null;
    }
  } catch (error) {
    console.log('❌ Error!');
    console.log('Message:', error.message);
    return null;
  }
}

/**
 * Test the rating summary endpoint
 */
async function testGetRatingSummary() {
  console.log('\n=== Testing Rating Summary Endpoint ===');
  console.log(`GET ${BASE_URL}/ratings/summary/${TEST_USER_ID}`);
  
  try {
    const response = await fetch(`${BASE_URL}/ratings/summary/${TEST_USER_ID}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Success!');
      console.log('\nRating Summary:');
      console.log('- Total Ratings:', data.data.stats.totalRatings);
      console.log('- Average Rating:', data.data.stats.averageRating.toFixed(2));
      console.log('- Positive Feedback:', data.data.stats.positiveFeedback);
      console.log('- Negative Feedback:', data.data.stats.negativeFeedback);
      console.log('- Satisfaction %:', data.data.stats.satisfactionPercentage);
      console.log('- Total Calls:', data.data.stats.totalCalls);
      console.log('- Total Hours:', data.data.stats.totalHours);
      console.log('- Total Minutes:', data.data.stats.totalMinutes);
      
      console.log('\nCompliments:');
      const topCompliments = data.data.compliments.filter(c => c.count > 0).slice(0, 5);
      if (topCompliments.length > 0) {
        topCompliments.forEach(c => {
          console.log(`  - ${c._id}: ${c.count}`);
        });
      } else {
        console.log('  No compliments yet');
      }
      
      console.log('\nRecent Ratings:');
      console.log(`  ${data.data.recentRatings.length} recent ratings found`);
      
      console.log('\nRecent Feedback:');
      console.log(`  ${data.data.recentFeedback.length} recent feedback items found`);
      
      return data.data;
    } else {
      console.log('❌ Failed!');
      console.log('Status:', response.status);
      console.log('Error:', data);
      return null;
    }
  } catch (error) {
    console.log('❌ Error!');
    console.log('Message:', error.message);
    return null;
  }
}

/**
 * Test creating a rating (optional - comment out if you don't want to create test data)
 */
async function testCreateRating(targetUserId, rating = 5, comment = 'Great conversation partner!') {
  console.log('\n=== Testing Create Rating Endpoint ===');
  console.log(`POST ${BASE_URL}/ratings/submit`);
  
  try {
    const response = await fetch(`${BASE_URL}/ratings/submit`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: targetUserId,
        rating: rating,
        comment: comment,
        interactionType: 'call'
      })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Rating created successfully!');
      console.log('Rating ID:', data.rating._id);
      return data;
    } else {
      console.log('❌ Failed!');
      console.log('Status:', response.status);
      console.log('Error:', data);
      return null;
    }
  } catch (error) {
    console.log('❌ Error!');
    console.log('Message:', error.message);
    return null;
  }
}

/**
 * Test creating feedback (optional - comment out if you don't want to create test data)
 */
async function testCreateFeedback(targetUserId, feedbackType = 'positive') {
  console.log('\n=== Testing Create Feedback Endpoint ===');
  console.log(`POST ${BASE_URL}/ratings/feedback`);
  
  try {
    const response = await fetch(`${BASE_URL}/ratings/feedback`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: targetUserId,
        feedbackType: feedbackType,
        message: 'Test feedback message',
        interactionType: 'call'
      })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Feedback created successfully!');
      console.log('Feedback ID:', data.feedback._id);
      return data;
    } else {
      console.log('❌ Failed!');
      console.log('Status:', response.status);
      console.log('Error:', data);
      return null;
    }
  } catch (error) {
    console.log('❌ Error!');
    console.log('Message:', error.message);
    return null;
  }
}

/**
 * Test creating a compliment (optional - comment out if you don't want to create test data)
 */
async function testCreateCompliment(targetUserId, complimentType = 'Great speaking partner') {
  console.log('\n=== Testing Create Compliment Endpoint ===');
  console.log(`POST ${BASE_URL}/ratings/compliment`);
  
  try {
    const response = await fetch(`${BASE_URL}/ratings/compliment`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: targetUserId,
        complimentType: complimentType,
        interactionType: 'call'
      })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Compliment created successfully!');
      console.log('Compliment ID:', data.compliment._id);
      return data;
    } else {
      console.log('❌ Failed!');
      console.log('Status:', response.status);
      console.log('Error:', data);
      return null;
    }
  } catch (error) {
    console.log('❌ Error!');
    console.log('Message:', error.message);
    return null;
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('========================================');
  console.log('User Profile Endpoints Test Suite');
  console.log('========================================');
  
  if (AUTH_TOKEN === 'YOUR_JWT_TOKEN_HERE' || TEST_USER_ID === 'USER_ID_HERE') {
    console.log('\n⚠️  WARNING: Please update AUTH_TOKEN and TEST_USER_ID in this file first!');
    console.log('You can get a token by logging into the app and checking AsyncStorage or network logs.');
    return;
  }
  
  // Test fetching user profile
  const userProfile = await testGetUserProfile();
  
  // Test fetching rating summary
  const ratingSummary = await testGetRatingSummary();
  
  // Uncomment these if you want to create test data:
  // await testCreateRating(TEST_USER_ID, 5, 'Excellent conversation!');
  // await testCreateFeedback(TEST_USER_ID, 'positive');
  // await testCreateCompliment(TEST_USER_ID, 'Great speaking partner');
  
  console.log('\n========================================');
  console.log('Test Suite Complete');
  console.log('========================================\n');
}

// Run the tests
runAllTests();



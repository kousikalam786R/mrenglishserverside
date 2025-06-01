const axios = require('axios');
const readline = require('readline');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Base URL for the API
const baseURL = 'http://localhost:5000/api';

// Function to test the /ai/chat endpoint
async function testAIChat(token) {
  try {
    console.log('\n=== Testing /api/ai/chat endpoint ===');
    
    // Define the request data
    const requestData = {
      message: "Hello, this is a test message",
      conversationId: null,
      options: {
        languageLevel: "intermediate",
        topic: "general"
      }
    };
    
    console.log('Request data:', JSON.stringify(requestData, null, 2));
    
    // Make the API request
    const response = await axios.post(`${baseURL}/ai/chat`, requestData, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('\nResponse status:', response.status);
    console.log('Response data:', JSON.stringify(response.data, null, 2));
    console.log('\n✅ AI Chat endpoint test completed successfully!');
    
    return response.data;
  } catch (error) {
    console.error('\n❌ Error testing AI Chat endpoint:');
    
    if (error.response) {
      // The server responded with a status code outside the 2xx range
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received. Server might be down or unreachable.');
    } else {
      // Something happened in setting up the request
      console.error('Error message:', error.message);
    }
    
    console.error('\nFull error:', error);
    throw error;
  }
}

// Function to test the server health check
async function testHealthCheck() {
  try {
    console.log('\n=== Testing server health ===');
    const response = await axios.get(`${baseURL}`);
    console.log('Server health check response:', response.data);
    console.log('✅ Server is running correctly!');
    return true;
  } catch (error) {
    console.error('❌ Server health check failed:', error.message);
    return false;
  }
}

// Main function to run all tests
async function runTests() {
  try {
    // First test if the server is running
    const serverRunning = await testHealthCheck();
    
    if (!serverRunning) {
      console.error('⛔ Cannot proceed with tests - server is not running.');
      rl.close();
      return;
    }
    
    // Ask for JWT token
    rl.question('\nEnter your JWT token: ', async (token) => {
      if (!token) {
        console.error('❌ No token provided. Cannot test authenticated endpoints.');
        rl.close();
        return;
      }
      
      // Test the AI chat endpoint
      await testAIChat(token);
      
      console.log('\n=== All tests completed ===');
      rl.close();
    });
  } catch (error) {
    console.error('Test execution failed:', error);
    rl.close();
  }
}

// Run the tests
runTests(); 
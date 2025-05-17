// WebRTC Connection Test Script
// This script simulates WebRTC audio call connection between two users
// To be used with Thunder Client

const axios = require('axios');
const { io } = require('socket.io-client');

const API_URL = 'http://localhost:3000/api';  // Adjust this to your API URL
let user1Token = process.env.TEST_USER1_TOKEN;
let user2Token = process.env.TEST_USER2_TOKEN;
let user1Id = process.env.TEST_USER1_ID;
let user2Id = process.env.TEST_USER2_ID;
let user1Socket, user2Socket;
let callHistoryId;

// Test callbacks for tracking events
const testResults = {
  user1Connected: false,
  user2Connected: false,
  offerCreated: false,
  offerSent: false,
  offerReceived: false,
  answerCreated: false,
  answerSent: false,
  answerReceived: false,
  iceCandidatesExchanged: false,
  connectionEstablished: false
};

// Simulate WebRTC process
async function runTest() {
  try {
    console.log('== WEBRTC CONNECTION TEST STARTING ==');
    
    // Check if we have tokens
    if (!user1Token || !user2Token || !user1Id || !user2Id) {
      console.log('Using environment variables for test parameters');
      // If no tokens provided, try creating or logging in users
      await createOrLoginUsers();
    } else {
      console.log('Using provided tokens and IDs');
      console.log(`User 1 ID: ${user1Id}`);
      console.log(`User 2 ID: ${user2Id}`);
    }
    
    // Step 2: Establish socket connections
    await connectSockets();
    
    // Step 3: Set up event listeners for WebRTC signaling
    setupSocketListeners();
    
    // Step 4: Initiate call from user1 to user2
    initiateCall();
    
    // Wait for test to complete
    setTimeout(checkTestResults, 15000);
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

// Create or login test users
async function createOrLoginUsers() {
  console.log('\n== CREATING/LOGGING IN TEST USERS ==');
  
  try {
    // User 1
    const user1 = await axios.post(`${API_URL}/auth/login`, {
      email: 'testuser1@example.com',
      password: 'password123'
    });
    
    if (user1.data && user1.data.token) {
      user1Token = user1.data.token;
      user1Id = user1.data.user._id;
      console.log('User 1 logged in successfully');
    } else {
      // If login fails, try to register
      const registerUser1 = await axios.post(`${API_URL}/auth/register`, {
        name: 'Test User 1',
        email: 'testuser1@example.com',
        password: 'password123'
      });
      
      user1Token = registerUser1.data.token;
      user1Id = registerUser1.data.user._id;
      console.log('User 1 registered successfully');
    }
    
    // User 2 
    const user2 = await axios.post(`${API_URL}/auth/login`, {
      email: 'testuser2@example.com',
      password: 'password123'
    });
    
    if (user2.data && user2.data.token) {
      user2Token = user2.data.token;
      user2Id = user2.data.user._id;
      console.log('User 2 logged in successfully');
    } else {
      // If login fails, try to register
      const registerUser2 = await axios.post(`${API_URL}/auth/register`, {
        name: 'Test User 2',
        email: 'testuser2@example.com',
        password: 'password123'
      });
      
      user2Token = registerUser2.data.token;
      user2Id = registerUser2.data.user._id;
      console.log('User 2 registered successfully');
    }
    
    console.log('Both users ready for testing');
    console.log(`User 1 ID: ${user1Id}`);
    console.log(`User 2 ID: ${user2Id}`);
    
  } catch (error) {
    console.error('Error creating/logging in users:', error.message);
    throw error;
  }
}

// Connect sockets for both users
async function connectSockets() {
  console.log('\n== CONNECTING SOCKETS ==');
  
  return new Promise((resolve, reject) => {
    try {
      // Connect User 1 socket
      user1Socket = io('http://localhost:3000', {
        auth: { token: user1Token },
        transports: ['websocket']
      });
      
      user1Socket.on('connect', () => {
        console.log('User 1 socket connected');
        testResults.user1Connected = true;
        
        // Connect User 2 socket after User 1 is connected
        user2Socket = io('http://localhost:3000', {
          auth: { token: user2Token },
          transports: ['websocket']
        });
        
        user2Socket.on('connect', () => {
          console.log('User 2 socket connected');
          testResults.user2Connected = true;
          resolve();
        });
        
        user2Socket.on('connect_error', (error) => {
          console.error('User 2 socket connection error:', error.message);
          reject(error);
        });
      });
      
      user1Socket.on('connect_error', (error) => {
        console.error('User 1 socket connection error:', error.message);
        reject(error);
      });
      
    } catch (error) {
      console.error('Error connecting sockets:', error.message);
      reject(error);
    }
  });
}

// Set up socket event listeners for WebRTC signaling
function setupSocketListeners() {
  console.log('\n== SETTING UP SOCKET LISTENERS ==');
  
  // User 1 Listeners (Caller)
  user1Socket.on('call-offer-sent', (data) => {
    console.log('Call offer sent from User 1 to User 2');
    testResults.offerSent = true;
    
    if (data.callHistoryId) {
      callHistoryId = data.callHistoryId;
      console.log(`Call History ID: ${callHistoryId}`);
    }
  });
  
  user1Socket.on('call-answer', (data) => {
    console.log('User 1 received answer from User 2');
    testResults.answerReceived = true;
    
    if (data.accepted) {
      console.log('Call was accepted!');
      
      // Simulate exchanging ICE candidates
      simulateIceCandidateExchange();
    } else {
      console.log('Call was rejected');
    }
  });
  
  // User 2 Listeners (Receiver)
  user2Socket.on('call-offer', (data) => {
    console.log('User 2 received call offer from User 1');
    testResults.offerReceived = true;
    
    // Simulate accepting the call with a delay
    setTimeout(() => {
      console.log('User 2 accepting the call...');
      
      // Send call answer
      user2Socket.emit('call-answer', {
        targetUserId: data.callerId,
        sdp: 'test_answer_sdp',
        type: 'answer',
        accepted: true,
        callHistoryId: data.callHistoryId
      });
      
      testResults.answerCreated = true;
      testResults.answerSent = true;
    }, 1500);
  });
  
  // ICE candidate listeners
  user1Socket.on('call-ice-candidate', (data) => {
    console.log('User 1 received ICE candidate from User 2');
  });
  
  user2Socket.on('call-ice-candidate', (data) => {
    console.log('User 2 received ICE candidate from User 1');
  });
  
  // Call end listeners
  user1Socket.on('call-end', (data) => {
    console.log('User 1 received call end notification');
  });
  
  user2Socket.on('call-end', (data) => {
    console.log('User 2 received call end notification');
  });
}

// Initiate a call from User 1 to User 2
function initiateCall() {
  console.log('\n== INITIATING CALL FROM USER 1 TO USER 2 ==');
  
  setTimeout(() => {
    // Send call offer from User 1 to User 2
    user1Socket.emit('call-offer', {
      targetUserId: user2Id,
      sdp: 'test_offer_sdp',
      type: 'offer',
      isVideo: false  // Audio call
    });
    
    testResults.offerCreated = true;
    console.log('Call offer created and sent to server');
  }, 1000);
}

// Simulate ICE candidate exchange
function simulateIceCandidateExchange() {
  console.log('\n== SIMULATING ICE CANDIDATE EXCHANGE ==');
  
  // User 1 sends ICE candidate to User 2
  user1Socket.emit('call-ice-candidate', {
    targetUserId: user2Id,
    candidate: 'candidate:1234567890 1 udp 2122260223 192.168.1.1 56789 typ host',
    sdpMid: '0',
    sdpMLineIndex: 0
  });
  
  // User 2 sends ICE candidate to User 1
  user2Socket.emit('call-ice-candidate', {
    targetUserId: user1Id,
    candidate: 'candidate:0987654321 1 udp 2122260223 192.168.1.2 56790 typ host',
    sdpMid: '0',
    sdpMLineIndex: 0
  });
  
  testResults.iceCandidatesExchanged = true;
  
  // Simulate connection established
  setTimeout(() => {
    console.log('Connection established successfully between peers!');
    testResults.connectionEstablished = true;
    
    // End the call after a few seconds
    setTimeout(endCall, 3000);
  }, 2000);
}

// End the call
function endCall() {
  console.log('\n== ENDING CALL ==');
  
  user1Socket.emit('call-end', {
    targetUserId: user2Id,
    callHistoryId: callHistoryId
  });
  
  console.log('Call ended by User 1');
  
  // Clean up
  setTimeout(() => {
    user1Socket.disconnect();
    user2Socket.disconnect();
    console.log('Sockets disconnected');
    console.log('\n== TEST COMPLETE ==');
  }, 1000);
}

// Check and display test results
function checkTestResults() {
  console.log('\n== TEST RESULTS ==');
  console.log('User 1 Connected:', testResults.user1Connected);
  console.log('User 2 Connected:', testResults.user2Connected);
  console.log('Offer Created:', testResults.offerCreated);
  console.log('Offer Sent:', testResults.offerSent);
  console.log('Offer Received by User 2:', testResults.offerReceived);
  console.log('Answer Created:', testResults.answerCreated);
  console.log('Answer Sent:', testResults.answerSent);
  console.log('Answer Received by User 1:', testResults.answerReceived);
  console.log('ICE Candidates Exchanged:', testResults.iceCandidatesExchanged);
  console.log('Connection Established:', testResults.connectionEstablished);
  
  // Overall result
  const success = Object.values(testResults).every(value => value === true);
  console.log('\nTest Result:', success ? 'SUCCESS! 🎉' : 'FAILED ❌');
  
  if (!success) {
    console.log('\nFailed steps:');
    Object.entries(testResults).forEach(([key, value]) => {
      if (!value) console.log(`- ${key}`);
    });
  }
  
  // Exit with appropriate code
  process.exit(success ? 0 : 1);
}

// Run the test
runTest(); 
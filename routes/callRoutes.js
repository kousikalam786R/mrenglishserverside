const express = require('express');
const expressRouter = express.Router();
const auth = require('../middleware/auth');
const callController = require('../controllers/callController');
const path = require('path');
const { spawn } = require('child_process');

// Get call history for the authenticated user
expressRouter.get('/history', auth, function(req, res) {
  return callController.getCallHistory(req, res);
});

// Get call details by call ID
expressRouter.get('/details/:callId', auth, function(req, res) {
  return callController.getCallDetails(req, res);
});

// Test WebRTC connection between two users
expressRouter.post('/test-webrtc', async function(req, res) {
  try {
    const { user1Id, user1Token, user2Id, user2Token } = req.body;
    
    // Validate required parameters
    if (!user1Id || !user1Token || !user2Id || !user2Token) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required parameters' 
      });
    }

    // Set environment variables for test script
    process.env.TEST_USER1_ID = user1Id;
    process.env.TEST_USER1_TOKEN = user1Token;
    process.env.TEST_USER2_ID = user2Id;
    process.env.TEST_USER2_TOKEN = user2Token;
    
    // Run the test script
    const testProcess = spawn('node', [path.join(__dirname, '../test-webrtc-connection.js')]);
    
    let testOutput = '';
    let testError = '';
    
    // Collect output from test script
    testProcess.stdout.on('data', (data) => {
      testOutput += data.toString();
    });
    
    testProcess.stderr.on('data', (data) => {
      testError += data.toString();
    });
    
    // Handle test completion
    testProcess.on('close', (code) => {
      if (code !== 0) {
        return res.status(500).json({ 
          success: false, 
          message: 'WebRTC test failed', 
          error: testError,
          output: testOutput
        });
      }
      
      // Check test output for success
      const success = testOutput.includes('Test Result: SUCCESS');
      
      return res.status(success ? 200 : 400).json({
        success: success,
        message: success ? 'WebRTC connection test passed' : 'WebRTC connection test failed',
        output: testOutput
      });
    });
    
  } catch (error) {
    console.error('Error running WebRTC test:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error running WebRTC test',
      error: error.message
    });
  }
});

module.exports = expressRouter; 
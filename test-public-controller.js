#!/usr/bin/env node

/**
 * Direct test of the publicController.getPublicJobSeekers function
 * This will help us identify the exact issue without running the full server
 */

require('dotenv').config();
const publicController = require('./controllers/publicController');

// Mock Express request and response objects
const mockReq = {
  query: {
    page: '1',
    limit: '5'
  }
};

const mockRes = {
  json: (data) => {
    console.log('📊 API Response:');
    console.log(JSON.stringify(data, null, 2));
    process.exit(0);
  },
  status: (code) => ({
    json: (data) => {
      console.log(`❌ Error Response (${code}):`);
      console.log(JSON.stringify(data, null, 2));
      process.exit(1);
    }
  })
};

async function testController() {
  try {
    console.log('🧪 Testing publicController.getPublicJobSeekers...\n');
    await publicController.getPublicJobSeekers(mockReq, mockRes);
  } catch (error) {
    console.error('💥 Test failed with error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testController();
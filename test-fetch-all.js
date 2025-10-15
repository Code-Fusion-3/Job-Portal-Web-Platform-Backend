#!/usr/bin/env node

/**
 * Test the "fetch all" functionality for the public job seekers API
 */

require('dotenv').config();
const publicController = require('./controllers/publicController');

// Mock Express request and response objects for testing "all" parameter
const mockReqAll = {
  query: {
    all: 'true'
  }
};

const mockReqDefault = {
  query: {}
};

const mockRes = {
  json: (data) => {
    console.log('📊 API Response:');
    console.log(`Total job seekers returned: ${data.jobSeekers.length}`);
    console.log(`Pagination info:`, data.pagination);
    console.log('First few job seekers:');
    data.jobSeekers.slice(0, 3).forEach(js => {
      console.log(`- ${js.id}: ${js.firstName} ${js.lastName} (${js.city || 'No city'})`);
    });
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

async function testFetchAll() {
  try {
    console.log('🧪 Testing "fetch all" functionality...\n');
    console.log('📥 Request: ?all=true');
    await publicController.getPublicJobSeekers(mockReqAll, mockRes);
  } catch (error) {
    console.error('💥 Test failed with error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

async function testDefault() {
  try {
    console.log('🧪 Testing default (high limit) functionality...\n');
    console.log('📥 Request: no parameters (should default to limit=1000)');
    await publicController.getPublicJobSeekers(mockReqDefault, mockRes);
  } catch (error) {
    console.error('💥 Test failed with error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Test based on command line argument
const testType = process.argv[2] || 'all';
if (testType === 'all') {
  testFetchAll();
} else {
  testDefault();
}
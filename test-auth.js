const axios = require('axios');

async function testAuth() {
  try {
    console.log('Testing authentication...');
    
    // Login as admin
    const loginResponse = await axios.post('http://localhost:3000/login', {
      email: 'admin@jobportal.com',
      password: 'admin123'
    });
    
    console.log('Login successful!');
    console.log('Token:', loginResponse.data.token);
    
    // Test the requests endpoint with valid token
    const requestsResponse = await axios.get('http://localhost:3000/employer/requests', {
      headers: {
        'Authorization': `Bearer ${loginResponse.data.token}`
      }
    });
    
    console.log('Requests endpoint response:');
    console.log('Total requests:', requestsResponse.data.pagination.total);
    console.log('Requests:', requestsResponse.data.requests.length);
    
    // Show first request details
    if (requestsResponse.data.requests.length > 0) {
      const firstRequest = requestsResponse.data.requests[0];
      console.log('First request:', {
        id: firstRequest.id,
        name: firstRequest.name,
        email: firstRequest.email,
        status: firstRequest.status,
        priority: firstRequest.priority
      });
    }
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testAuth(); 
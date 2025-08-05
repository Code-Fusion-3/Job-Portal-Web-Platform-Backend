const axios = require('axios');

async function testAdminAPI() {
  try {
    console.log('🧪 Testing admin profile API...');
    
    // First, login to get a token
    console.log('🔐 Logging in as admin...');
    const loginResponse = await axios.post('http://localhost:3000/auth/login', {
      email: 'admin@jobportal.com',
      password: 'admin123'
    });
    
    const token = loginResponse.data.token;
    console.log('✅ Login successful, token received');
    
    // Test the admin profile endpoint
    console.log('📋 Fetching admin profile...');
    const profileResponse = await axios.get('http://localhost:3000/admin/profile', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✅ Admin profile API response:');
    console.log(JSON.stringify(profileResponse.data, null, 2));
    
  } catch (error) {
    console.error('❌ Error testing admin API:', error.response?.data || error.message);
  }
}

testAdminAPI(); 
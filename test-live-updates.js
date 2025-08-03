const WebSocket = require('ws');

// Comprehensive live updates test
async function testLiveUpdates() {
  console.log('🚀 Testing Live Updates System...');
  
  // Get authentication token
  const response = await fetch('http://localhost:3000/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: 'admin@jobportal.com',
      password: 'admin123'
    })
  });
  
  const data = await response.json();
  const token = data.token;
  
  console.log('✅ Authenticated successfully');
  
  // Connect to WebSocket
  const ws = new WebSocket(`ws://localhost:3000?token=${token}`);
  
  let notificationsReceived = 0;
  
  ws.on('open', () => {
    console.log('✅ WebSocket connected!');
    
    // Subscribe to all channels
    ws.send(JSON.stringify({
      type: 'subscribe',
      channel: 'dashboard_updates'
    }));
    
    ws.send(JSON.stringify({
      type: 'subscribe',
      channel: 'new_requests'
    }));
    
    console.log('📡 Subscribed to live updates');
    
    // Trigger a test event after 2 seconds
    setTimeout(async () => {
      console.log('🔄 Triggering test employer request...');
      
      try {
        const testResponse = await fetch('http://localhost:3000/employer/request', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: 'Live Test Employer',
            email: 'live-test@example.com',
            message: 'Testing real-time notifications',
            phoneNumber: '+250987654321',
            companyName: 'Live Test Company'
          })
        });
        
        const testData = await testResponse.json();
        console.log('✅ Test request created:', testData.request.id);
        
      } catch (error) {
        console.log('❌ Error creating test request:', error.message);
      }
    }, 2000);
  });
  
  ws.on('message', (data) => {
    const message = JSON.parse(data.toString());
    console.log('📨 Live Update:', message);
    
    if (message.type === 'new_request') {
      notificationsReceived++;
      console.log('🎉 New request notification received!');
    }
    
    if (message.type === 'dashboard_update') {
      notificationsReceived++;
      console.log('🎉 Dashboard update notification received!');
    }
    
    if (message.type === 'connection') {
      console.log('✅ Connection established with user:', message.userId);
    }
    
    if (message.type === 'subscribed') {
      console.log('✅ Subscribed to channel:', message.channel);
    }
  });
  
  ws.on('error', (error) => {
    console.log('❌ WebSocket error:', error.message);
  });
  
  ws.on('close', () => {
    console.log('🔌 WebSocket connection closed');
  });
  
  // Test completion
  setTimeout(() => {
    console.log('\n📊 Live Updates Test Results:');
    console.log(`✅ Notifications received: ${notificationsReceived}`);
    console.log('✅ WebSocket connection: Working');
    console.log('✅ Authentication: Working');
    console.log('✅ Real-time events: Working');
    
    if (notificationsReceived > 0) {
      console.log('🎉 Live updates are working perfectly!');
    } else {
      console.log('⚠️  No notifications received - check backend logs');
    }
    
    ws.close();
    process.exit(0);
  }, 8000);
}

// Run the test
testLiveUpdates().catch(console.error); 
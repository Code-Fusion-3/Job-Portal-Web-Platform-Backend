const WebSocket = require('ws');

// Test WebSocket connection and notifications
async function testWebSocket() {
  console.log('🧪 Testing WebSocket server...');
  
  // Get a valid token
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
  
  console.log('✅ Got authentication token');
  
  // Connect to WebSocket
  const ws = new WebSocket(`ws://localhost:3000?token=${token}`);
  
  ws.on('open', () => {
    console.log('✅ WebSocket connected and authenticated!');
    
    // Subscribe to dashboard updates
    ws.send(JSON.stringify({
      type: 'subscribe',
      channel: 'dashboard_updates'
    }));
    
    // Test ping
    setTimeout(() => {
      ws.send(JSON.stringify({type: 'ping'}));
    }, 1000);
  });
  
  ws.on('message', (data) => {
    const message = JSON.parse(data.toString());
    console.log('📨 Received:', message);
    
    if (message.type === 'pong') {
      console.log('✅ Ping/Pong working!');
    }
    
    if (message.type === 'subscribed') {
      console.log('✅ Subscription successful!');
    }
  });
  
  ws.on('error', (error) => {
    console.log('❌ WebSocket error:', error.message);
  });
  
  ws.on('close', () => {
    console.log('🔌 WebSocket closed');
  });
  
  // Keep connection alive for testing
  setTimeout(() => {
    console.log('⏰ Test completed');
    ws.close();
    process.exit(0);
  }, 10000);
}

// Run the test
testWebSocket().catch(console.error); 
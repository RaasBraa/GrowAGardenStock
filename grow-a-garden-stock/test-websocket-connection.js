import WebSocket from 'ws';

const SSE_SECRET_TOKEN = process.env.SSE_SECRET_TOKEN || '9923310a-acd2-4ebc-8d85-501e8e3f497d';
const WS_URL = `ws://103.45.246.244:8080?token=${SSE_SECRET_TOKEN}`;

console.log('🔍 Testing WebSocket Connection');
console.log('================================');
console.log(`URL: ${WS_URL}`);
console.log('');

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  console.log('✅ WebSocket connection established!');
  console.log('📡 Sending heartbeat...');
  
  // Send a heartbeat
  ws.send(JSON.stringify({
    type: 'heartbeat',
    timestamp: new Date().toISOString()
  }));
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());
    console.log('📨 Received message:', message);
    
    if (message.type === 'connected') {
      console.log('🎉 Successfully authenticated and connected!');
      console.log(`🆔 Client ID: ${message.clientId}`);
    } else if (message.type === 'heartbeat') {
      console.log('💓 Heartbeat response received');
    }
  } catch {
    console.log('📨 Received raw message:', data.toString());
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error.message);
});

ws.on('close', (code, reason) => {
  console.log(`🔌 Connection closed: ${code} ${reason}`);
});

// Close connection after 5 seconds
setTimeout(() => {
  console.log('⏰ Closing connection after 5 seconds...');
  ws.close();
  process.exit(0);
}, 5000); 
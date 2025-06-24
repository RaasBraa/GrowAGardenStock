import { jstudioWebSocket } from './src/lib/jstudio-websocket';

console.log('🚀 Starting Grow A Garden Stock - WebSocket Only');
console.log('📡 JStudio WebSocket is the ONLY data source');
console.log('⚡ Real-time updates with incremental merging');
console.log('');

// Start the WebSocket listener
async function startWebSocket() {
  try {
    console.log('🔗 Connecting to JStudio WebSocket...');
    await jstudioWebSocket.start();
    
    console.log('');
    console.log('✅ WebSocket listener started successfully!');
    console.log('📊 Real-time stock updates are now active');
    console.log('🌐 API endpoint: http://localhost:3000/api/stock');
    console.log('');
    console.log('💡 The WebSocket will automatically:');
    console.log('   • Connect to JStudio for real-time updates');
    console.log('   • Process incremental stock data (seeds, gear, eggs, cosmetics)');
    console.log('   • Merge updates without overwriting other categories');
    console.log('   • Detect active weather changes');
    console.log('   • Save merged data to stock-data.json');
    console.log('   • Serve data via /api/stock endpoint');
    console.log('');
    console.log('🔄 Reconnection is automatic if connection is lost');
    console.log('📱 Your mobile app will get instant updates!');
    
  } catch (error) {
    console.error('❌ Failed to start WebSocket listener:', error);
    console.log('💡 Make sure your internet connection is working');
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down WebSocket listener...');
  jstudioWebSocket.stop();
  console.log('✅ WebSocket listener stopped');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down WebSocket listener...');
  jstudioWebSocket.stop();
  console.log('✅ WebSocket listener stopped');
  process.exit(0);
});

// Start the WebSocket
startWebSocket(); 
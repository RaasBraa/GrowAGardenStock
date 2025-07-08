import { stockEventEmitter } from './src/lib/stock-events.js';
import { broadcastStockUpdate } from './src/app/api/stock-updates/route.js';

console.log('🧪 Testing SSE System...\n');

// Test 1: Check if stock event emitter is working
console.log('📡 Test 1: Stock Event Emitter');
let eventReceived = false;

stockEventEmitter.onUpdate((data) => {
  console.log('✅ Event received:', data);
  eventReceived = true;
});

// Emit a test event
stockEventEmitter.emit({
  type: 'stock_update',
  source: 'websocket',
  category: 'seeds',
  stockId: 'test-123',
  timestamp: new Date().toISOString()
});

if (eventReceived) {
  console.log('✅ Stock event emitter is working correctly\n');
} else {
  console.log('❌ Stock event emitter is not working\n');
}

// Test 2: Check if broadcast function exists
console.log('📡 Test 2: Broadcast Function');
if (typeof broadcastStockUpdate === 'function') {
  console.log('✅ Broadcast function exists');
  
  // Test broadcasting a message
  try {
    broadcastStockUpdate({
      type: 'test_message',
      message: 'This is a test broadcast',
      timestamp: new Date().toISOString()
    });
    console.log('✅ Broadcast function executed successfully\n');
  } catch (error) {
    console.log('❌ Broadcast function error:', error.message, '\n');
  }
} else {
  console.log('❌ Broadcast function not found\n');
}

// Test 3: Check if stock manager is actually calling the emitter
console.log('📡 Test 3: Stock Manager Integration');
console.log('This test requires the stock manager to be running...');
console.log('To test this:');
console.log('1. Start your stock manager: pm2 start npm --name "grow-stock-manager" -- run start-stock-manager');
console.log('2. Connect to SSE endpoint: curl -N http://localhost:3000/api/stock-updates');
console.log('3. Wait for stock updates to trigger SSE messages\n');

// Test 4: Manual SSE endpoint test
console.log('📡 Test 4: Manual SSE Endpoint Test');
console.log('To test the SSE endpoint manually:');
console.log('1. Start your Next.js server');
console.log('2. Open a new terminal and run:');
console.log('   curl -N http://localhost:3000/api/stock-updates');
console.log('3. You should see connection messages and stock updates\n');

// Test 5: Check for common issues
console.log('📡 Test 5: Common Issues Check');
console.log('Common reasons why SSE might not work:');
console.log('- Stock manager not running');
console.log('- Stock manager not receiving updates from sources');
console.log('- SSE route not properly configured');
console.log('- Client not connecting to correct endpoint');
console.log('- CORS issues blocking SSE connection\n');

console.log('🔍 Debugging Steps:');
console.log('1. Check if stock manager is running: pm2 status');
console.log('2. Check stock manager logs: pm2 logs grow-stock-manager');
console.log('3. Check if stock data is being updated: cat stock-data.json');
console.log('4. Test SSE endpoint: curl -N http://localhost:3000/api/stock-updates');
console.log('5. Check browser console for SSE connection errors\n');

console.log('🎯 Next Steps:');
console.log('- Ensure stock manager is running and receiving updates');
console.log('- Verify SSE endpoint is accessible');
console.log('- Test with a real client connection');
console.log('- Check for any error messages in logs'); 
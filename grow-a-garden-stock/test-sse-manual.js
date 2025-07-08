import { stockEventEmitter } from './src/lib/stock-events.js';

console.log('🧪 Manual SSE Test\n');

// Test 1: Emit a test event
console.log('📡 Emitting test SSE event...');
stockEventEmitter.emit({
  type: 'stock_update',
  source: 'manual_test',
  category: 'seeds',
  stockId: 'manual-test-' + Date.now(),
  timestamp: new Date().toISOString()
});

console.log('✅ Test event emitted');
console.log('');

// Test 2: Emit multiple events to simulate real updates
console.log('📡 Emitting multiple test events...');

const categories = ['seeds', 'gear', 'eggs', 'cosmetics'];
const sources = ['websocket', 'cactus', 'vulcan'];

for (let i = 0; i < 5; i++) {
  const category = categories[i % categories.length];
  const source = sources[i % sources.length];
  
  stockEventEmitter.emit({
    type: 'stock_update',
    source: source,
    category: category,
    stockId: `test-${category}-${i}-${Date.now()}`,
    timestamp: new Date().toISOString()
  });
  
  console.log(`✅ Emitted ${category} update from ${source}`);
  
  // Small delay between events
  await new Promise(resolve => setTimeout(resolve, 100));
}

console.log('');
console.log('🎉 Manual SSE test completed!');
console.log('');
console.log('📋 What to check:');
console.log('1. If you have SSE clients connected, they should receive these events');
console.log('2. Check your client logs for the test events');
console.log('3. The events should appear in your frontend if connected');
console.log('');
console.log('🔍 To test with a real client:');
console.log('1. Open a new terminal and run:');
console.log('   curl -N http://localhost:3000/api/stock-updates');
console.log('2. You should see the test events appear');
console.log('3. If not, there might be an issue with the SSE route');
console.log('');
console.log('💡 If events are not reaching clients:');
console.log('- Check if SSE route is working: curl -N http://localhost:3000/api/stock-updates');
console.log('- Check if stock manager is running: pm2 status');
console.log('- Check logs: pm2 logs grow-app');
console.log('- Verify client is connecting to correct endpoint'); 
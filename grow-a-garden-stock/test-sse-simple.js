// Simple SSE test script
console.log('🧪 Simple SSE Test\n');

// Test 1: Check if we can import the stock event emitter
try {
  const { stockEventEmitter } = await import('./src/lib/stock-events.js');
  console.log('✅ Stock event emitter imported successfully');
  
  // Test emitting an event
  let eventReceived = false;
  stockEventEmitter.onUpdate((data) => {
    console.log('✅ Event received:', data);
    eventReceived = true;
  });
  
  stockEventEmitter.emit({
    type: 'stock_update',
    source: 'test',
    category: 'seeds',
    stockId: 'test-123',
    timestamp: new Date().toISOString()
  });
  
  if (eventReceived) {
    console.log('✅ Event emitter is working correctly\n');
  } else {
    console.log('❌ Event emitter is not working\n');
  }
  
} catch (error) {
  console.log('❌ Failed to import stock event emitter:', error.message, '\n');
}

// Test 2: Check if stock manager is running
console.log('📊 Checking stock manager status...');
try {
  const fs = await import('fs');
  const path = await import('path');
  
  const stockDataPath = path.resolve(process.cwd(), 'stock-data.json');
  
  if (fs.existsSync(stockDataPath)) {
    const data = JSON.parse(fs.readFileSync(stockDataPath, 'utf-8'));
    console.log('✅ Stock data file exists');
    console.log('📅 Last updated:', data.lastUpdated);
    console.log('🌱 Seeds count:', data.seeds?.items?.length || 0);
    console.log('🛠️ Gear count:', data.gear?.items?.length || 0);
    console.log('🥚 Eggs count:', data.eggs?.items?.length || 0);
  } else {
    console.log('❌ Stock data file does not exist');
    console.log('💡 This might mean the stock manager is not running\n');
  }
} catch (error) {
  console.log('❌ Error checking stock data:', error.message, '\n');
}

// Test 3: Check PM2 processes
console.log('🔍 Checking PM2 processes...');
console.log('Run these commands to check:');
console.log('pm2 status');
console.log('pm2 logs grow-stock-manager');
console.log('pm2 logs grow-app\n');

// Test 4: Manual SSE test
console.log('📡 Manual SSE Test Instructions:');
console.log('1. Start your Next.js server (if not already running)');
console.log('2. Open a new terminal and run:');
console.log('   curl -N http://localhost:3000/api/stock-updates');
console.log('3. You should see:');
console.log('   data: {"type":"connected","clientId":"...","timestamp":"...","message":"Connected to stock updates stream"}');
console.log('4. If you see this, SSE is working!');
console.log('5. If not, there might be an issue with the route\n');

// Test 5: Check if stock manager is actually updating
console.log('🔄 Stock Manager Update Test:');
console.log('To test if stock manager is receiving updates:');
console.log('1. Check if WebSocket is connected:');
console.log('   - Look for "✅ JStudio WebSocket connection established" in logs');
console.log('2. Check if Discord listeners are working:');
console.log('   - Look for "🌵 Starting Cactus Discord listener" and "🔥 Starting Vulcan Discord listener"');
console.log('3. Check for stock updates:');
console.log('   - Look for "📥 Received WebSocket stock update" in logs');
console.log('4. Check for SSE emissions:');
console.log('   - Look for "✅ Updated stock data from websocket for seeds" in logs\n');

console.log('🎯 Most Likely Issues:');
console.log('1. Stock manager not running (pm2 status)');
console.log('2. Stock manager not receiving updates from sources');
console.log('3. SSE endpoint not accessible (check Next.js server)');
console.log('4. Client not connecting to correct endpoint\n');

console.log('🔧 Quick Fixes:');
console.log('1. Restart stock manager: pm2 restart grow-stock-manager');
console.log('2. Restart Next.js server: pm2 restart grow-app');
console.log('3. Check logs: pm2 logs');
console.log('4. Test SSE endpoint: curl -N http://localhost:3000/api/stock-updates'); 
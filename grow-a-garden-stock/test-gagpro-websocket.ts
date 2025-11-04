import { WebSocket } from 'ws';

const wsUrl = 'wss://ws.growagardenpro.com/';

console.log('🔗 Connecting to GrowAGardenPro WebSocket:', wsUrl);
console.log('📋 Waiting for messages...\n');

const ws = new WebSocket(wsUrl);

let messageCount = 0;

ws.on('open', () => {
  console.log('✅ Connected to GrowAGardenPro WebSocket\n');
  console.log('⏳ Waiting for messages...\n');
});

ws.on('message', (data: Buffer) => {
  messageCount++;
  const rawMessage = data.toString();
  
  console.log('─'.repeat(80));
  console.log(`📨 Message #${messageCount}`);
  console.log('─'.repeat(80));
  
  try {
    const message = JSON.parse(rawMessage);
    
    // Pretty print the message structure
    console.log('\n📦 Full Message Structure:');
    console.log(JSON.stringify(message, null, 2));
    
    // Analyze the structure
    console.log('\n🔍 Structure Analysis:');
    console.log(`   - Has 'type' field: ${message.type !== undefined ? '✅ Yes: ' + message.type : '❌ No'}`);
    console.log(`   - Has 'data' field: ${message.data !== undefined ? '✅ Yes' : '❌ No'}`);
    
    if (message.data) {
      const data = message.data;
      console.log('\n📊 Data Fields Present:');
      console.log(`   - weather: ${data.weather !== undefined ? '✅ ' + JSON.stringify(data.weather).substring(0, 100) : '❌'}`);
      console.log(`   - seeds: ${data.seeds !== undefined ? `✅ Array with ${data.seeds.length} items` : '❌'}`);
      console.log(`   - gear: ${data.gear !== undefined ? `✅ Array with ${data.gear.length} items` : '❌'}`);
      console.log(`   - eggs: ${data.eggs !== undefined ? `✅ Array with ${data.eggs.length} items` : '❌'}`);
      console.log(`   - honey: ${data.honey !== undefined ? `✅ Array with ${data.honey.length} items` : '❌'}`);
      console.log(`   - cosmetics: ${data.cosmetics !== undefined ? `✅ Array with ${data.cosmetics.length} items` : '❌'}`);
      console.log(`   - timestamp: ${data.timestamp !== undefined ? '✅ ' + data.timestamp : '❌'}`);
      
      // Show weather structure if present
      if (data.weather) {
        console.log('\n🌤️  Weather Structure:');
        console.log(JSON.stringify(data.weather, null, 2));
      }
      
      // Show sample items if present
      if (data.seeds && data.seeds.length > 0) {
        console.log('\n🌱 Sample Seed Item:');
        console.log(JSON.stringify(data.seeds[0], null, 2));
      }
      
      if (data.gear && data.gear.length > 0) {
        console.log('\n🛠️  Sample Gear Item:');
        console.log(JSON.stringify(data.gear[0], null, 2));
      }
      
      if (data.eggs && data.eggs.length > 0) {
        console.log('\n🥚 Sample Egg Item:');
        console.log(JSON.stringify(data.eggs[0], null, 2));
      }
    } else {
      // If no data field, check if message itself has the fields
      console.log('\n📊 Message Fields (no data wrapper):');
      console.log(`   - weather: ${message.weather !== undefined ? '✅' : '❌'}`);
      console.log(`   - seeds: ${message.seeds !== undefined ? `✅ Array with ${message.seeds.length} items` : '❌'}`);
      console.log(`   - gear: ${message.gear !== undefined ? `✅ Array with ${message.gear.length} items` : '❌'}`);
    }
    
    console.log('\n');
    
    // Stop after 5 messages to avoid spam
    if (messageCount >= 5) {
      console.log('✅ Received 5 messages. Stopping...');
      console.log('💡 Summary:');
      console.log('   - Check the structure above to see the actual format');
      console.log('   - Note which fields are present and their structure');
      console.log('   - Weather format may differ from expected');
      ws.close();
      process.exit(0);
    }
    
  } catch (error) {
    console.error('❌ Error parsing message:', error);
    console.error('📄 Raw message (first 500 chars):', rawMessage.substring(0, 500));
  }
});

ws.on('error', (error: Error) => {
  console.error('❌ WebSocket error:', error);
});

ws.on('close', () => {
  console.log('\n🔌 Connection closed');
  process.exit(0);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Stopping test...');
  ws.close();
  process.exit(0);
});

// Timeout after 30 seconds if no messages
setTimeout(() => {
  if (messageCount === 0) {
    console.log('\n⏱️  No messages received after 30 seconds. Closing connection...');
    ws.close();
    process.exit(0);
  }
}, 30000);


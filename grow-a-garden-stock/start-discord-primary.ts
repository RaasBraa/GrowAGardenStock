import { initializeDiscordListener } from './src/lib/discord-listener';

console.log('🚀 Starting Grow A Garden Stock - Discord Primary');
console.log('📡 Discord is now the PRIMARY data source');
console.log('⚡ Real-time updates from Discord bot');
console.log('');

// Start the Discord listener
async function startDiscordPrimary() {
  try {
    console.log('🔗 Connecting to Discord...');
    initializeDiscordListener();
    
    console.log('');
    console.log('✅ Discord listener started successfully!');
    console.log('📊 Real-time stock updates are now active');
    console.log('🌐 API endpoint: http://103.45.246.244:3000/api/stock');
    console.log('');
    console.log('💡 The Discord listener will automatically:');
    console.log('   • Connect to Discord channels for real-time updates');
    console.log('   • Process stock data (seeds, gear, eggs, cosmetics)');
    console.log('   • Detect weather changes');
    console.log('   • Save data to stock-data.json');
    console.log('   • Serve data via /api/stock endpoint');
    console.log('   • Send push notifications to mobile app');
    console.log('');
    console.log('📱 Your mobile app will get instant updates!');
    
  } catch (error) {
    console.error('❌ Failed to start Discord listener:', error);
    console.log('💡 Make sure your Discord bot token and channel IDs are set correctly');
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Discord listener...');
  console.log('✅ Discord listener stopped');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down Discord listener...');
  console.log('✅ Discord listener stopped');
  process.exit(0);
});

// Start the Discord listener
startDiscordPrimary(); 
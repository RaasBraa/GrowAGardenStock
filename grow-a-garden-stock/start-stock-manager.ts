import { stockManager } from './src/lib/stock-manager';

console.log('🚀 Starting Grow A Garden Stock - Multi-Source Stock Manager');
console.log('📡 Coordinating JStudio WebSocket, Cactus Discord, and Vulcan Discord');
console.log('⚡ Smart source prioritization and data validation');
console.log('');

// Start the stock manager
async function startStockManager() {
  try {
    console.log('🔗 Starting multi-source coordination...');
    await stockManager.start();
    
    console.log('');
    console.log('✅ Stock Manager started successfully!');
    console.log('📊 Multi-source coordination is now active');
    console.log('🌐 API endpoint: http://103.45.246.244:3000/api/stock');
    console.log('');
    console.log('💡 The Stock Manager will automatically:');
    console.log('   • Prioritize JStudio WebSocket as primary source (99% uptime)');
    console.log('   • Use Cactus Discord as backup 1 (faster updates)');
    console.log('   • Use Vulcan Discord as backup 2 (last resort)');
    console.log('   • Validate data consistency between sources');
    console.log('   • Prevent duplicate notifications');
    console.log('   • Handle travelling merchant updates');
    console.log('   • Save data to stock-data.json');
    console.log('   • Serve data via /api/stock endpoint');
    console.log('   • Send push notifications to mobile app');
    console.log('');
    console.log('📱 Your mobile app will get instant updates!');
    console.log('🔍 Data validation and source monitoring active');
    
  } catch (error) {
    console.error('❌ Failed to start Stock Manager:', error);
    console.log('💡 Make sure your environment variables are set correctly');
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Stock Manager...');
  stockManager.stop();
  console.log('✅ Stock Manager stopped');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down Stock Manager...');
  stockManager.stop();
  console.log('✅ Stock Manager stopped');
  process.exit(0);
});

// Start the stock manager
startStockManager(); 
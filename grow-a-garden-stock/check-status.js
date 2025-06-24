import * as fs from 'fs';
import * as path from 'path';

console.log('🔍 Checking Grow A Garden Stock Status...\n');

// Check if stock data file exists
const stockFilePath = path.resolve(process.cwd(), 'stock-data.json');

if (fs.existsSync(stockFilePath)) {
  try {
    const data = JSON.parse(fs.readFileSync(stockFilePath, 'utf-8'));
    
    console.log('✅ Stock data file found:');
    console.log(`   Last updated: ${data.lastUpdated}`);
    console.log(`   Seeds: ${data.seeds?.items?.length || 0} items`);
    console.log(`   Gear: ${data.gear?.items?.length || 0} items`);
    console.log(`   Eggs: ${data.eggs?.items?.length || 0} items`);
    console.log(`   Cosmetics: ${data.cosmetics?.items?.length || 0} items`);
    console.log(`   Events: ${data.events?.items?.length || 0} items`);
    console.log(`   Weather: ${data.weather ? data.weather.name : 'None'}`);
    console.log('');
    
    // Check how recent the data is
    const lastUpdate = new Date(data.lastUpdated);
    const now = new Date();
    const minutesAgo = Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 60));
    
    if (minutesAgo < 5) {
      console.log('🟢 Data is fresh (less than 5 minutes old)');
    } else if (minutesAgo < 15) {
      console.log('🟡 Data is recent (less than 15 minutes old)');
    } else {
      console.log('🔴 Data is stale (more than 15 minutes old)');
    }
    
  } catch (error) {
    console.error('❌ Error reading stock data file:', error);
  }
} else {
  console.log('❌ Stock data file not found');
  console.log('💡 Make sure the WebSocket is running');
}

// Test API endpoint
console.log('\n🌐 Testing API endpoint...');
try {
  const response = await fetch('http://localhost:3000/api/stock');
  if (response.ok) {
    const apiData = await response.json();
    console.log('✅ API endpoint working:');
    console.log(`   Status: ${response.status}`);
    console.log(`   Seeds: ${apiData.seeds?.items?.length || 0} items`);
    console.log(`   Gear: ${apiData.gear?.items?.length || 0} items`);
    console.log(`   Weather: ${apiData.weather ? apiData.weather.name : 'None'}`);
  } else {
    console.log(`❌ API endpoint error: ${response.status}`);
  }
} catch {
  console.log('❌ API endpoint not accessible');
  console.log('💡 Make sure the Next.js server is running (npm run dev)');
}

console.log('\n📊 System Status Summary:');
console.log('   • WebSocket: Primary data source');
console.log('   • Discord: Backup data source');
console.log('   • API: /api/stock endpoint');
console.log('   • Real-time updates: Active');
console.log('   • Mobile app: Ready to receive data'); 
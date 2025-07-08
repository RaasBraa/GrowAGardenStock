import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🔍 SSE System Diagnostic\n');

// Function to run command and return output
function runCommand(command) {
  try {
    return execSync(command, { encoding: 'utf8' });
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

// Check 1: PM2 Status
console.log('📊 1. PM2 Process Status:');
const pm2Status = runCommand('pm2 status');
console.log(pm2Status);
console.log('');

// Check 2: Stock Manager Logs (last 20 lines)
console.log('📝 2. Stock Manager Logs (last 20 lines):');
const stockManagerLogs = runCommand('pm2 logs grow-stock-manager --lines 20 --nostream');
console.log(stockManagerLogs);
console.log('');

// Check 3: Next.js App Logs (last 10 lines)
console.log('🌐 3. Next.js App Logs (last 10 lines):');
const nextAppLogs = runCommand('pm2 logs grow-app --lines 10 --nostream');
console.log(nextAppLogs);
console.log('');

// Check 4: Stock Data File
console.log('📄 4. Stock Data File Status:');
const stockDataPath = path.resolve(process.cwd(), 'stock-data.json');
if (fs.existsSync(stockDataPath)) {
  const stats = fs.statSync(stockDataPath);
  const data = JSON.parse(fs.readFileSync(stockDataPath, 'utf-8'));
  console.log('✅ Stock data file exists');
  console.log(`📅 Last modified: ${stats.mtime}`);
  console.log(`📅 Last updated: ${data.lastUpdated}`);
  console.log(`🌱 Seeds: ${data.seeds?.items?.length || 0} items`);
  console.log(`🛠️ Gear: ${data.gear?.items?.length || 0} items`);
  console.log(`🥚 Eggs: ${data.eggs?.items?.length || 0} items`);
} else {
  console.log('❌ Stock data file does not exist');
}
console.log('');

// Check 5: Test SSE Endpoint
console.log('📡 5. Testing SSE Endpoint:');
console.log('Testing connection to SSE endpoint...');
try {
  const response = execSync('curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/stock-updates', { encoding: 'utf8' });
  if (response.trim() === '200') {
    console.log('✅ SSE endpoint is accessible (HTTP 200)');
  } else {
    console.log(`⚠️ SSE endpoint returned HTTP ${response.trim()}`);
  }
} catch (error) {
  console.log('❌ SSE endpoint test failed:', error.message);
}
console.log('');

// Check 6: Network Ports
console.log('🌐 6. Network Port Status:');
const port3000 = runCommand('netstat -tuln | grep :3000');
console.log('Port 3000:', port3000 || 'Not listening');
console.log('');

// Check 7: Recent Stock Updates
console.log('🔄 7. Recent Stock Updates Analysis:');
const allLogs = runCommand('pm2 logs --nostream | grep -E "(Received WebSocket|Updated stock data|SSE client)" | tail -10');
if (allLogs && !allLogs.includes('Error:')) {
  console.log('Recent stock-related logs:');
  console.log(allLogs);
} else {
  console.log('No recent stock update logs found');
}
console.log('');

// Check 8: SSE Client Connections
console.log('👥 8. SSE Client Connections:');
const sseLogs = runCommand('pm2 logs --nostream | grep -E "(SSE client|stock-updates)" | tail -5');
if (sseLogs && !sseLogs.includes('Error:')) {
  console.log('Recent SSE logs:');
  console.log(sseLogs);
} else {
  console.log('No recent SSE connection logs found');
}
console.log('');

// Summary and Recommendations
console.log('🎯 DIAGNOSIS SUMMARY:');
console.log('');

// Check if stock manager is running
if (pm2Status.includes('grow-stock-manager') && pm2Status.includes('online')) {
  console.log('✅ Stock manager is running');
} else {
  console.log('❌ Stock manager is NOT running - This is likely the main issue!');
  console.log('   Fix: pm2 start npm --name "grow-stock-manager" -- run start-stock-manager');
}

// Check if Next.js is running
if (pm2Status.includes('grow-app') && pm2Status.includes('online')) {
  console.log('✅ Next.js app is running');
} else {
  console.log('❌ Next.js app is NOT running');
  console.log('   Fix: pm2 start npm --name "grow-app" -- run dev');
}

// Check if stock data is being updated
if (fs.existsSync(stockDataPath)) {
  const data = JSON.parse(fs.readFileSync(stockDataPath, 'utf-8'));
  const lastUpdate = new Date(data.lastUpdated);
  const now = new Date();
  const timeDiff = now - lastUpdate;
  
  if (timeDiff < 300000) { // Less than 5 minutes
    console.log('✅ Stock data is being updated (recent)');
  } else {
    console.log('⚠️ Stock data is stale (not updating)');
    console.log('   This suggests the stock manager is not receiving updates');
  }
} else {
  console.log('❌ No stock data file found');
}

console.log('');
console.log('🔧 RECOMMENDED ACTIONS:');
console.log('');

if (!pm2Status.includes('grow-stock-manager') || !pm2Status.includes('online')) {
  console.log('1. Start stock manager:');
  console.log('   pm2 start npm --name "grow-stock-manager" -- run start-stock-manager');
  console.log('');
}

if (!pm2Status.includes('grow-app') || !pm2Status.includes('online')) {
  console.log('2. Start Next.js app:');
  console.log('   pm2 start npm --name "grow-app" -- run dev');
  console.log('');
}

console.log('3. Test SSE manually:');
console.log('   curl -N http://localhost:3000/api/stock-updates');
console.log('');

console.log('4. Monitor logs:');
console.log('   pm2 logs --follow');
console.log('');

console.log('5. Check for specific errors:');
console.log('   pm2 logs grow-stock-manager --lines 50');
console.log('   pm2 logs grow-app --lines 20');
console.log('');

console.log('💡 Most Common Issues:');
console.log('- Stock manager not running');
console.log('- WebSocket connection failing');
console.log('- Discord bot tokens invalid');
console.log('- SSE endpoint not accessible');
console.log('- Client not connecting to correct URL'); 
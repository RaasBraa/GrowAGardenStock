import fetch from 'node-fetch';
import dns from 'dns';
import { promisify } from 'util';

const lookup = promisify(dns.lookup);

async function testConnectivity() {
  console.log('🌐 Testing network connectivity to OneSignal...\n');

  // Test 1: DNS Resolution
  console.log('1️⃣ Testing DNS resolution...');
  try {
    const result = await lookup('onesignal.com');
    console.log(`   ✅ DNS Resolution: ${result.address} (${result.family === 4 ? 'IPv4' : 'IPv6'})`);
  } catch (error) {
    console.log(`   ❌ DNS Resolution failed: ${error.message}`);
  }

  // Test 2: HTTP Connectivity
  console.log('\n2️⃣ Testing HTTP connectivity...');
  try {
    const startTime = Date.now();
    const response = await fetch('https://onesignal.com', {
      method: 'HEAD',
      timeout: 10000
    });
    const endTime = Date.now();
    console.log(`   ✅ HTTP Response: ${response.status} ${response.statusText}`);
    console.log(`   ⏱️ Response time: ${endTime - startTime}ms`);
  } catch (error) {
    console.log(`   ❌ HTTP connectivity failed: ${error.message}`);
  }

  // Test 3: OneSignal API Endpoint
  console.log('\n3️⃣ Testing OneSignal API endpoint...');
  try {
    const startTime = Date.now();
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'OPTIONS',
      timeout: 15000
    });
    const endTime = Date.now();
    console.log(`   ✅ API Endpoint: ${response.status} ${response.statusText}`);
    console.log(`   ⏱️ Response time: ${endTime - startTime}ms`);
  } catch (error) {
    console.log(`   ❌ API endpoint failed: ${error.message}`);
  }

  // Test 4: Environment Variables
  console.log('\n4️⃣ Checking OneSignal configuration...');
  const appId = process.env.ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_API_KEY;
  
  console.log(`   App ID: ${appId ? '✅ Set' : '❌ Missing'}`);
  console.log(`   API Key: ${apiKey ? '✅ Set' : '❌ Missing'}`);
  
  if (appId && apiKey) {
    console.log(`   API Key format: ${apiKey.substring(0, 10)}...`);
  }

  // Test 5: Network Timeout Test
  console.log('\n5️⃣ Testing with different timeouts...');
  const timeouts = [5000, 10000, 15000, 30000];
  
  for (const timeout of timeouts) {
    try {
      const startTime = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch('https://onesignal.com/api/v1/notifications', {
        method: 'OPTIONS',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      const endTime = Date.now();
      console.log(`   ✅ ${timeout}ms timeout: ${response.status} (${endTime - startTime}ms)`);
      break; // Success, no need to test longer timeouts
    } catch (error) {
      console.log(`   ❌ ${timeout}ms timeout: ${error.message}`);
    }
  }

  console.log('\n🏁 Network connectivity test completed!');
}

// Run the test
testConnectivity().catch(console.error); 
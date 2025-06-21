const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const BASE_URL = 'http://localhost:3000/api';

async function testPushAPI() {
  console.log('Testing Push Notification API...\n');

  // Test 1: Register valid token
  console.log('1. Testing token registration with valid token...');
  try {
    const response = await fetch(`${BASE_URL}/register-push-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'ExponentPushToken[test123456789012345678901234567890]' })
    });
    const data = await response.json();
    console.log(`Status: ${response.status}, Response:`, data);
  } catch (error) {
    console.error('Error:', error.message);
  }

  // Test 2: Register invalid token
  console.log('\n2. Testing token registration with invalid token...');
  try {
    const response = await fetch(`${BASE_URL}/register-push-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'invalid-token' })
    });
    const data = await response.json();
    console.log(`Status: ${response.status}, Response:`, data);
  } catch (error) {
    console.error('Error:', error.message);
  }

  // Test 3: Unregister token
  console.log('\n3. Testing token unregistration...');
  try {
    const response = await fetch(`${BASE_URL}/unregister-push-token`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'ExponentPushToken[test123456789012345678901234567890]' })
    });
    const data = await response.json();
    console.log(`Status: ${response.status}, Response:`, data);
  } catch (error) {
    console.error('Error:', error.message);
  }

  // Test 4: Check if push-tokens.json was created
  console.log('\n4. Checking if push-tokens.json was created...');
  const fs = require('fs');
  const path = require('path');
  const tokensPath = path.resolve(process.cwd(), 'push-tokens.json');
  
  if (fs.existsSync(tokensPath)) {
    const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf-8'));
    console.log('push-tokens.json exists with tokens:', tokens);
  } else {
    console.log('push-tokens.json does not exist yet');
  }
}

testPushAPI().catch(console.error); 
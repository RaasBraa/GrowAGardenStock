#!/usr/bin/env node

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env.local') });

const API_BASE_URL = 'http://localhost:3000/api';

async function testRateLimiting() {
  console.log('🧪 Testing Rate Limiting for Preference Updates...\n');

  // Test token (you can replace this with a real token from your database)
  const testToken = process.env.TEST_TOKEN || 'test-token-123';
  
  // Test preferences
  const testPreferences = {
    "carrot": true,
    "strawberry": false,
    "romanesco": true
  };

  console.log('📱 Test Token:', testToken);
  console.log('⚙️ Test Preferences:', testPreferences);
  console.log('⏱️ Rate Limit: 30 seconds between updates\n');

  try {
    // First update - should succeed
    console.log('🔄 Test 1: First preference update (should succeed)');
    const response1 = await fetch(`${API_BASE_URL}/update-push-preferences`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token: testToken,
        preferences: testPreferences
      })
    });

    const result1 = await response1.json();
    console.log(`   Status: ${response1.status}`);
    console.log(`   Response:`, result1);
    console.log('');

    if (response1.status === 200) {
      console.log('✅ First update successful!\n');
      
      // Wait 5 seconds
      console.log('⏳ Waiting 5 seconds...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Second update - should fail due to rate limiting
      console.log('🔄 Test 2: Second preference update (should fail - rate limited)');
      const response2 = await fetch(`${API_BASE_URL}/update-push-preferences`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: testToken,
          preferences: { ...testPreferences, "blueberry": true }
        })
      });

      const result2 = await response2.json();
      console.log(`   Status: ${response2.status}`);
      console.log(`   Response:`, result2);
      console.log('');

      if (response2.status === 429) {
        console.log('✅ Rate limiting working correctly!');
        console.log(`   Seconds remaining: ${result2.secondsRemaining}`);
        console.log(`   Retry after: ${result2.retryAfter}`);
      } else {
        console.log('❌ Rate limiting not working - second update succeeded when it should have failed');
      }
    } else {
      console.log('❌ First update failed:', result1);
    }

  } catch (error) {
    console.error('❌ Error during testing:', error.message);
  }

  console.log('\n🧪 Rate limiting test completed!');
}

// Run the test
testRateLimiting().catch(console.error);

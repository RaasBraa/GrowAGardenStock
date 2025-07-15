#!/usr/bin/env node

/**
 * Test Script for OneSignal - Send to ALL Subscribers
 * 
 * This script sends test notifications to ALL OneSignal subscribers directly.
 * It bypasses the local push-tokens.json and sends to everyone subscribed to your OneSignal app.
 * Run with: npx tsx test-onesignal-all-devices.ts
 */

import * as path from 'path';
import * as readline from 'readline';

// Load environment variables
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// OneSignal configuration
const ONESIGNAL_APP_ID = '7a3f0ef9-af93-4481-93e1-375183500d50';
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;

async function sendToAllOneSignalSubscribers(
  title: string, 
  message: string, 
  data?: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  
  if (!ONESIGNAL_API_KEY) {
    return { success: false, error: 'OneSignal API key not configured' };
  }

  try {
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${ONESIGNAL_API_KEY}`
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        included_segments: ['All'], // Send to ALL subscribers
        headings: { en: title },
        contents: { en: message },
        data: data || {}
      })
    });

    const result = await response.json();

    if (response.ok) {
      console.log(`✅ Notification sent successfully!`);
      console.log(`   ID: ${result.id}`);
      console.log(`   Recipients: ${result.recipients || 'All subscribers'}`);
      return { success: true };
    } else {
      console.error(`❌ OneSignal API error:`, result);
      return { success: false, error: result.errors?.join(', ') || 'Unknown error' };
    }

  } catch (error) {
    console.error(`❌ Network error:`, (error as Error).message);
    return { success: false, error: (error as Error).message };
  }
}

async function testAllOneSignalSubscribers(): Promise<void> {
  console.log('🚀 Starting OneSignal Test - Sending to ALL Subscribers...\n');

  // Check if OneSignal API key is configured
  if (!ONESIGNAL_API_KEY) {
    console.error('❌ ONESIGNAL_API_KEY not found in .env.local');
    console.log('Please add: ONESIGNAL_API_KEY=your_rest_api_key_here');
    process.exit(1);
  }

  console.log('✅ OneSignal API key found');
  console.log(`📱 App ID: ${ONESIGNAL_APP_ID}`);
  console.log('🎯 Target: ALL OneSignal subscribers\n');

  try {
    // Test 1: Item Notification
    console.log('🧪 Test 1: Sending Item Notification (Carrot)');
    console.log('   Sending notification for Carrot seed availability...');
    const result1 = await sendToAllOneSignalSubscribers(
      '🌱 Carrot in Stock!',
      'Carrot seeds are now available! Quantity: 5',
      { itemName: 'Carrot', quantity: 5, category: 'seeds', type: 'item_alert' }
    );
    if (result1.success) console.log('   ✅ Item notification sent\n');
    else console.log(`   ❌ Failed: ${result1.error}\n`);

    // Wait 3 seconds between tests
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Test 2: Weather Alert
    console.log('🌤️  Test 2: Sending Weather Alert');
    console.log('   Sending weather alert notification...');
    const result2 = await sendToAllOneSignalSubscribers(
      '🌤️ Weather Alert: Sunny',
      'Perfect weather for gardening! Get out there and plant some seeds!',
      { weatherType: 'Sunny', type: 'weather_alert' }
    );
    if (result2.success) console.log('   ✅ Weather alert sent\n');
    else console.log(`   ❌ Failed: ${result2.error}\n`);

    // Wait 3 seconds between tests
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Test 3: Category Notification
    console.log('📦 Test 3: Sending Category Notification (Seeds)');
    console.log('   Sending seeds category update notification...');
    const result3 = await sendToAllOneSignalSubscribers(
      '📦 New Seeds Available!',
      'Fresh seeds have arrived in stock! Check out the new selection.',
      { category: 'Seeds', type: 'category_alert' }
    );
    if (result3.success) console.log('   ✅ Category notification sent\n');
    else console.log(`   ❌ Failed: ${result3.error}\n`);

    // Wait 3 seconds between tests
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Test 4: Rare Item Alert
    console.log('💎 Test 4: Sending Rare Item Alert');
    console.log('   Sending rare item notification...');
    const result4 = await sendToAllOneSignalSubscribers(
      '💎 Rare Item Alert!',
      'Godly Sprinkler is now in stock! Only 1 available - get it while you can!',
      { itemName: 'Godly Sprinkler', quantity: 1, category: 'gear', type: 'rare_item_alert' }
    );
    if (result4.success) console.log('   ✅ Rare item notification sent\n');
    else console.log(`   ❌ Failed: ${result4.error}\n`);

    console.log('🎉 All test notifications completed!');
    console.log('\n📱 Check ALL your OneSignal subscribers for the following notifications:');
    console.log('   1. 🌱 Carrot seed availability (5 in stock)');
    console.log('   2. 🌤️  Weather alert (Sunny weather)');
    console.log('   3. 📦 Seeds category update');
    console.log('   4. 💎 Godly Sprinkler rare item alert');
    console.log('\n💡 Note: These notifications were sent to ALL OneSignal subscribers,');
    console.log('   not just devices registered in your local push-tokens.json file.');

  } catch (error) {
    console.error('❌ Error during testing:', (error as Error).message);
  }
}

// Interactive test menu
async function showTestMenu(): Promise<void> {
  console.log('\n🔧 OneSignal Test Menu - ALL Subscribers');
  console.log('==========================================');
  console.log('1. Run all tests');
  console.log('2. Test item notification only');
  console.log('3. Test weather alert only');
  console.log('4. Test category notification only');
  console.log('5. Test rare item alert only');
  console.log('6. Custom notification');
  console.log('7. Exit');
  console.log('');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('Select an option (1-7): ', async (answer) => {
    rl.close();
    
    try {
      switch (answer.trim()) {
        case '1':
          await testAllOneSignalSubscribers();
          break;
        case '2':
          console.log('🧪 Sending item notification to all subscribers...');
          await sendToAllOneSignalSubscribers(
            '🌱 Carrot in Stock!',
            'Carrot seeds are now available! Quantity: 5',
            { itemName: 'Carrot', quantity: 5, category: 'seeds', type: 'item_alert' }
          );
          console.log('✅ Item notification sent to all subscribers');
          break;
        case '3':
          console.log('🌤️  Sending weather alert to all subscribers...');
          await sendToAllOneSignalSubscribers(
            '🌤️ Weather Alert: Sunny',
            'Perfect weather for gardening! Get out there and plant some seeds!',
            { weatherType: 'Sunny', type: 'weather_alert' }
          );
          console.log('✅ Weather alert sent to all subscribers');
          break;
        case '4':
          console.log('📦 Sending category notification to all subscribers...');
          await sendToAllOneSignalSubscribers(
            '📦 New Seeds Available!',
            'Fresh seeds have arrived in stock! Check out the new selection.',
            { category: 'Seeds', type: 'category_alert' }
          );
          console.log('✅ Category notification sent to all subscribers');
          break;
        case '5':
          console.log('💎 Sending rare item alert to all subscribers...');
          await sendToAllOneSignalSubscribers(
            '💎 Rare Item Alert!',
            'Godly Sprinkler is now in stock! Only 1 available - get it while you can!',
            { itemName: 'Godly Sprinkler', quantity: 1, category: 'gear', type: 'rare_item_alert' }
          );
          console.log('✅ Rare item alert sent to all subscribers');
          break;
        case '6':
          console.log('📝 Custom notification to all subscribers...');
          const customRl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
          });
          
          customRl.question('Enter notification title: ', async (title) => {
            customRl.question('Enter notification message: ', async (message) => {
              customRl.close();
              await sendToAllOneSignalSubscribers(title, message);
              console.log('✅ Custom notification sent to all subscribers');
            });
          });
          break;
        case '7':
          console.log('👋 Goodbye!');
          process.exit(0);
          break;
        default:
          console.log('❌ Invalid option. Please run the script again.');
          process.exit(1);
      }
    } catch (error) {
      console.error('❌ Error:', (error as Error).message);
    }
  });
}

// Check if running with --menu flag
if (process.argv.includes('--menu')) {
  showTestMenu();
} else {
  // Run all tests by default
  testAllOneSignalSubscribers();
}

export { testAllOneSignalSubscribers, sendToAllOneSignalSubscribers }; 
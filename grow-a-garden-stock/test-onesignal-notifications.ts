#!/usr/bin/env node

/**
 * Test Script for OneSignal Notifications
 * 
 * This script sends test notifications to all registered OneSignal devices.
 * Run with: npx tsx test-onesignal-notifications.ts
 */

import * as path from 'path';
import * as readline from 'readline';

// Load environment variables
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Import the OneSignal notification service
import { 
  sendItemNotification, 
  sendWeatherAlertNotification, 
  sendCategoryNotification,
  getTokenStats 
} from './src/lib/onesignal-notifications';

async function testOneSignalNotifications(): Promise<void> {
  console.log('🚀 Starting OneSignal Notification Tests...\n');

  // Check if OneSignal API key is configured
  if (!process.env.ONESIGNAL_API_KEY) {
    console.error('❌ ONESIGNAL_API_KEY not found in .env.local');
    console.log('Please add: ONESIGNAL_API_KEY=your_rest_api_key_here');
    process.exit(1);
  }

  console.log('✅ OneSignal API key found');
  console.log('📊 Getting current token statistics...\n');

  try {
    // Get current statistics
    const stats = getTokenStats();
    console.log('📈 Current Device Statistics:');
    console.log(`   Total devices: ${stats.total}`);
    console.log(`   Active devices: ${stats.active}`);
    console.log(`   Expired devices: ${stats.expired}`);
    console.log(`   Last cleanup: ${stats.lastCleanup}\n`);

    if (stats.active === 0) {
      console.log('⚠️  No active devices found. Please register some devices first.');
      console.log('   You can test registration with: curl -X POST http://localhost:3000/api/register-push-token \\');
      console.log('     -H "Content-Type: application/json" \\');
      console.log('     -d \'{"token": "test_device", "onesignal_player_id": "your_player_id", "device_type": "ios", "preferences": {"Carrot": true}}\'');
      return;
    }

    // Test 1: Item Notification
    console.log('🧪 Test 1: Sending Item Notification (Carrot)');
    console.log('   Sending notification for Carrot seed availability...');
    await sendItemNotification('Carrot', 5, 'seeds');
    console.log('   ✅ Item notification sent\n');

    // Wait 2 seconds between tests
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 2: Weather Alert
    console.log('🌤️  Test 2: Sending Weather Alert');
    console.log('   Sending weather alert notification...');
    await sendWeatherAlertNotification('Sunny', 'Perfect weather for gardening!');
    console.log('   ✅ Weather alert sent\n');

    // Wait 2 seconds between tests
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 3: Category Notification
    console.log('📦 Test 3: Sending Category Notification (Seeds)');
    console.log('   Sending seeds category update notification...');
    await sendCategoryNotification('Seeds', 'Seeds', 'New seeds have arrived in stock!');
    console.log('   ✅ Category notification sent\n');

    // Wait 2 seconds between tests
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 4: Rare Item Alert
    console.log('💎 Test 4: Sending Rare Item Alert');
    console.log('   Sending rare item notification...');
    await sendItemNotification('Godly Sprinkler', 1, 'gear');
    console.log('   ✅ Rare item notification sent\n');

    console.log('🎉 All test notifications completed!');
    console.log('\n📱 Check your devices for the following notifications:');
    console.log('   1. 🌱 Carrot seed availability (5 in stock)');
    console.log('   2. 🌤️  Weather alert (Sunny weather)');
    console.log('   3. 📦 Seeds category update');
    console.log('   4. 💎 Godly Sprinkler rare item alert');

  } catch (error) {
    console.error('❌ Error during testing:', (error as Error).message);
    
    if ((error as Error).message.includes('OneSignal API key not configured')) {
      console.log('\n💡 Make sure your .env.local file contains:');
      console.log('   ONESIGNAL_API_KEY=your_rest_api_key_here');
    }
    
    if ((error as Error).message.includes('invalid_player_ids')) {
      console.log('\n💡 Some Player IDs may be invalid. Check your push-tokens.json file.');
    }
  }
}

// Interactive test menu
async function showTestMenu(): Promise<void> {
  console.log('\n🔧 OneSignal Notification Test Menu');
  console.log('====================================');
  console.log('1. Run all tests');
  console.log('2. Test item notification only');
  console.log('3. Test weather alert only');
  console.log('4. Test category notification only');
  console.log('5. Test rare item alert only');
  console.log('6. Show device statistics only');
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
          await testOneSignalNotifications();
          break;
        case '2':
          console.log('🧪 Sending item notification...');
          await sendItemNotification('Carrot', 5, 'seeds');
          console.log('✅ Item notification sent');
          break;
        case '3':
          console.log('🌤️  Sending weather alert...');
          await sendWeatherAlertNotification('Sunny', 'Perfect weather for gardening!');
          console.log('✅ Weather alert sent');
          break;
        case '4':
          console.log('📦 Sending category notification...');
          await sendCategoryNotification('Seeds', 'Seeds', 'New seeds have arrived in stock!');
          console.log('✅ Category notification sent');
          break;
        case '5':
          console.log('💎 Sending rare item alert...');
          await sendItemNotification('Godly Sprinkler', 1, 'gear');
          console.log('✅ Rare item alert sent');
          break;
        case '6':
          const stats = getTokenStats();
          console.log('📊 Device Statistics:');
          console.log(`   Total devices: ${stats.total}`);
          console.log(`   Active devices: ${stats.active}`);
          console.log(`   Expired devices: ${stats.expired}`);
          console.log(`   Last cleanup: ${stats.lastCleanup}`);
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
  testOneSignalNotifications();
}

export { testOneSignalNotifications }; 
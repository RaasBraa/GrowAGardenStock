import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { sendCategoryNotification, sendItemNotification } from './src/lib/onesignal-notifications-db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

console.log('🧪 Testing different notification types...\n');

async function testNotifications() {
  try {
    console.log('🔧 Environment check:');
    console.log(`  ONESIGNAL_APP_ID: ${process.env.ONESIGNAL_APP_ID ? 'Set' : 'Not set'}`);
    console.log(`  ONESIGNAL_API_KEY: ${process.env.ONESIGNAL_API_KEY ? 'Set' : 'Not set'}`);
    
    console.log('\n🧪 Test 1: Travelling Merchant notification...');
    try {
      await sendCategoryNotification('Travelling Merchant', 'Travelling Merchant', 'Test: The merchant has arrived!');
      console.log('✅ Travelling Merchant notification sent successfully!');
    } catch (error) {
      console.log('❌ Travelling Merchant notification failed:', error.message);
    }
    
    console.log('\n🧪 Test 2: Cosmetics notification...');
    try {
      await sendCategoryNotification('Cosmetics', 'Cosmetics', 'Test: New cosmetics available!');
      console.log('✅ Cosmetics notification sent successfully!');
    } catch (error) {
      console.log('❌ Cosmetics notification failed:', error.message);
    }
    
    console.log('\n🧪 Test 3: Individual item notification...');
    try {
      await sendItemNotification('Test Item', 5, 'seeds');
      console.log('✅ Individual item notification sent successfully!');
    } catch (error) {
      console.log('❌ Individual item notification failed:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Error during testing:', error);
  }
}

testNotifications().then(() => {
  console.log('\n🏁 Test completed');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
}); 
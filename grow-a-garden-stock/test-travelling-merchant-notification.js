import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { sendCategoryNotification } from './src/lib/onesignal-notifications-db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

console.log('🧪 Testing travelling merchant notification system...\n');

async function testTravellingMerchantNotification() {
  try {
    console.log('🔧 Environment check:');
    console.log(`  ONESIGNAL_APP_ID: ${process.env.ONESIGNAL_APP_ID ? 'Set' : 'Not set'}`);
    console.log(`  ONESIGNAL_API_KEY: ${process.env.ONESIGNAL_API_KEY ? 'Set' : 'Not set'}`);
    console.log(`  ONESIGNAL_ANDROID_CHANNEL_ID: ${process.env.ONESIGNAL_ANDROID_CHANNEL_ID ? 'Set' : 'Not set'}`);
    
    console.log('\n🧪 Sending test travelling merchant notification...');
    
    await sendCategoryNotification(
      'Travelling Merchant', 
      'Travelling Merchant', 
      'Test: The Gnome Traveling Merchant has arrived with new items!'
    );
    
    console.log('✅ Test travelling merchant notification sent successfully!');
    
  } catch (error) {
    console.error('❌ Error sending test notification:', error);
  }
}

testTravellingMerchantNotification().then(() => {
  console.log('\n🏁 Test completed');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
}); 
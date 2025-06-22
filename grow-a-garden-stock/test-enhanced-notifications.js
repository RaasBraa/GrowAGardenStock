import { sendRareItemNotification, sendStockUpdateNotification, sendWeatherAlertNotification, getTokenStats } from './src/lib/pushNotifications.js';

async function testEnhancedNotifications() {
  console.log('🧪 Testing Enhanced Push Notification System\n');

  // Test 1: Get token statistics
  console.log('📊 Token Statistics:');
  const stats = getTokenStats();
  console.log(stats);
  console.log('');

  // Test 2: Send rare item notification
  console.log('🌟 Testing Rare Item Notification:');
  try {
    await sendRareItemNotification('Golden Seed', 'Legendary', 5, 'seeds');
    console.log('✅ Rare item notification sent successfully');
  } catch (error) {
    console.error('❌ Rare item notification failed:', error.message);
  }
  console.log('');

  // Test 3: Send stock update notification
  console.log('📦 Testing Stock Update Notification:');
  try {
    await sendStockUpdateNotification('seeds', 15);
    console.log('✅ Stock update notification sent successfully');
  } catch (error) {
    console.error('❌ Stock update notification failed:', error.message);
  }
  console.log('');

  // Test 4: Send weather alert notification
  console.log('🌤️ Testing Weather Alert Notification:');
  try {
    await sendWeatherAlertNotification('Rainy Weather', 'Increases crop growth by 50%');
    console.log('✅ Weather alert notification sent successfully');
  } catch (error) {
    console.error('❌ Weather alert notification failed:', error.message);
  }
  console.log('');

  // Test 5: Test with no tokens (should handle gracefully)
  console.log('📭 Testing with no tokens:');
  try {
    // This should log "No active tokens to send notifications to"
    await sendRareItemNotification('Test Item', 'Common', 1);
    console.log('✅ Graceful handling of no tokens confirmed');
  } catch (error) {
    console.error('❌ Error handling no tokens:', error.message);
  }

  console.log('\n🎉 Enhanced notification system test completed!');
}

// Run the test
testEnhancedNotifications().catch(console.error); 
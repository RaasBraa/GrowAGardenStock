import { sendWeatherAlertNotification } from './src/lib/notification-manager.js';

async function testWeatherNotifications() {
  console.log('🌤️ Testing weather notifications...');
  
  // Test 1: Weather ending in 2 minutes 45 seconds
  console.log('\n📝 Test 1: Weather ending in 2m 45s');
  await sendWeatherAlertNotification('Rain', 'Ends in 2m 45s');
  
  // Test 2: Weather ending in 30 seconds
  console.log('\n📝 Test 2: Weather ending in 30 seconds');
  await sendWeatherAlertNotification('Storm', 'Ends in 30 seconds');
  
  // Test 3: Weather ending in 1 hour 30 minutes
  console.log('\n📝 Test 3: Weather ending in 1h 30m');
  await sendWeatherAlertNotification('Heatwave', 'Ends in 1h 30m');
  
  // Test 4: Weather ending now
  console.log('\n📝 Test 4: Weather ending now');
  await sendWeatherAlertNotification('Sunny', 'Ends now!');
  
  console.log('\n✅ Weather notification tests completed!');
}

testWeatherNotifications().catch(console.error); 
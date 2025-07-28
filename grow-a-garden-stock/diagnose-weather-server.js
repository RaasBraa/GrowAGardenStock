import database from './src/lib/database.js';
import { sendWeatherAlertNotification } from './src/lib/onesignal-notifications-db.js';

console.log('🔍 Diagnosing weather notification issue on server...\n');

async function diagnoseWeatherNotifications() {
  try {
    // Initialize database
    await database.initialize();
    console.log('✅ Database initialized');

    // Get all tokens
    const allTokens = await database.getTokens();
    console.log(`📊 Total tokens in database: ${allTokens.length}`);

    // Get active tokens
    const activeTokens = await database.getTokens({ is_active: true });
    console.log(`📊 Active tokens: ${activeTokens.length}`);

    // Get OneSignal tokens
    const oneSignalTokens = await database.getTokens({ device_type: 'onesignal' });
    console.log(`📊 OneSignal tokens: ${oneSignalTokens.length}`);

    // Get tokens with preferences
    const tokensWithPrefs = await database.getTokens({ has_preferences: true });
    console.log(`📊 Tokens with preferences: ${tokensWithPrefs.length}`);

    // Check weather preferences specifically
    console.log('\n🌤️ Checking weather preferences...');
    const weatherTokens = await database.getTokensForWeather();
    console.log(`🌤️ Tokens with weather enabled: ${weatherTokens.length}`);

    if (weatherTokens.length > 0) {
      console.log('\n📋 Weather-enabled tokens:');
      weatherTokens.forEach((token, index) => {
        console.log(`  ${index + 1}. Token: ${token.token.substring(0, 20)}...`);
        console.log(`     Player ID: ${token.onesignal_player_id || 'None'}`);
        console.log(`     Active: ${token.is_active}`);
        console.log(`     Preferences: ${token.preferences}`);
        console.log('');
      });
    } else {
      console.log('❌ No tokens have weather notifications enabled!');
      
      // Just show a summary instead of listing all preferences
      console.log('\n🔍 Summary of user preferences:');
      console.log(`  Total users with preferences: ${tokensWithPrefs.length}`);
      
      // Sample a few users to check weather preference format
      const sampleTokens = tokensWithPrefs.slice(0, 5);
      console.log(`  Sample of first 5 users:`);
      sampleTokens.forEach((token, index) => {
        try {
          const prefs = JSON.parse(token.preferences);
          console.log(`    ${index + 1}. Has weather: ${prefs.weather !== undefined}, Weather value: ${prefs.weather}`);
        } catch {
          console.log(`    ${index + 1}. Invalid JSON preferences`);
        }
      });
    }

    // Test sending a weather notification
    if (weatherTokens.length > 0) {
      console.log('\n🧪 Testing weather notification...');
      await sendWeatherAlertNotification('Test Weather', 'This is a test weather notification');
      console.log('✅ Weather notification test completed');
    } else {
      console.log('\n⚠️ Skipping weather notification test - no eligible users');
    }

    // Check database stats
    console.log('\n📈 Database Statistics:');
    const stats = await database.getStats();
    console.log(`  Total tokens: ${stats.total}`);
    console.log(`  Active tokens: ${stats.active}`);
    console.log(`  Inactive tokens: ${stats.inactive}`);
    console.log(`  OneSignal tokens: ${stats.onesignal}`);
    console.log(`  Tokens with preferences: ${stats.withPreferences}`);
    console.log(`  Tokens without preferences: ${stats.withoutPreferences}`);

  } catch (error) {
    console.error('❌ Error during diagnosis:', error);
  } finally {
    await database.close();
  }
}

diagnoseWeatherNotifications().then(() => {
  console.log('\n🏁 Diagnosis completed');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Diagnosis failed:', error);
  process.exit(1);
}); 
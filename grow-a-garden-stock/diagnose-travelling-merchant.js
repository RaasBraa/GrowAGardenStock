import database from './src/lib/database.js';
import { sendCategoryNotification } from './src/lib/onesignal-notifications-db.js';

console.log('🛒 Diagnosing travelling merchant notification issue...\n');

async function diagnoseTravellingMerchant() {
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

    // Check travelling merchant preferences specifically
    console.log('\n🛒 Checking travelling merchant preferences...');
    const merchantTokens = await database.getTokensForCategory('Travelling Merchant');
    console.log(`🛒 Tokens with travelling merchant enabled: ${merchantTokens.length}`);

    if (merchantTokens.length > 0) {
      console.log('\n📋 Travelling merchant enabled tokens (first 5):');
      merchantTokens.slice(0, 5).forEach((token, index) => {
        console.log(`  ${index + 1}. Token: ${token.token.substring(0, 20)}...`);
        console.log(`     Player ID: ${token.onesignal_player_id || 'None'}`);
        console.log(`     Active: ${token.is_active}`);
        console.log('');
      });
    } else {
      console.log('❌ No tokens have travelling merchant notifications enabled!');
      
      // Check what preference keys exist for travelling merchant
      console.log('\n🔍 Checking travelling merchant preference variations...');
      const merchantVariations = [
        'Travelling Merchant', 
        'travelling merchant', 
        'TRAVELLING MERCHANT',
        'TravellingMerchant',
        'travellingmerchant',
        'Traveling Merchant',
        'traveling merchant',
        'Merchant',
        'merchant'
      ];
      
      let foundMerchantUsers = 0;
      
      for (const variation of merchantVariations) {
        const usersWithMerchant = tokensWithPrefs.filter(token => {
          try {
            const prefs = JSON.parse(token.preferences);
            return prefs[variation] === true;
          } catch {
            return false;
          }
        });
        
        if (usersWithMerchant.length > 0) {
          console.log(`✅ Found ${usersWithMerchant.length} users with '${variation}': true`);
          foundMerchantUsers += usersWithMerchant.length;
        }
      }

      if (foundMerchantUsers === 0) {
        console.log('\n❌ No users have any travelling merchant variation enabled!');
        
        // Show sample of what keys users actually have
        const sampleTokens = tokensWithPrefs.slice(0, 5);
        console.log('\n📋 Sample of user preference keys:');
        sampleTokens.forEach((token, index) => {
          try {
            const prefs = JSON.parse(token.preferences);
            const merchantKeys = Object.keys(prefs).filter(key => 
              key.toLowerCase().includes('merchant') || 
              key.toLowerCase().includes('travel')
            );
            console.log(`  User ${index + 1}: ${Object.keys(prefs).join(', ')}`);
            if (merchantKeys.length > 0) {
              console.log(`    Merchant-related: ${merchantKeys.join(', ')}`);
            }
          } catch {
            console.log(`  User ${index + 1}: Invalid JSON`);
          }
        });
      }
    }

    // Test sending a travelling merchant notification
    if (merchantTokens.length > 0) {
      console.log('\n🧪 Testing travelling merchant notification...');
      await sendCategoryNotification('Travelling Merchant', 'Travelling Merchant', 'Test: The travelling merchant has arrived with new items!');
      console.log('✅ Travelling merchant notification test completed');
    } else {
      console.log('\n⚠️ Skipping travelling merchant notification test - no eligible users');
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

    // Check WebSocket data structure
    console.log('\n🌐 Checking WebSocket data structure...');
    console.log('💡 Travelling merchant data should come from WebSocket with key: travelingmerchant_stock');
    console.log('💡 Expected structure: { merchantName, items: [{ id, name, quantity, price, start_date_unix, end_date_unix }] }');

  } catch (error) {
    console.error('❌ Error during diagnosis:', error);
  } finally {
    await database.close();
  }
}

diagnoseTravellingMerchant().then(() => {
  console.log('\n🏁 Diagnosis completed');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Diagnosis failed:', error);
  process.exit(1);
}); 
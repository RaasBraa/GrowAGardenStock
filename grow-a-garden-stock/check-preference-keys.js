import database from './src/lib/database.js';

console.log('🔍 Checking user preference keys...\n');

async function checkPreferenceKeys() {
  try {
    await database.initialize();
    console.log('✅ Database initialized');

    const tokensWithPrefs = await database.getTokens({ has_preferences: true });
    console.log(`📊 Total users with preferences: ${tokensWithPrefs.length}`);

    // Sample a few users to see what keys they have
    const sampleTokens = tokensWithPrefs.slice(0, 10);
    console.log('\n📋 Sample of user preferences:');
    
    const allKeys = new Set();
    
    sampleTokens.forEach((token, index) => {
      try {
        const prefs = JSON.parse(token.preferences);
        console.log(`  User ${index + 1}:`);
        console.log(`    Keys: ${Object.keys(prefs).join(', ')}`);
        
        // Check for weather-related keys
        const weatherKeys = Object.keys(prefs).filter(key => 
          key.toLowerCase().includes('weather') || 
          key.toLowerCase().includes('climate') ||
          key.toLowerCase().includes('storm')
        );
        if (weatherKeys.length > 0) {
          console.log(`    Weather-related keys: ${weatherKeys.join(', ')}`);
        }
        
        Object.keys(prefs).forEach(key => allKeys.add(key));
        
      } catch {
        console.log(`  User ${index + 1}: Invalid JSON`);
      }
    });

    console.log('\n📊 All unique preference keys found:');
    console.log(`  ${Array.from(allKeys).sort().join(', ')}`);

    // Check if any users have weather enabled with different casing
    const weatherVariations = ['weather', 'Weather', 'WEATHER', 'Weathers', 'weathers'];
    let foundWeatherUsers = 0;
    
    for (const variation of weatherVariations) {
      const usersWithWeather = tokensWithPrefs.filter(token => {
        try {
          const prefs = JSON.parse(token.preferences);
          return prefs[variation] === true;
        } catch {
          return false;
        }
      });
      
      if (usersWithWeather.length > 0) {
        console.log(`\n✅ Found ${usersWithWeather.length} users with '${variation}': true`);
        foundWeatherUsers += usersWithWeather.length;
      }
    }

    if (foundWeatherUsers === 0) {
      console.log('\n❌ No users have any weather variation enabled!');
      console.log('💡 This means either:');
      console.log('   1. The app UI doesn\'t have weather toggle yet');
      console.log('   2. Users haven\'t enabled weather notifications');
      console.log('   3. The preference key is named differently');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await database.close();
  }
}

checkPreferenceKeys().then(() => {
  console.log('\n🏁 Check completed');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Check failed:', error);
  process.exit(1);
}); 
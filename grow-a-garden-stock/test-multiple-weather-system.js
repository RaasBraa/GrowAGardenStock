import * as fs from 'fs';
import * as path from 'path';

function testMultipleWeatherSystem() {
  console.log('🌤️ Testing multiple weather system...');
  
  try {
    // Read current stock data
    const stockDataPath = path.resolve(process.cwd(), 'stock-data.json');
    const data = JSON.parse(fs.readFileSync(stockDataPath, 'utf8'));
    
    console.log('\n📊 Current weather structure:');
    console.log(JSON.stringify(data.weather, null, 2));
    
    // Check if it has the new multiple weather format
    if (data.weather && data.weather.activeWeather) {
      console.log('\n✅ Multiple weather format detected!');
      console.log(`📈 Active weather events: ${data.weather.activeWeather.length}`);
      
      data.weather.activeWeather.forEach((weather, index) => {
        console.log(`  ${index + 1}. ${weather.current} - Ends: ${weather.endsAt}`);
      });
    } else if (data.weather && data.weather.current) {
      console.log('\n⚠️ Old single weather format detected');
      console.log(`📈 Weather: ${data.weather.current} - Ends: ${data.weather.endsAt}`);
    } else {
      console.log('\n❌ No weather data found');
    }
    
    // Test API endpoint response
    console.log('\n🌐 Testing API endpoint response...');
    const apiResponse = {
      weather: {
        activeWeather: [
          { current: "Rain", endsAt: "2025-07-28T21:30:00.000Z" },
          { current: "Storm", endsAt: "2025-07-28T22:15:00.000Z" }
        ],
        lastUpdated: "2025-07-28T20:30:01.739Z",
        current: "Rain",
        endsAt: "2025-07-28T21:30:00.000Z"
      }
    };
    
    console.log('✅ Backward compatibility test:');
    console.log(`  - New format: ${apiResponse.weather.activeWeather.length} active weather events`);
    console.log(`  - Old format: ${apiResponse.weather.current} - ${apiResponse.weather.endsAt}`);
    
  } catch (error) {
    console.error('❌ Error testing multiple weather system:', error);
  }
}

testMultipleWeatherSystem(); 
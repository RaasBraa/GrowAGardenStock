import WebSocket from 'ws';
import { Client, GatewayIntentBits, Events } from 'discord.js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env.local') });

// Test configuration
const TEST_DURATION = 30 * 60 * 1000; // 30 minutes
const LOG_FILE = 'weather-test-log.txt';
const DETAILED_LOG_FILE = 'weather-detailed-log.txt';

// Clear previous log files
fs.writeFileSync(LOG_FILE, `=== WEATHER MONITORING TEST STARTED: ${new Date().toISOString()} ===\n\n`);
fs.writeFileSync(DETAILED_LOG_FILE, `=== DETAILED WEATHER MONITORING TEST STARTED: ${new Date().toISOString()} ===\n\n`);

function log(message, detailed = false) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  
  console.log(logMessage.trim());
  fs.appendFileSync(LOG_FILE, logMessage);
  
  if (detailed) {
    fs.appendFileSync(DETAILED_LOG_FILE, logMessage);
  }
}

function logDetailed(data, source) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${source}] DETAILED DATA:\n${JSON.stringify(data, null, 2)}\n\n`;
  fs.appendFileSync(DETAILED_LOG_FILE, logMessage);
}

// Weather detection counters
const weatherStats = {
  websocket: {
    totalMessages: 0,
    weatherMessages: 0,
    weatherUpdates: [],
    lastWeather: null
  },
  discord: {
    totalMessages: 0,
    weatherMessages: 0,
    weatherUpdates: [],
    lastWeather: null
  },
  startTime: Date.now()
};

// WebSocket Weather Monitor
class WebSocketWeatherMonitor {
  constructor() {
    this.ws = null;
    this.userId = '.gamer01devtesting';
    this.isConnected = false;
  }

  start() {
    log('🌐 Starting WebSocket weather monitor...');
    this.connect();
  }

  connect() {
    try {
      const wsUrl = `wss://websocket.joshlei.com/growagarden?user_id=${encodeURIComponent(this.userId)}`;
      log(`🔗 Connecting to WebSocket: ${wsUrl}`);
      
      this.ws = new WebSocket(wsUrl);
      
      this.ws.on('open', () => {
        log('✅ WebSocket connection established');
        this.isConnected = true;
      });

      this.ws.on('message', (data) => {
        try {
          const rawMessage = data.toString();
          const message = JSON.parse(rawMessage);
          
          weatherStats.websocket.totalMessages++;
          
          // Log all message keys for debugging
          log(`📥 WebSocket message received. Keys: ${Object.keys(message).join(', ')}`, true);
          
          // Check for weather data
          if (message.weather && Array.isArray(message.weather)) {
            weatherStats.websocket.weatherMessages++;
            log(`🌤️ WebSocket WEATHER DETECTED! Found ${message.weather.length} weather entries`);
            
            const weatherData = {
              timestamp: new Date().toISOString(),
              weather: message.weather,
              activeWeather: message.weather.filter(w => w.active),
              allWeather: message.weather
            };
            
            weatherStats.websocket.weatherUpdates.push(weatherData);
            weatherStats.websocket.lastWeather = weatherData;
            
            log(`🌤️ WebSocket Weather Details:`, true);
            logDetailed(weatherData, 'WEBSOCKET');
            
            // Log each weather entry
            message.weather.forEach((w, index) => {
              const status = w.active ? 'ACTIVE' : 'INACTIVE';
              const endTime = new Date(w.end_duration_unix * 1000).toISOString();
              log(`   ${index + 1}. ${w.weather_name} (${status}) - Ends: ${endTime}`);
            });
          }
          
          // Log full message for detailed analysis
          logDetailed(message, 'WEBSOCKET_FULL');
          
        } catch (error) {
          log(`❌ WebSocket message parsing error: ${error.message}`);
        }
      });

      this.ws.on('error', (error) => {
        log(`❌ WebSocket error: ${error.message}`);
        this.isConnected = false;
      });

      this.ws.on('close', () => {
        log('🔌 WebSocket connection closed');
        this.isConnected = false;
      });

    } catch (error) {
      log(`❌ WebSocket connection error: ${error.message}`);
    }
  }

  stop() {
    log('🛑 Stopping WebSocket weather monitor...');
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }
}

// Discord Weather Monitor
class DiscordWeatherMonitor {
  constructor() {
    this.client = null;
    this.botToken = process.env.DISCORD_BOT_TOKEN;
    this.weatherChannelId = process.env.DISCORD_CACTUS_WEATHER_CHANNEL_ID;
  }

  start() {
    if (!this.botToken) {
      log('❌ Discord bot token not set. Skipping Discord monitoring.');
      return;
    }

    if (!this.weatherChannelId) {
      log('❌ Discord weather channel ID not set. Skipping Discord monitoring.');
      return;
    }

    log('🤖 Starting Discord weather monitor...');
    log(`📡 Monitoring Discord weather channel: ${this.weatherChannelId}`);
    
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    this.client.on(Events.ClientReady, () => {
      log(`✅ Discord bot ready! Logged in as ${this.client.user.tag}`);
      log(`👂 Listening for weather updates in Discord channel: ${this.weatherChannelId}`);
    });

    this.client.on(Events.MessageCreate, (message) => {
      this.processMessage(message);
    });

    this.client.on(Events.MessageUpdate, (oldMessage, newMessage) => {
      this.processMessage(newMessage);
    });

    this.client.on(Events.Error, (error) => {
      log(`❌ Discord client error: ${error.message}`);
    });

    this.client.login(this.botToken).catch((error) => {
      log(`❌ Discord login failed: ${error.message}`);
    });
  }

  processMessage(message) {
    weatherStats.discord.totalMessages++;
    
    // Only process messages from the weather channel
    if (message.channel.id !== this.weatherChannelId) {
      return;
    }

    log(`📥 Discord message in weather channel from ${message.author?.tag || 'Unknown'}`);
    logDetailed({
      content: message.content,
      embeds: message.embeds,
      components: message.components,
      author: message.author?.tag,
      timestamp: message.createdAt
    }, 'DISCORD_WEATHER');

    // Check if message has weather-related content
    const hasWeatherContent = this.checkForWeatherContent(message);
    if (hasWeatherContent) {
      weatherStats.discord.weatherMessages++;
      log(`🌤️ Discord WEATHER MESSAGE DETECTED!`);
      
      const weatherData = {
        timestamp: new Date().toISOString(),
        content: message.content,
        embeds: message.embeds,
        components: message.components,
        author: message.author?.tag
      };
      
      weatherStats.discord.weatherUpdates.push(weatherData);
      weatherStats.discord.lastWeather = weatherData;
    }
  }

  checkForWeatherContent(message) {
    // Check message content
    if (message.content && message.content.toLowerCase().includes('weather')) {
      return true;
    }

    // Check embeds
    if (message.embeds && message.embeds.length > 0) {
      for (const embed of message.embeds) {
        if (embed.title && embed.title.toLowerCase().includes('weather')) {
          return true;
        }
        if (embed.description && embed.description.toLowerCase().includes('weather')) {
          return true;
        }
        if (embed.fields) {
          for (const field of embed.fields) {
            if (field.name && field.name.toLowerCase().includes('weather')) {
              return true;
            }
            if (field.value && field.value.toLowerCase().includes('weather')) {
              return true;
            }
          }
        }
      }
    }

    // Check components (Cactus format)
    if (message.components && message.components.length > 0) {
      try {
        const mainComponent = message.components[0];
        if (mainComponent.components) {
          for (const component of mainComponent.components) {
            if (component.content && component.content.toLowerCase().includes('weather')) {
              return true;
            }
          }
        }
             } catch {
         // Ignore component parsing errors
       }
    }

    return false;
  }

  stop() {
    log('🛑 Stopping Discord weather monitor...');
    if (this.client) {
      this.client.destroy();
      this.client = null;
    }
  }
}

// Main test runner
async function runWeatherTest() {
  log('🚀 Starting 30-minute weather monitoring test...');
  log(`⏰ Test will run until: ${new Date(Date.now() + TEST_DURATION).toISOString()}`);
  
  const websocketMonitor = new WebSocketWeatherMonitor();
  const discordMonitor = new DiscordWeatherMonitor();

  // Start monitors
  websocketMonitor.start();
  discordMonitor.start();

  // Periodic status updates
  const statusInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - weatherStats.startTime) / 1000);
    const remaining = Math.floor((TEST_DURATION - (Date.now() - weatherStats.startTime)) / 1000);
    
    log(`📊 Status Update (${elapsed}s elapsed, ${remaining}s remaining):`);
    log(`   WebSocket: ${weatherStats.websocket.totalMessages} messages, ${weatherStats.websocket.weatherMessages} weather messages`);
    log(`   Discord: ${weatherStats.discord.totalMessages} messages, ${weatherStats.discord.weatherMessages} weather messages`);
    
    if (weatherStats.websocket.lastWeather) {
      log(`   Last WebSocket weather: ${weatherStats.websocket.lastWeather.timestamp}`);
    }
    if (weatherStats.discord.lastWeather) {
      log(`   Last Discord weather: ${weatherStats.discord.lastWeather.timestamp}`);
    }
  }, 60000); // Every minute

  // Test completion
  setTimeout(() => {
    clearInterval(statusInterval);
    
    log('\n🏁 Weather monitoring test completed!');
    log('\n📈 FINAL STATISTICS:');
    log(`   Test Duration: ${Math.floor(TEST_DURATION / 1000)} seconds`);
    log(`   WebSocket Total Messages: ${weatherStats.websocket.totalMessages}`);
    log(`   WebSocket Weather Messages: ${weatherStats.websocket.weatherMessages}`);
    log(`   Discord Total Messages: ${weatherStats.discord.totalMessages}`);
    log(`   Discord Weather Messages: ${weatherStats.discord.weatherMessages}`);
    
    log('\n🌤️ WEATHER UPDATES SUMMARY:');
    log(`   WebSocket Weather Updates: ${weatherStats.websocket.weatherUpdates.length}`);
    weatherStats.websocket.weatherUpdates.forEach((update, index) => {
      log(`     ${index + 1}. ${update.timestamp} - ${update.weather.length} weather entries`);
    });
    
    log(`   Discord Weather Updates: ${weatherStats.discord.weatherUpdates.length}`);
    weatherStats.discord.weatherUpdates.forEach((update, index) => {
      log(`     ${index + 1}. ${update.timestamp} - ${update.author || 'Unknown'}`);
    });
    
    log('\n📁 Log files created:');
    log(`   - ${LOG_FILE} (summary log)`);
    log(`   - ${DETAILED_LOG_FILE} (detailed data)`);
    
    // Stop monitors
    websocketMonitor.stop();
    discordMonitor.stop();
    
    log('✅ Test completed successfully!');
    process.exit(0);
  }, TEST_DURATION);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  log('\n🛑 Test interrupted by user. Shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('\n🛑 Test terminated. Shutting down...');
  process.exit(0);
});

// Start the test
runWeatherTest().catch((error) => {
  log(`❌ Test failed: ${error.message}`);
  process.exit(1);
}); 
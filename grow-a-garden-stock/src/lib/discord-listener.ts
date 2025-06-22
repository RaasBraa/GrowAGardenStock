import { Client, GatewayIntentBits, Events, Message } from 'discord.js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { parseStockEmbed, StockItem, parseWeatherEmbed, WeatherInfo } from './stock-parser';
import { sendItemNotification, sendWeatherAlertNotification } from './pushNotifications';

// Explicitly load .env.local from the project root
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

// Channel IDs from environment variables
const SEED_CHANNEL_ID = process.env.DISCORD_SEED_CHANNEL_ID;
const GEAR_CHANNEL_ID = process.env.DISCORD_GEAR_CHANNEL_ID;
const EGG_CHANNEL_ID = process.env.DISCORD_EGG_CHANNEL_ID;
const COSMETIC_CHANNEL_ID = process.env.DISCORD_COSMETIC_CHANNEL_ID;
const WEATHER_CHANNEL_ID = process.env.DISCORD_WEATHER_CHANNEL_ID;

const channelConfig: { [key: string]: string } = {};
if (SEED_CHANNEL_ID) channelConfig[SEED_CHANNEL_ID] = 'Seeds';
if (GEAR_CHANNEL_ID) channelConfig[GEAR_CHANNEL_ID] = 'Gear';
if (EGG_CHANNEL_ID) channelConfig[EGG_CHANNEL_ID] = 'Eggs';
if (COSMETIC_CHANNEL_ID) channelConfig[COSMETIC_CHANNEL_ID] = 'Cosmetics';
if (WEATHER_CHANNEL_ID) channelConfig[WEATHER_CHANNEL_ID] = 'Weather';

const STOCK_DATA_PATH = path.resolve(process.cwd(), 'stock-data.json');

interface AllStockData {
  [key: string]: StockItem[] | WeatherInfo | string | { items: StockItem[] | WeatherInfo; lastUpdated: string };
  lastUpdated: string;
}

async function processMessage(message: Message) {
  const stockType = channelConfig[message.channel.id];

  // Process all messages from configured channels (not just bot messages)
  if (stockType) {
    console.log(`📨 Processing message in [${stockType}] channel.`);
    
    if (message.embeds.length > 0) {
      const embed = message.embeds[0].toJSON();
      let parsedData: StockItem[] | WeatherInfo | null = null;

      switch (stockType) {
        case 'Weather':
          parsedData = parseWeatherEmbed(embed);
          break;
        case 'Seeds':
        case 'Gear':
        case 'Eggs':
        case 'Cosmetics':
          parsedData = parseStockEmbed(embed);
          break;
      }
      
      if (parsedData) {
        console.log(`✅ Parsed [${stockType}] data:`, parsedData);

        // Read existing data to merge, or create new object
        let allStockData: Partial<AllStockData> = {};
        try {
          if (fs.existsSync(STOCK_DATA_PATH)) {
            allStockData = JSON.parse(fs.readFileSync(STOCK_DATA_PATH, 'utf-8'));
          }
        } catch (e) {
          console.error("❌ Error reading existing stock data file", e);
        }

        // Update the data for the specific stock type with individual timestamp
        const currentTime = new Date().toISOString();
        const categoryKey = stockType.toLowerCase();
        
        if (stockType === 'Weather') {
          // Weather data structure remains the same
          allStockData[categoryKey] = parsedData;
        } else {
          // Stock items get the new structure with individual timestamp
          allStockData[categoryKey] = {
            items: parsedData,
            lastUpdated: currentTime
          };
        }
        
        // Update the main lastUpdated timestamp for backward compatibility
        allStockData.lastUpdated = currentTime;
        
        fs.writeFileSync(STOCK_DATA_PATH, JSON.stringify(allStockData, null, 2));
        console.log(`💾 Successfully saved [${stockType}] data to ${STOCK_DATA_PATH} with timestamp ${currentTime}`);

        // --- Enhanced Push Notification Integration ---
        if (stockType === 'Weather' && !Array.isArray(parsedData)) {
          // Handle weather alerts
          const weatherInfo = parsedData as WeatherInfo;
          if (weatherInfo.current && weatherInfo.ends) {
            console.log(`🌤️ Sending weather alert: ${weatherInfo.current}`);
            await sendWeatherAlertNotification(weatherInfo.current, `Ends: ${weatherInfo.ends}`);
          }
        } else if (Array.isArray(parsedData)) {
          // Handle stock updates
          const stockItems = parsedData as StockItem[];
          let notificationCount = 0;
          
          // Send individual notifications for each item to users who have it enabled
          for (const item of stockItems) {
            console.log(`🔔 Checking notifications for ${item.name} (${item.quantity})`);
            await sendItemNotification(item.name, item.quantity, stockType);
            notificationCount++;
          }
          
          console.log(`🎉 Processed ${notificationCount} item notifications for [${stockType}]`);
        }
        // --- End Push Notification Integration ---
      } else {
        console.log(`❌ Could not parse data for [${stockType}].`);
      }

    } else {
      console.log('📝 Message does not contain any embeds. Ignoring.');
    }
  }
}

function initializeDiscordListener() {
  console.log('🔧 Starting Discord listener initialization...');
  
  // Check environment variables
  console.log('📋 Environment check:');
  console.log(`   Bot Token: ${BOT_TOKEN ? '✅ Set' : '❌ Missing'}`);
  console.log(`   Seed Channel: ${SEED_CHANNEL_ID ? '✅ Set' : '❌ Missing'}`);
  console.log(`   Gear Channel: ${GEAR_CHANNEL_ID ? '✅ Set' : '❌ Missing'}`);
  console.log(`   Egg Channel: ${EGG_CHANNEL_ID ? '✅ Set' : '❌ Missing'}`);
  console.log(`   Cosmetic Channel: ${COSMETIC_CHANNEL_ID ? '✅ Set' : '❌ Missing'}`);
  console.log(`   Weather Channel: ${WEATHER_CHANNEL_ID ? '✅ Set' : '❌ Missing'}`);
  
  if (!BOT_TOKEN) {
    console.error('❌ Discord bot token not set. The listener will not start.');
    console.error('   Please check your .env.local file and ensure DISCORD_BOT_TOKEN is set.');
    return;
  }

  if (Object.keys(channelConfig).length === 0) {
    console.error('❌ No channel IDs have been configured in the environment. The listener will not start.');
    console.error('   Please check your .env.local file and ensure at least one channel ID is set.');
    return;
  }

  console.log(`📊 Configured channels:`, Object.keys(channelConfig).map(id => `${channelConfig[id]} (${id})`));

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  client.on(Events.ClientReady, (c) => {
    console.log(`🤖 Discord listener ready! Logged in as ${c.user.tag}`);
    console.log(`🆔 Bot ID: ${c.user.id}`);
    console.log(`👂 Listening for stock updates in the following channels:`, Object.values(channelConfig));
    console.log(`🔔 Per-item notification system enabled`);
    
    // Check if bot can see the configured channels
    console.log('🔍 Checking channel access...');
    Object.keys(channelConfig).forEach(channelId => {
      const channel = client.channels.cache.get(channelId);
      if (channel) {
        console.log(`   ✅ ${channelConfig[channelId]}: Accessible`);
      } else {
        console.log(`   ❌ ${channelConfig[channelId]}: Not accessible (check permissions)`);
      }
    });
  });

  client.on(Events.MessageCreate, async (message) => {
    await processMessage(message);
  });

  client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
    // The newMessage object may be partial, so we pass it to our handler
    // which is robust enough to handle it.
    await processMessage(newMessage as Message);
  });

  client.on(Events.Error, (error) => {
    console.error('❌ Discord client error:', error);
  });

  client.on(Events.Warn, (warning) => {
    console.warn('⚠️ Discord client warning:', warning);
  });

  console.log('🔗 Attempting to connect to Discord...');
  
  client.login(BOT_TOKEN).then(() => {
    console.log('✅ Discord login successful');
  }).catch((error) => {
    console.error('❌ Failed to login to Discord:', error);
    console.error('   Common issues:');
    console.error('   - Invalid bot token');
    console.error('   - Bot token expired');
    console.error('   - Network connectivity issues');
    console.error('   - Discord API rate limiting');
    
    // Exit process on login failure
    process.exit(1);
  });
}

// Start the listener
initializeDiscordListener(); 
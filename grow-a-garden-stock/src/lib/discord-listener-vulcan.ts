import { Client, GatewayIntentBits, Events, Message } from 'discord.js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { parseDiscordStockMessage, parseDiscordWeatherMessage } from './discord-stock-parser.js';
import { stockManager, StockItem, WeatherInfo } from './stock-manager.js';

// Explicitly load .env.local from the project root
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

// Vulcan Channel IDs from environment variables
const VULCAN_SEED_CHANNEL_ID = process.env.DISCORD_VULCAN_SEED_CHANNEL_ID;
const VULCAN_GEAR_CHANNEL_ID = process.env.DISCORD_VULCAN_GEAR_CHANNEL_ID;
const VULCAN_EGG_CHANNEL_ID = process.env.DISCORD_VULCAN_EGG_CHANNEL_ID;
const VULCAN_COSMETIC_CHANNEL_ID = process.env.DISCORD_VULCAN_COSMETIC_CHANNEL_ID;
const VULCAN_WEATHER_CHANNEL_ID = process.env.DISCORD_VULCAN_WEATHER_CHANNEL_ID;

const vulcanChannelConfig: { [key: string]: string } = {};
if (VULCAN_SEED_CHANNEL_ID) vulcanChannelConfig[VULCAN_SEED_CHANNEL_ID] = 'Seeds';
if (VULCAN_GEAR_CHANNEL_ID) vulcanChannelConfig[VULCAN_GEAR_CHANNEL_ID] = 'Gear';
if (VULCAN_EGG_CHANNEL_ID) vulcanChannelConfig[VULCAN_EGG_CHANNEL_ID] = 'Eggs';
if (VULCAN_COSMETIC_CHANNEL_ID) vulcanChannelConfig[VULCAN_COSMETIC_CHANNEL_ID] = 'Cosmetics';
if (VULCAN_WEATHER_CHANNEL_ID) vulcanChannelConfig[VULCAN_WEATHER_CHANNEL_ID] = 'Weather';

async function processVulcanMessage(message: Message) {
  const stockType = vulcanChannelConfig[message.channel.id];

  // Process all messages from configured channels (not just bot messages)
  if (stockType) {
    console.log(`📡 Processing Vulcan Discord message in [${stockType}] channel.`);
    
    // Always update source activity, even if no embeds
    stockManager.updateSourceActivity('vulcan');
    
    // Parse stock data based on channel type
    let category: 'seeds' | 'gear' | 'eggs' | 'cosmetics';
    switch (stockType) {
      case 'Seeds':
        category = 'seeds';
        break;
      case 'Gear':
        category = 'gear';
        break;
      case 'Eggs':
        category = 'eggs';
        break;
      case 'Cosmetics':
        category = 'cosmetics';
        break;
      default:
        category = 'seeds';
    }
    
    const stockData = parseDiscordStockMessage(message, category);
    if (stockData && stockData.items.length > 0) {
      console.log(`✅ Parsed Vulcan Discord [${stockType}] data:`, stockData.items);
      const stockItems: StockItem[] = stockData.items.map(item => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity
      }));
      stockManager.updateStockData('vulcan', category, stockItems);
      console.log(`📡 Vulcan Discord [${stockType}] processed successfully`);
    } else {
      console.log(`❌ Could not parse Vulcan Discord data for [${stockType}].`);
    }
    
    // Check for weather updates
    const weatherData = parseDiscordWeatherMessage(message);
    if (weatherData) {
      console.log(`🌤️ Parsed Vulcan Discord weather:`, weatherData);
      const weatherInfo: WeatherInfo = {
        current: weatherData.current,
        endsAt: weatherData.endsAt
      };
      // Send weather-only update - this will preserve existing seeds data
      stockManager.updateStockData('vulcan', 'seeds', [], weatherInfo);
    }
  }
}

function initializeVulcanDiscordListener() {
  console.log('🔧 Starting Vulcan Discord listener initialization...');
  
  // Check environment variables
  console.log('📋 Vulcan Environment check:');
  console.log(`   Bot Token: ${BOT_TOKEN ? '✅ Set' : '❌ Missing'}`);
  console.log(`   Vulcan Seed Channel: ${VULCAN_SEED_CHANNEL_ID ? '✅ Set' : '❌ Missing'}`);
  console.log(`   Vulcan Gear Channel: ${VULCAN_GEAR_CHANNEL_ID ? '✅ Set' : '❌ Missing'}`);
  console.log(`   Vulcan Egg Channel: ${VULCAN_EGG_CHANNEL_ID ? '✅ Set' : '❌ Missing'}`);
  console.log(`   Vulcan Cosmetic Channel: ${VULCAN_COSMETIC_CHANNEL_ID ? '✅ Set' : '❌ Missing'}`);
  console.log(`   Vulcan Weather Channel: ${VULCAN_WEATHER_CHANNEL_ID ? '✅ Set' : '❌ Missing'}`);
  
  if (!BOT_TOKEN) {
    console.error('❌ Discord bot token not set. The Vulcan listener will not start.');
    console.error('   Please check your .env.local file and ensure DISCORD_BOT_TOKEN is set.');
    return;
  }

  if (Object.keys(vulcanChannelConfig).length === 0) {
    console.error('❌ No Vulcan channel IDs have been configured in the environment. The listener will not start.');
    console.error('   Please check your .env.local file and ensure at least one Vulcan channel ID is set.');
    return;
  }

  console.log(`📊 Configured Vulcan Discord channels:`, Object.keys(vulcanChannelConfig).map(id => `${vulcanChannelConfig[id]} (${id})`));

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  client.on(Events.ClientReady, async (c) => {
    console.log(`🤖 Vulcan Discord listener ready! Logged in as ${c.user.tag}`);
    console.log(`🆔 Bot ID: ${c.user.id}`);
    console.log(`👂 Listening for stock updates in the following Vulcan Discord channels:`, Object.values(vulcanChannelConfig));
    console.log(`🔔 Per-item notification system enabled`);
    
    // Check if bot can see the configured channels
    console.log('🔍 Checking Vulcan Discord channel access...');
    Object.keys(vulcanChannelConfig).forEach(channelId => {
      const channel = client.channels.cache.get(channelId);
      if (channel) {
        console.log(`   ✅ ${vulcanChannelConfig[channelId]}: Accessible`);
      } else {
        console.log(`   ❌ ${vulcanChannelConfig[channelId]}: Not accessible (check permissions)`);
      }
    });

    console.log('✅ Vulcan Discord is now active as secondary backup source!');
    console.log('📱 Your mobile app will get updates from Vulcan when WebSocket and Cactus are offline!');
  });

  client.on(Events.MessageCreate, async (message) => {
    await processVulcanMessage(message);
  });

  client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
    // The newMessage object may be partial, so we pass it to our handler
    // which is robust enough to handle it.
    await processVulcanMessage(newMessage as Message);
  });

  client.on(Events.Error, (error) => {
    console.error('❌ Vulcan Discord client error:', error);
  });

  client.on(Events.Warn, (warning) => {
    console.warn('⚠️ Vulcan Discord client warning:', warning);
  });

  console.log('🔗 Attempting to connect to Vulcan Discord...');
  
  client.login(BOT_TOKEN).then(() => {
    console.log('✅ Vulcan Discord login successful');
  }).catch((error) => {
    console.error('❌ Failed to login to Vulcan Discord:', error);
    console.error('   Common issues:');
    console.error('   - Invalid bot token');
    console.error('   - Bot token expired');
    console.error('   - Network connectivity issues');
    console.error('   - Discord API rate limiting');
    
    // Exit process on login failure
    process.exit(1);
  });
}

export { initializeVulcanDiscordListener as initializeDiscordListener }; 
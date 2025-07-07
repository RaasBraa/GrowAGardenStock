import { Client, GatewayIntentBits, Events, Message } from 'discord.js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { parseDiscordStockMessage, parseDiscordWeatherMessage } from './discord-stock-parser';
import { stockManager, StockItem, WeatherInfo } from './stock-manager';

// Explicitly load .env.local from the project root
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

// Cactus Channel IDs from environment variables
const CACTUS_SEED_GEAR_CHANNEL_ID = process.env.DISCORD_CACTUS_SEED_GEAR_CHANNEL_ID;
const CACTUS_EGG_CHANNEL_ID = process.env.DISCORD_CACTUS_EGG_CHANNEL_ID;
const CACTUS_COSMETIC_CHANNEL_ID = process.env.DISCORD_CACTUS_COSMETIC_CHANNEL_ID;
const CACTUS_WEATHER_CHANNEL_ID = process.env.DISCORD_CACTUS_WEATHER_CHANNEL_ID;

const cactusChannelConfig: { [key: string]: string } = {};
if (CACTUS_SEED_GEAR_CHANNEL_ID) cactusChannelConfig[CACTUS_SEED_GEAR_CHANNEL_ID] = 'SeedGear';
if (CACTUS_EGG_CHANNEL_ID) cactusChannelConfig[CACTUS_EGG_CHANNEL_ID] = 'Eggs';
if (CACTUS_COSMETIC_CHANNEL_ID) cactusChannelConfig[CACTUS_COSMETIC_CHANNEL_ID] = 'Cosmetics';
if (CACTUS_WEATHER_CHANNEL_ID) cactusChannelConfig[CACTUS_WEATHER_CHANNEL_ID] = 'Weather';

async function processCactusMessage(message: Message) {
  const stockType = cactusChannelConfig[message.channel.id];

  // Process all messages from configured channels (not just bot messages)
  if (stockType) {
    console.log(`📡 Processing Cactus Discord message in [${stockType}] channel.`);
    
    // Always update source activity, even if no embeds
    stockManager.updateSourceActivity('cactus');
    
    // For SeedGear channel, we need to parse both seeds and gear
    if (stockType === 'SeedGear') {
      // Parse seeds
      const seedsData = parseDiscordStockMessage(message, 'seeds');
      if (seedsData && seedsData.items.length > 0) {
        console.log(`✅ Parsed Cactus Discord [Seeds] data:`, seedsData.items);
        const stockItems: StockItem[] = seedsData.items.map(item => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity
        }));
        stockManager.updateStockData('cactus', 'seeds', stockItems);
      }
      
      // Parse gear
      const gearData = parseDiscordStockMessage(message, 'gear');
      if (gearData && gearData.items.length > 0) {
        console.log(`✅ Parsed Cactus Discord [Gear] data:`, gearData.items);
        const stockItems: StockItem[] = gearData.items.map(item => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity
        }));
        stockManager.updateStockData('cactus', 'gear', stockItems);
      }
      
      console.log(`📡 Cactus Discord [SeedGear] processed successfully`);
    } else {
      // For other channels, parse based on the channel type
      let category: 'seeds' | 'gear' | 'eggs' | 'cosmetics';
      switch (stockType) {
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
        console.log(`✅ Parsed Cactus Discord [${stockType}] data:`, stockData.items);
        const stockItems: StockItem[] = stockData.items.map(item => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity
        }));
        stockManager.updateStockData('cactus', category, stockItems);
        console.log(`📡 Cactus Discord [${stockType}] processed successfully`);
      } else {
        console.log(`❌ Could not parse Cactus Discord data for [${stockType}].`);
      }
    }
    
    // Check for weather updates
    const weatherData = parseDiscordWeatherMessage(message);
    if (weatherData) {
      console.log(`🌤️ Parsed Cactus Discord weather:`, weatherData);
      const weatherInfo: WeatherInfo = {
        current: weatherData.current,
        endsAt: weatherData.endsAt
      };
      stockManager.updateStockData('cactus', 'seeds', [], weatherInfo);
    }
  }
}

function initializeCactusDiscordListener() {
  console.log('🔧 Starting Cactus Discord listener initialization...');
  
  // Check environment variables
  console.log('📋 Cactus Environment check:');
  console.log(`   Bot Token: ${BOT_TOKEN ? '✅ Set' : '❌ Missing'}`);
  console.log(`   Cactus Seed & Gear Channel: ${CACTUS_SEED_GEAR_CHANNEL_ID ? '✅ Set' : '❌ Missing'}`);
  console.log(`   Cactus Egg Channel: ${CACTUS_EGG_CHANNEL_ID ? '✅ Set' : '❌ Missing'}`);
  console.log(`   Cactus Cosmetic Channel: ${CACTUS_COSMETIC_CHANNEL_ID ? '✅ Set' : '❌ Missing'}`);
  console.log(`   Cactus Weather Channel: ${CACTUS_WEATHER_CHANNEL_ID ? '✅ Set' : '❌ Missing'}`);
  
  if (!BOT_TOKEN) {
    console.error('❌ Discord bot token not set. The Cactus listener will not start.');
    console.error('   Please check your .env.local file and ensure DISCORD_BOT_TOKEN is set.');
    return;
  }

  if (Object.keys(cactusChannelConfig).length === 0) {
    console.error('❌ No Cactus channel IDs have been configured in the environment. The listener will not start.');
    console.error('   Please check your .env.local file and ensure at least one Cactus channel ID is set.');
    return;
  }

  console.log(`📊 Configured Cactus Discord channels:`, Object.keys(cactusChannelConfig).map(id => `${cactusChannelConfig[id]} (${id})`));

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  client.on(Events.ClientReady, async (c) => {
    console.log(`🤖 Cactus Discord listener ready! Logged in as ${c.user.tag}`);
    console.log(`🆔 Bot ID: ${c.user.id}`);
    console.log(`👂 Listening for stock updates in the following Cactus Discord channels:`, Object.values(cactusChannelConfig));
    console.log(`🔔 Per-item notification system enabled`);
    
    // Check if bot can see the configured channels
    console.log('🔍 Checking Cactus Discord channel access...');
    Object.keys(cactusChannelConfig).forEach(channelId => {
      const channel = client.channels.cache.get(channelId);
      if (channel) {
        console.log(`   ✅ ${cactusChannelConfig[channelId]}: Accessible`);
      } else {
        console.log(`   ❌ ${cactusChannelConfig[channelId]}: Not accessible (check permissions)`);
      }
    });

    console.log('✅ Cactus Discord is now active as primary backup source!');
    console.log('📱 Your mobile app will get instant updates from Cactus Discord!');
  });

  client.on(Events.MessageCreate, async (message) => {
    await processCactusMessage(message);
  });

  client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
    // The newMessage object may be partial, so we pass it to our handler
    // which is robust enough to handle it.
    await processCactusMessage(newMessage as Message);
  });

  client.on(Events.Error, (error) => {
    console.error('❌ Cactus Discord client error:', error);
  });

  client.on(Events.Warn, (warning) => {
    console.warn('⚠️ Cactus Discord client warning:', warning);
  });

  console.log('🔗 Attempting to connect to Cactus Discord...');
  
  client.login(BOT_TOKEN).then(() => {
    console.log('✅ Cactus Discord login successful');
  }).catch((error) => {
    console.error('❌ Failed to login to Cactus Discord:', error);
    console.error('   Common issues:');
    console.error('   - Invalid bot token');
    console.error('   - Bot token expired');
    console.error('   - Network connectivity issues');
    console.error('   - Discord API rate limiting');
    
    // Exit process on login failure
    process.exit(1);
  });
}

export { initializeCactusDiscordListener as initializeDiscordListener }; 
import { Client, GatewayIntentBits, Events, Message } from 'discord.js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { parseStockEmbed, StockItem, parseWeatherEmbed, WeatherInfo } from './stock-parser';
import { sendRareItemNotification, sendStockUpdateNotification, sendWeatherAlertNotification } from './pushNotifications';

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
  [key: string]: StockItem[] | WeatherInfo | string;
  lastUpdated: string;
}

// Enhanced rare item detection
const RARE_ITEMS = {
  seeds: [
    'Strawberry', 'Blueberry', 'Raspberry', 'Blackberry', 'Golden Seed',
    'Diamond Seed', 'Emerald Seed', 'Ruby Seed', 'Sapphire Seed', 'Rainbow Seed'
  ],
  gear: [
    'Harvest Tool', 'Watering Can', 'Fertilizer', 'Golden Shovel', 'Diamond Pickaxe',
    'Legendary Scythe', 'Mythical Rake', 'Epic Hoe', 'Rare Trowel'
  ],
  eggs: [
    'Uncommon Egg', 'Rare Egg', 'Epic Egg', 'Legendary Egg', 'Mythical Egg',
    'Golden Egg', 'Diamond Egg', 'Rainbow Egg'
  ]
};

function isRareItem(itemName: string, category: string): boolean {
  const categoryKey = category.toLowerCase() as keyof typeof RARE_ITEMS;
  return RARE_ITEMS[categoryKey]?.includes(itemName) || false;
}

function getRarityLevel(itemName: string): string {
  if (itemName.includes('Golden') || itemName.includes('Diamond') || itemName.includes('Rainbow')) {
    return 'Legendary';
  }
  if (itemName.includes('Epic') || itemName.includes('Mythical')) {
    return 'Epic';
  }
  if (itemName.includes('Rare') || itemName.includes('Uncommon')) {
    return 'Rare';
  }
  return 'Common';
}

function processMessage(message: Message) {
  const stockType = channelConfig[message.channel.id];

  // Only process messages from a configured channel that are sent by a bot
  if (stockType && message.author.bot) {
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

        // Update the data for the specific stock type
        allStockData[stockType.toLowerCase()] = parsedData;
        allStockData.lastUpdated = new Date().toISOString();
        
        fs.writeFileSync(STOCK_DATA_PATH, JSON.stringify(allStockData, null, 2));
        console.log(`💾 Successfully saved [${stockType}] data to ${STOCK_DATA_PATH}`);

        // --- Enhanced Push Notification Integration ---
        if (stockType === 'Weather' && !Array.isArray(parsedData)) {
          // Handle weather alerts
          const weatherInfo = parsedData as WeatherInfo;
          if (weatherInfo.current && weatherInfo.ends) {
            console.log(`🌤️ Sending weather alert: ${weatherInfo.current}`);
            sendWeatherAlertNotification(weatherInfo.current, `Ends: ${weatherInfo.ends}`);
          }
        } else if (Array.isArray(parsedData)) {
          // Handle stock updates
          const stockItems = parsedData as StockItem[];
          let rareItemCount = 0;
          
          // Check for rare items and send individual notifications
          stockItems.forEach(item => {
            if (isRareItem(item.name, stockType)) {
              const rarity = getRarityLevel(item.name);
              console.log(`🌟 Rare item detected: ${item.name} (${rarity})`);
              sendRareItemNotification(item.name, rarity, item.quantity, stockType.toLowerCase());
              rareItemCount++;
            }
          });
          
          // Send general stock update notification if there are items
          if (stockItems.length > 0) {
            console.log(`📦 Sending stock update for ${stockItems.length} ${stockType.toLowerCase()} items`);
            sendStockUpdateNotification(
              stockType.toLowerCase() as 'seeds' | 'gear' | 'eggs' | 'cosmetics',
              stockItems.length
            );
          }
          
          if (rareItemCount > 0) {
            console.log(`🎉 Sent ${rareItemCount} rare item notifications for [${stockType}]`);
          }
        }
        // --- End Push Notification Integration ---
      } else {
        console.log(`❌ Could not parse data for [${stockType}].`);
      }

    } else {
      console.log('📝 Message from bot does not contain any embeds. Ignoring.');
    }
  }
}

function initializeDiscordListener() {
  if (!BOT_TOKEN) {
    console.error('❌ Discord bot token not set. The listener will not start.');
    return;
  }

  if (Object.keys(channelConfig).length === 0) {
    console.error('❌ No channel IDs have been configured in the environment. The listener will not start.');
    return;
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  client.on(Events.ClientReady, (c) => {
    console.log(`🤖 Discord listener ready! Logged in as ${c.user.tag}`);
    console.log(`👂 Listening for stock updates in the following channels:`, Object.values(channelConfig));
    console.log(`📊 Rare items configured:`, RARE_ITEMS);
  });

  client.on(Events.MessageCreate, (message) => {
    processMessage(message);
  });

  client.on(Events.MessageUpdate, (oldMessage, newMessage) => {
    // The newMessage object may be partial, so we pass it to our handler
    // which is robust enough to handle it.
    processMessage(newMessage as Message);
  });

  client.on(Events.Error, (error) => {
    console.error('❌ Discord client error:', error);
  });

  client.login(BOT_TOKEN).catch((error) => {
    console.error('❌ Failed to login to Discord:', error);
  });
}

// Start the listener
initializeDiscordListener(); 
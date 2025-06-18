import { Client, GatewayIntentBits, Events } from 'discord.js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { parseStockEmbed, StockItem, parseWeatherEmbed, WeatherInfo } from './stock-parser';

// Explicitly load .env.local from the project root
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const TARGET_BOT_ID = process.env.TARGET_BOT_ID; // The user ID of the automated stock bot

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

function initializeDiscordListener() {
  if (!BOT_TOKEN || !TARGET_BOT_ID) {
    console.error('Discord bot token or target bot ID not set. The listener will not start.');
    return;
  }

  if (Object.keys(channelConfig).length === 0) {
    console.error('No channel IDs have been configured in the environment. The listener will not start.');
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
    console.log(`Discord listener ready! Logged in as ${c.user.tag}`);
    console.log(`Listening for stock updates in the following channels:`, Object.values(channelConfig));
  });

  client.on(Events.MessageCreate, (message) => {
    const stockType = channelConfig[message.channel.id];

    // Only process messages from a configured channel and the target bot
    if (stockType && message.author.id === TARGET_BOT_ID) {
      console.log(`New message received for [${stockType}] stock.`);
      
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
            parsedData = parseStockEmbed(embed); // Assumes field name is "Current Stock"
            break;
        }
        
        if (parsedData) {
            console.log(`Parsed [${stockType}] data:`, parsedData);

            // Read existing data to merge, or create new object
            let allStockData: Partial<AllStockData> = {};
            try {
                if (fs.existsSync(STOCK_DATA_PATH)) {
                    allStockData = JSON.parse(fs.readFileSync(STOCK_DATA_PATH, 'utf-8'));
                }
            } catch (e) {
                console.error("Error reading existing stock data file", e);
            }

            // Update the data for the specific stock type
            allStockData[stockType.toLowerCase()] = parsedData;
            allStockData.lastUpdated = new Date().toISOString();
            
            fs.writeFileSync(STOCK_DATA_PATH, JSON.stringify(allStockData, null, 2));
            console.log(`Successfully parsed and saved [${stockType}] data to ${STOCK_DATA_PATH}`);
        } else {
            console.log(`Could not parse data for [${stockType}].`);
        }

      } else {
        console.log('Message from target bot does not contain any embeds. Ignoring.');
      }
    }
  });

  client.login(BOT_TOKEN).catch(console.error);
}

// Start the listener
initializeDiscordListener(); 
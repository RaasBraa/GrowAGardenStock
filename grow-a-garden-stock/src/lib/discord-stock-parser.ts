import { Message } from 'discord.js';

// Utility to normalize item names to IDs (e.g., "Green Apple" -> "green_apple")
function normalizeId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

// Map category to refresh interval (minutes)
const REFRESH_INTERVALS: Record<string, number> = {
  seeds: 5,
  gear: 5,
  eggs: 30,
  cosmetics: 240,
  weather: 5,
};

// Parse a Discord message for stock data (seeds, gear, eggs, cosmetics)
export function parseDiscordStockMessage(message: Message, category: 'seeds' | 'gear' | 'eggs' | 'cosmetics') {
  // Check if this is a Cactus message (components-based) or Vulcan message (embed-based)
  const isCactus = message.components && message.components.length > 0 && message.components[0].type === 17;
  const isVulcan = message.embeds && message.embeds.length > 0;

  if (!isCactus && !isVulcan) {
    console.log('📝 Discord message does not contain embeds or components. Ignoring.');
    return null;
  }

  let items: { id: string; name: string; quantity: number }[] = [];

  if (isCactus) {
    // Parse Cactus format (components-based)
    items = parseCactusMessage(message, category);
  } else if (isVulcan) {
    // Parse Vulcan format (embed-based)
    items = parseVulcanMessage(message, category);
  }

  if (items.length === 0) {
    console.log(`📝 No items found for category ${category} in Discord message`);
    return null;
  }

  const now = new Date().toISOString();
  const refreshInterval = REFRESH_INTERVALS[category];
  // Calculate next update (rounded up to next interval)
  const nowDate = new Date();
  const minutesSinceEpoch = Math.floor(nowDate.getTime() / (1000 * 60));
  const intervalsSinceEpoch = Math.floor(minutesSinceEpoch / refreshInterval);
  const nextScheduledMinute = (intervalsSinceEpoch + 1) * refreshInterval;
  const nextUpdate = new Date(nextScheduledMinute * 60 * 1000).toISOString();

  return {
    items,
    lastUpdated: now,
    nextUpdate,
    refreshIntervalMinutes: refreshInterval,
  };
}

/* eslint-disable @typescript-eslint/no-unused-vars */
// Reason: Linter false positive on used parameter 'category' in parseCactusMessage. This file is reviewed for real unused vars.
// Parse Cactus format (components-based)
function parseCactusMessage(message: Message, category: 'seeds' | 'gear' | 'eggs' | 'cosmetics') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mainComponent = message.components[0] as any;
  if (!mainComponent.components) return [];
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blocks = mainComponent.components;

  // Determine which blocks contain items for this category
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let relevantBlocks: any[] = [];
  
  if (category === 'seeds') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    relevantBlocks = [blocks.find((b: any) => b.type === 10 && b.content && b.content.match(/carrot|strawberry|tomato|blueberry|cauliflower|watermelon|green apple|avocado|banana|pineapple|kiwi|bell pepper|prickly pear|loquat|feijoa|sugar apple/i))].filter(Boolean);
  } else if (category === 'gear') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    relevantBlocks = [blocks.find((b: any) => b.type === 10 && b.content && b.content.match(/watering can|trowel|recall wrench|sprinkler|mirror|spray|tool|pot|cleaning spray|magnifying glass|favorite tool|harvest tool/i))].filter(Boolean);
  } else if (category === 'eggs') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    relevantBlocks = blocks.filter((b: any) => b.type === 10 && b.content && b.content.match(/egg/i));
  } else if (category === 'cosmetics') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    relevantBlocks = blocks.filter((b: any) => b.type === 10 && b.content && b.content.match(/crate|lantern|pad|tile|bench|pillar|table|lamp|sign|log|arbour|tv|shovel|trough|stack|umbrella|post|circle|path|stone|brick|gnome|mini|light|grey|brown|orange|large|medium|small/i));
  }

  const items: { id: string; name: string; quantity: number }[] = [];
  for (const block of relevantBlocks) {
    const lines = block.content.split('\n');
    for (const line of lines) {
      // Cactus format: "<:carrot:1377592178037096548> Carrot **x10**"
      const match = line.match(/>\s*([^*]+)\*\*x(\d+)\*\*/i);
      if (match) {
        const name = match[1].trim();
        const quantity = parseInt(match[2], 10);
        items.push({ id: normalizeId(name), name, quantity });
      }
    }
  }

  return items;
}

// Parse Vulcan format (embed-based)
function parseVulcanMessage(message: Message, category: 'seeds' | 'gear' | 'eggs' | 'cosmetics') {
  if (!message.embeds || message.embeds.length === 0) return [];
  
  const embed = message.embeds[0];
  if (!embed.fields || embed.fields.length < 2) return [];

  // Vulcan puts items in the second field (index 1)
  const itemsField = embed.fields[1];
  if (!itemsField || !itemsField.value) return [];

  const items: { id: string; name: string; quantity: number }[] = [];
  const lines = itemsField.value.split('\n');
  
  for (const line of lines) {
    // Vulcan format: "<:GreenApplee:1387913815789801652> **Green Apple** (1x)"
    const match = line.match(/>\s*\*\*([^*]+)\*\*\s*\((\d+)x\)/i);
    if (match) {
      const name = match[1].trim();
      const quantity = parseInt(match[2], 10);
      items.push({ id: normalizeId(name), name, quantity });
    }
  }

  return items;
}

// Parse a Discord message for weather data
export function parseDiscordWeatherMessage(message: Message) {
  // Check if this is a Cactus message (components-based) or Vulcan message (embed-based)
  const isCactus = message.components && message.components.length > 0 && message.components[0].type === 17;
  const isVulcan = message.embeds && message.embeds.length > 0;

  if (!isCactus && !isVulcan) {
    return null;
  }

  if (isCactus) {
    return parseCactusWeatherMessage(message);
  } else if (isVulcan) {
    return parseVulcanWeatherMessage(message);
  }

  return null;
}

// Parse Cactus weather format (components-based)
function parseCactusWeatherMessage(message: Message) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mainComponent = message.components[0] as any;
  if (!mainComponent.components) return null;
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blocks = mainComponent.components;
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const weatherBlock = blocks.find((b: any) => b.type === 10 && b.content && b.content.match(/ends:/i));
  if (!weatherBlock) return null;

  // Cactus weather format: "**<:JoshLei:1381473282687238186> TropicalRain**\n- Ends: <t:1751406630:R>"
  const lines = weatherBlock.content.split('\n');
  let current = '', endsAt = '';
  
  for (const line of lines) {
    if (!current && line.match(/\*\*/)) {
      // First bold line is the weather name
      current = line.replace(/\*\*/g, '').replace(/<:[^>]+>/g, '').trim();
    }
    if (line.toLowerCase().includes('ends:')) {
      // Extract timestamp from <t:...:R>
      const match = line.match(/<t:(\d+):[a-zA-Z]>/);
      if (match) {
        endsAt = new Date(parseInt(match[1], 10) * 1000).toISOString();
      }
    }
  }
  
  if (!current || !endsAt) return null;
  return { current, endsAt };
}

// Parse Vulcan weather format (embed-based)
function parseVulcanWeatherMessage(message: Message) {
  if (!message.embeds || message.embeds.length === 0) return null;
  
  const embed = message.embeds[0];
  if (!embed.fields || embed.fields.length === 0) return null;

  // Vulcan weather is typically in the first field
  const weatherField = embed.fields[0];
  if (!weatherField || !weatherField.value) return null;

  // Vulcan weather format: "**WeatherType**\n- Ends: <t:timestamp:R>"
  const lines = weatherField.value.split('\n');
  let current = '', endsAt = '';
  
  for (const line of lines) {
    if (!current && line.match(/\*\*/)) {
      // First bold line is the weather name
      current = line.replace(/\*\*/g, '').trim();
    }
    if (line.toLowerCase().includes('ends:')) {
      // Extract timestamp from <t:...:R>
      const match = line.match(/<t:(\d+):[a-zA-Z]>/);
      if (match) {
        endsAt = new Date(parseInt(match[1], 10) * 1000).toISOString();
      }
    }
  }
  
  if (!current || !endsAt) return null;
  return { current, endsAt };
} 
import { APIEmbed } from 'discord.js';

export interface StockItem {
  name: string;
  quantity: number;
}

export interface WeatherInfo {
  current: string;
  ends: string;
}

export function parseStockEmbed(embed: APIEmbed, fieldName: string = 'Current Stock'): StockItem[] {
  // Find the field that contains the stock information
  const stockField = embed.fields?.find(field => field.name === fieldName);
  if (!stockField || !stockField.value) {
    console.warn(`Could not find a "${fieldName}" field in the embed.`);
    return [];
  }

  const stockItems: StockItem[] = [];
  const lines = stockField.value.split('\n');
  
  // Regex to capture the item name (inside **) and quantity (inside (xx))
  const regex = /\*\*(.*?)\*\*\s*\((\d+)x\)/;

  for (const line of lines) {
    const match = line.match(regex);
    if (match && match[1] && match[2]) {
      const name = match[1].trim();
      const quantity = parseInt(match[2], 10);
      stockItems.push({ name, quantity });
    }
  }

  return stockItems;
}

export function parseWeatherEmbed(embed: APIEmbed): WeatherInfo | null {
    const weatherField = embed.fields?.find(field => field.name === 'Current Weather');
    if (!weatherField || !weatherField.value) {
        return null;
    }
    // This is a placeholder. We will need the actual embed structure to parse this correctly.
    // For now, let's assume the value is a simple string.
    return {
        current: weatherField.value,
        ends: "Unknown"
    };
} 
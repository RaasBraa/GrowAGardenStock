import { APIEmbed } from 'discord.js';

export interface StockItem {
  name: string;
  quantity: number;
}

export interface WeatherInfo {
  current: string;
  ends: string;
}

export function parseStockEmbed(embed: APIEmbed): StockItem[] {
  // Find the field that contains the stock information
  // It could be named "Current Stock" or "👗 Cosmetics Stock Update" etc.
  // The most reliable field is the one that is not "Next Update" and is not inline
  const stockField = embed.fields?.find(field => field.name.toLowerCase().includes('stock') || (field.inline === false && field.name !== "Next Update"));
  
  if (!stockField || !stockField.value) {
    console.warn('Could not find a valid stock field in the embed.');
    return [];
  }

  const stockItems: StockItem[] = [];
  // The regex needs to handle cases with and without custom emojis
  const lines = stockField.value.split('\n');

  for (const line of lines) {
    // A special case for items that might not have a quantity, like the cosmetics.
    // If no quantity is found, assume 1.
    const quantityMatch = line.match(/\((\d+)x\)/);
    const nameMatch = line.match(/\*\*(.*?)\*\*/);

    if (nameMatch && nameMatch[1]) {
        const name = nameMatch[1].trim();
        const quantity = quantityMatch ? parseInt(quantityMatch[1], 10) : 1;
        stockItems.push({ name, quantity });
    }
  }

  return stockItems;
}

export function parseWeatherEmbed(embed: APIEmbed): WeatherInfo | null {
    const weatherField = embed.fields?.find(field => field.name === 'Current Weather');
    const endsField = embed.fields?.find(field => field.name === 'Ends In');

    if (!weatherField || !weatherField.value || !endsField || !endsField.value) {
        console.warn('Could not find weather or end time fields in the embed.');
        return null;
    }

    // Extract the weather name, removing the asterisks
    const weatherName = weatherField.value.replace(/\*/g, '').trim();

    return {
        current: weatherName,
        ends: endsField.value // Keep the raw timestamp string e.g. "<t:1750250434:R>"
    };
} 
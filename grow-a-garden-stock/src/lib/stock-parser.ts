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
  // Find the field that contains the stock information.
  // The most reliable way is to find a field whose value contains item quantities like (21x).
  const stockField = embed.fields?.find(field => field.value.includes('(x)'));

  if (!stockField) {
    console.warn('Could not find a valid stock field in the embed by looking for quantities.');
    // Fallback for cosmetics or other items that might not have quantities listed
    const fallbackField = embed.fields?.find(field => field.name.toLowerCase().includes('stock') || !field.inline);
     if (!fallbackField) {
        console.error('Could not find any usable stock field in the embed.');
        return [];
     }
     console.log('Using fallback field for parsing:', fallbackField.name);
     return parseStockFromField(fallbackField.value);
  }

  return parseStockFromField(stockField.value);
}

// Helper function to abstract the parsing logic from a field's value string
function parseStockFromField(fieldValue: string): StockItem[] {
  const stockItems: StockItem[] = [];
  const lines = fieldValue.split('\n');

  for (const line of lines) {
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
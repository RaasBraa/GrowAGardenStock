import { APIEmbed } from 'discord.js';

export interface StockItem {
  name: string;
  quantity: number;
}

export function parseStockEmbed(embed: APIEmbed): StockItem[] {
  // Find the field that contains the stock information
  const stockField = embed.fields?.find(field => field.name === 'Current Stock');
  if (!stockField || !stockField.value) {
    console.warn('Could not find a "Current Stock" field in the embed.');
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
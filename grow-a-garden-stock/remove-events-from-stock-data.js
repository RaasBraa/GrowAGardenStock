#!/usr/bin/env node

/**
 * Script to remove event items from stock-data.json
 * This removes the last batch of event items that are no longer available
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STOCK_DATA_PATH = path.resolve(__dirname, 'stock-data.json');

// Event items to remove from stock data
const EVENT_ITEMS_TO_REMOVE = [
  "Zen Seed Pack", "Zen Egg", "Hot Spring", "Zen Sand", "Tranquil Radar", 
  "Corrupt Radar", "Zenflare", "Zen Crate", "Sakura Bush", "Soft Sunshine", 
  "Koi", "Zen Gnome Crate", "Spiked Mango", "Pet Shard Tranquil", 
  "Pet Shard Corrupted", "Raiju"
];

console.log('🗑️  Removing event items from stock-data.json');
console.log('=' .repeat(50));
console.log(`📋 Event items to remove: ${EVENT_ITEMS_TO_REMOVE.length} items`);
EVENT_ITEMS_TO_REMOVE.forEach(item => console.log(`   - ${item}`));
console.log('');

async function removeEventItemsFromStockData() {
  console.log('📄 Processing stock-data.json...');
  
  if (!fs.existsSync(STOCK_DATA_PATH)) {
    console.error('❌ stock-data.json file not found:', STOCK_DATA_PATH);
    process.exit(1);
  }

  try {
    // Read the current stock data
    const jsonData = fs.readFileSync(STOCK_DATA_PATH, 'utf8');
    const stockData = JSON.parse(jsonData);
    
    console.log(`📊 Found stock data with ${stockData.events?.items?.length || 0} event items`);

    if (!stockData.events || !stockData.events.items) {
      console.log('⚠️  No events section found in stock data');
      return;
    }

    const originalEventCount = stockData.events.items.length;
    let removedCount = 0;

    // Filter out the event items to remove
    stockData.events.items = stockData.events.items.filter(item => {
      const shouldRemove = EVENT_ITEMS_TO_REMOVE.includes(item.name);
      if (shouldRemove) {
        console.log(`🗑️  Removing event item: ${item.name} (quantity: ${item.quantity})`);
        removedCount++;
      }
      return !shouldRemove;
    });

    // Update the lastUpdated timestamp
    stockData.lastUpdated = new Date().toISOString();
    if (stockData.events) {
      stockData.events.lastUpdated = new Date().toISOString();
    }

    // Write the updated data back to the file
    fs.writeFileSync(STOCK_DATA_PATH, JSON.stringify(stockData, null, 2));
    
    console.log(`\n✅ Successfully removed ${removedCount} event items`);
    console.log(`📊 Event items remaining: ${stockData.events.items.length} (was ${originalEventCount})`);
    console.log(`💾 Updated stock-data.json with changes`);

    // Show remaining event items
    if (stockData.events.items.length > 0) {
      console.log('\n📋 Remaining event items:');
      stockData.events.items.forEach(item => {
        console.log(`   - ${item.name} (quantity: ${item.quantity})`);
      });
    } else {
      console.log('\n📋 No event items remaining');
    }

  } catch (error) {
    console.error('❌ Error processing stock-data.json:', error);
    process.exit(1);
  }
}

// Run the script
removeEventItemsFromStockData();

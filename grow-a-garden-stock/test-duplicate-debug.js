import fs from 'fs';

// Test the duplicate detection logic
const duplicateHistoryPath = './duplicate-history.json';

// Load the current duplicate history
let duplicateHistory = { history: [], lastDailySeedReset: '' };
if (fs.existsSync(duplicateHistoryPath)) {
  const data = fs.readFileSync(duplicateHistoryPath, 'utf-8');
  duplicateHistory = JSON.parse(data);
}

console.log('📊 Current Duplicate History:');
console.log('Last Daily Seed Reset:', duplicateHistory.lastDailySeedReset);
console.log('Total Items Tracked:', duplicateHistory.history.length);

// Check for specific items that might be causing issues
const problemItems = ['ember lily', 'broccoli', 'green apple'];
for (const itemId of problemItems) {
  const itemHistory = duplicateHistory.history.find(([id]) => id === itemId);
  if (itemHistory) {
    const [, appearances] = itemHistory;
    console.log(`\n🔍 ${itemId}:`);
    console.log(`  Total appearances: ${appearances.length}`);
    
    // Group by quantity
    const quantityGroups = {};
    appearances.forEach(app => {
      if (!quantityGroups[app.quantity]) {
        quantityGroups[app.quantity] = 0;
      }
      quantityGroups[app.quantity]++;
    });
    
    Object.entries(quantityGroups).forEach(([quantity, count]) => {
      console.log(`  Quantity ${quantity}: ${count} times`);
    });
  } else {
    console.log(`\n❌ ${itemId}: Not found in history`);
  }
}

// Test the filtering logic
const DUPLICATE_DETECTION_WINDOW = 10 * 60 * 1000; // 10 minutes
const MAX_SAME_QUANTITY_APPEARANCES = 3;

function testFiltering(itemId, quantity) {
  const now = Date.now();
  const itemHistory = duplicateHistory.history.find(([id]) => id === itemId);
  
  if (!itemHistory) {
    console.log(`\n🧪 Testing ${itemId} (quantity: ${quantity}): No history found - would allow`);
    return false;
  }
  
  const [, appearances] = itemHistory;
  const cutoffTime = now - DUPLICATE_DETECTION_WINDOW;
  const recentHistory = appearances.filter(entry => entry.timestamp > cutoffTime);
  const sameQuantityCount = recentHistory.filter(entry => entry.quantity === quantity).length;
  
  const shouldFilter = sameQuantityCount >= MAX_SAME_QUANTITY_APPEARANCES;
  
  console.log(`\n🧪 Testing ${itemId} (quantity: ${quantity}):`);
  console.log(`  Recent appearances: ${recentHistory.length}`);
  console.log(`  Same quantity appearances: ${sameQuantityCount}`);
  console.log(`  Should filter: ${shouldFilter}`);
  
  return shouldFilter;
}

// Test the problematic items
console.log('\n🧪 Testing Filter Logic:');
testFiltering('ember lily', 1);
testFiltering('broccoli', 1);
testFiltering('green apple', 1);

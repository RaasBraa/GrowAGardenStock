import fs from 'fs';

// Test the current duplicate detection state
const duplicateHistoryPath = './duplicate-history.json';

console.log('🔍 Current Duplicate Detection State:');
console.log('=====================================');

// Load current duplicate history
let duplicateHistory = { history: [], lastDailySeedReset: '' };
if (fs.existsSync(duplicateHistoryPath)) {
  const data = fs.readFileSync(duplicateHistoryPath, 'utf-8');
  duplicateHistory = JSON.parse(data);
  console.log('✅ Duplicate history file loaded');
} else {
  console.log('❌ No duplicate history file found');
}

console.log('\n📊 File State:');
console.log('Last Daily Seed Reset:', duplicateHistory.lastDailySeedReset);
console.log('Total Items Tracked:', duplicateHistory.history.length);

// Check for problematic items
const problemItems = ['ember_lily', 'broccoli', 'green_apple'];
console.log('\n🔍 Problem Items Analysis:');

for (const itemId of problemItems) {
  const itemHistory = duplicateHistory.history.find(([id]) => id === itemId);
  if (itemHistory) {
    const [, appearances] = itemHistory;
    console.log(`\n📝 ${itemId}:`);
    console.log(`  Total appearances: ${appearances.length}`);
    
    // Show recent appearances (last 10 minutes)
    const now = Date.now();
    const tenMinutesAgo = now - (10 * 60 * 1000);
    const recentAppearances = appearances.filter(app => app.timestamp > tenMinutesAgo);
    
    console.log(`  Recent appearances (10min): ${recentAppearances.length}`);
    
    // Group by quantity
    const quantityGroups = {};
    recentAppearances.forEach(app => {
      if (!quantityGroups[app.quantity]) {
        quantityGroups[app.quantity] = [];
      }
      quantityGroups[app.quantity].push(new Date(app.timestamp).toLocaleTimeString());
    });
    
    Object.entries(quantityGroups).forEach(([quantity, timestamps]) => {
      console.log(`  Quantity ${quantity}: ${timestamps.length} times`);
      console.log(`    Times: ${timestamps.join(', ')}`);
    });
    
    // Test filtering logic
    const DUPLICATE_DETECTION_WINDOW = 5 * 60 * 1000; // 5 minutes
    const MAX_SAME_QUANTITY_APPEARANCES = 2;
    
    const cutoffTime = now - DUPLICATE_DETECTION_WINDOW;
    const recentHistory = appearances.filter(entry => entry.timestamp > cutoffTime);
    
    Object.keys(quantityGroups).forEach(quantity => {
      const sameQuantityCount = recentHistory.filter(entry => entry.quantity === parseInt(quantity)).length;
      const shouldFilter = sameQuantityCount >= MAX_SAME_QUANTITY_APPEARANCES;
      console.log(`  🧪 Quantity ${quantity}: ${sameQuantityCount} appearances in 5min → ${shouldFilter ? 'FILTER' : 'ALLOW'}`);
    });
    
  } else {
    console.log(`\n❌ ${itemId}: Not found in history`);
  }
}

// Check if there are any items that should be filtered but aren't
console.log('\n🚨 Items That Should Be Filtered:');
const now = Date.now();
const DUPLICATE_DETECTION_WINDOW = 5 * 60 * 1000;
const MAX_SAME_QUANTITY_APPEARANCES = 2;

duplicateHistory.history.forEach(([itemId, appearances]) => {
  const cutoffTime = now - DUPLICATE_DETECTION_WINDOW;
  const recentHistory = appearances.filter(entry => entry.timestamp > cutoffTime);
  
  // Group by quantity
  const quantityGroups = {};
  recentHistory.forEach(app => {
    if (!quantityGroups[app.quantity]) {
      quantityGroups[app.quantity] = 0;
    }
    quantityGroups[app.quantity]++;
  });
  
  Object.entries(quantityGroups).forEach(([quantity, count]) => {
    if (count >= MAX_SAME_QUANTITY_APPEARANCES) {
      console.log(`  🚫 ${itemId} (quantity: ${quantity}): ${count} appearances in 5min - SHOULD BE FILTERED`);
    }
  });
});

console.log('\n✅ Analysis complete');

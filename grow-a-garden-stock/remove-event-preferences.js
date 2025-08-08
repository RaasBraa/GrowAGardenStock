#!/usr/bin/env node

/**
 * Script to remove all event item preferences from user preferences
 * This removes the last batch of event items that are no longer available
 */

import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.resolve(__dirname, 'push-tokens.db');
const JSON_PATH = path.resolve(__dirname, 'push-tokens.json');

// Event items to remove from preferences
const EVENT_ITEMS_TO_REMOVE = [
  "Zen Seed Pack", "Zen Egg", "Hot Spring", "Zen Sand", "Tranquil Radar", 
  "Corrupt Radar", "Zenflare", "Zen Crate", "Sakura Bush", "Soft Sunshine", 
  "Koi", "Zen Gnome Crate", "Spiked Mango", "Pet Shard Tranquil", 
  "Pet Shard Corrupted", "Raiju"
];

console.log('🗑️  Removing event item preferences from user preferences');
console.log('=' .repeat(60));
console.log(`📋 Event items to remove: ${EVENT_ITEMS_TO_REMOVE.length} items`);
EVENT_ITEMS_TO_REMOVE.forEach(item => console.log(`   - ${item}`));
console.log('');

async function removeEventPreferencesFromDatabase() {
  console.log('🗄️  Processing database preferences...');
  
  if (!fs.existsSync(DB_PATH)) {
    console.log('⚠️  Database file not found, skipping database processing');
    return { processed: 0, updated: 0 };
  }

  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH);
    let processed = 0;
    let updated = 0;

    // Get all tokens with preferences
    const sql = `
      SELECT id, token, preferences
      FROM push_tokens 
      WHERE is_active = 1 
      AND preferences IS NOT NULL 
      AND preferences != ''
      AND preferences != '{}'
    `;

    db.all(sql, [], (err, rows) => {
      if (err) {
        db.close();
        reject(err);
        return;
      }

      console.log(`📊 Found ${rows.length} users with preferences in database`);

      if (rows.length === 0) {
        db.close();
        resolve({ processed: 0, updated: 0 });
        return;
      }

      let processedCount = 0;
      const updatePromises = [];

      for (const row of rows) {
        processed++;
        
        try {
          const preferences = JSON.parse(row.preferences);
          const originalKeys = Object.keys(preferences);
          let hasChanges = false;

          // Remove event items from preferences
          for (const eventItem of EVENT_ITEMS_TO_REMOVE) {
            if (preferences.hasOwnProperty(eventItem)) {
              delete preferences[eventItem];
              hasChanges = true;
            }
          }

          if (hasChanges) {
            updated++;
            const newPreferences = JSON.stringify(preferences);
            
            const updateSql = 'UPDATE push_tokens SET preferences = ? WHERE id = ?';
            const updatePromise = new Promise((resolveUpdate, rejectUpdate) => {
              db.run(updateSql, [newPreferences, row.id], (updateErr) => {
                if (updateErr) {
                  console.error(`❌ Error updating token ${row.id}:`, updateErr);
                  rejectUpdate(updateErr);
                } else {
                  console.log(`✅ Updated preferences for token ${row.id} (${originalKeys.length} → ${Object.keys(preferences).length} items)`);
                  resolveUpdate();
                }
              });
            });
            
            updatePromises.push(updatePromise);
          }

          processedCount++;
          if (processedCount % 100 === 0) {
            console.log(`📈 Processed ${processedCount}/${rows.length} database entries...`);
          }

        } catch (parseErr) {
          console.error(`❌ Error parsing preferences for token ${row.id}:`, parseErr);
          processedCount++;
        }
      }

      // Wait for all updates to complete
      Promise.all(updatePromises)
        .then(() => {
          db.close();
          console.log(`✅ Database processing complete: ${processed} processed, ${updated} updated`);
          resolve({ processed, updated });
        })
        .catch((updateErr) => {
          db.close();
          reject(updateErr);
        });
    });
  });
}

async function removeEventPreferencesFromJSON() {
  console.log('\n📄 Processing JSON file preferences...');
  
  if (!fs.existsSync(JSON_PATH)) {
    console.log('⚠️  JSON file not found, skipping JSON processing');
    return { processed: 0, updated: 0 };
  }

  try {
    const jsonData = fs.readFileSync(JSON_PATH, 'utf8');
    const tokens = JSON.parse(jsonData);
    
    console.log(`📊 Found ${tokens.length} users in JSON file`);

    let processed = 0;
    let updated = 0;

    for (const token of tokens) {
      processed++;
      
      if (token.preferences && typeof token.preferences === 'object') {
        const originalKeys = Object.keys(token.preferences);
        let hasChanges = false;

        // Remove event items from preferences
        for (const eventItem of EVENT_ITEMS_TO_REMOVE) {
          if (token.preferences.hasOwnProperty(eventItem)) {
            delete token.preferences[eventItem];
            hasChanges = true;
          }
        }

        if (hasChanges) {
          updated++;
          console.log(`✅ Updated preferences for token ${token.token.substring(0, 20)}... (${originalKeys.length} → ${Object.keys(token.preferences).length} items)`);
        }
      }
    }

    // Save updated JSON file
    if (updated > 0) {
      fs.writeFileSync(JSON_PATH, JSON.stringify(tokens, null, 2));
      console.log(`💾 Saved updated JSON file with ${updated} changes`);
    }

    console.log(`✅ JSON processing complete: ${processed} processed, ${updated} updated`);
    return { processed, updated };

  } catch (error) {
    console.error('❌ Error processing JSON file:', error);
    return { processed: 0, updated: 0 };
  }
}

async function main() {
  try {
    console.log('🚀 Starting event preferences removal...\n');

    // Process database
    const dbStats = await removeEventPreferencesFromDatabase();
    
    // Process JSON file
    const jsonStats = await removeEventPreferencesFromJSON();

    // Summary
    console.log('\n📊 Summary:');
    console.log('=' .repeat(40));
    console.log(`🗄️  Database: ${dbStats.processed} processed, ${dbStats.updated} updated`);
    console.log(`📄 JSON: ${jsonStats.processed} processed, ${jsonStats.updated} updated`);
    console.log(`📈 Total: ${dbStats.processed + jsonStats.processed} processed, ${dbStats.updated + jsonStats.updated} updated`);
    
    const totalUpdated = dbStats.updated + jsonStats.updated;
    if (totalUpdated > 0) {
      console.log(`\n✅ Successfully removed event preferences from ${totalUpdated} users!`);
    } else {
      console.log('\nℹ️  No users had event preferences to remove.');
    }

  } catch (error) {
    console.error('❌ Error during preference removal:', error);
    process.exit(1);
  }
}

// Run the script
main();

#!/usr/bin/env node

/**
 * Check what preference keys exist in the database
 * This will help us see how items are stored in user preferences
 */

import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.resolve(__dirname, 'push-tokens.db');

async function checkPreferences() {
  console.log('🔍 Checking preference keys in database...');
  
  if (!fs.existsSync(DB_PATH)) {
    console.error('❌ Database file not found:', DB_PATH);
    process.exit(1);
  }

  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH);
    
    const sql = `
      SELECT preferences
      FROM push_tokens 
      WHERE is_active = 1 
      AND preferences IS NOT NULL 
      AND preferences != ''
      AND preferences != '{}'
      LIMIT 100
    `;
    
    db.all(sql, [], (err, rows) => {
      db.close();
      
      if (err) {
        reject(err);
        return;
      }
      
      const allKeys = new Set();
      const keyCounts = {};
      
      rows.forEach(row => {
        try {
          const preferences = JSON.parse(row.preferences);
          Object.keys(preferences).forEach(key => {
            allKeys.add(key);
            keyCounts[key] = (keyCounts[key] || 0) + 1;
          });
        } catch {
          // Skip invalid JSON
        }
      });
      
      console.log(`📊 Found ${allKeys.size} unique preference keys:`);
      console.log('');
      
      // Sort by count (most common first)
      const sortedKeys = Object.entries(keyCounts)
        .sort(([,a], [,b]) => b - a);
      
      sortedKeys.forEach(([key, count]) => {
        console.log(`  "${key}": ${count} users`);
      });
      
      console.log('');
      console.log('🔍 Looking for Giant Pinecone variations...');
      
      const pineconeKeys = sortedKeys.filter(([key]) => 
        key.toLowerCase().includes('pinecone') || 
        key.toLowerCase().includes('giant')
      );
      
      if (pineconeKeys.length > 0) {
        console.log('✅ Found Giant Pinecone related keys:');
        pineconeKeys.forEach(([key, count]) => {
          console.log(`  "${key}": ${count} users`);
        });
      } else {
        console.log('❌ No Giant Pinecone keys found');
      }
      
      resolve();
    });
  });
}

checkPreferences().catch(console.error); 
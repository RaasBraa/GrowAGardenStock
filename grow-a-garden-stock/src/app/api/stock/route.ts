import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

interface StockCategory {
  items: unknown[];
  lastUpdated: string;
  nextUpdate: string;
  refreshIntervalMinutes: number;
}

interface TransformedStockData {
  seeds: StockCategory;
  gear: StockCategory;
  eggs: StockCategory;
  cosmetics: StockCategory;
  weather?: unknown;
  lastUpdated: string;
}

export async function GET() {
  const stockFilePath = path.resolve(process.cwd(), 'stock-data.json');

  try {
    if (fs.existsSync(stockFilePath)) {
      const fileContents = fs.readFileSync(stockFilePath, 'utf-8');
      const data = JSON.parse(fileContents);
      
      // Transform the data to the new structure with individual timestamps
      const transformedData = {
        lastUpdated: data.lastUpdated // Keep for backward compatibility
      } as TransformedStockData;
      
      // Process each category
      ['seeds', 'gear', 'eggs', 'cosmetics'].forEach(category => {
        const categoryKey = category as keyof Pick<TransformedStockData, 'seeds' | 'gear' | 'eggs' | 'cosmetics'>;
        
        // Define refresh intervals in minutes for each category
        const refreshIntervals = {
          seeds: 5,
          gear: 5,
          eggs: 30,
          cosmetics: 240
        };
        
        if (data[category]) {
          if (typeof data[category] === 'object' && data[category].items && data[category].lastUpdated) {
            // New structure already exists
            const lastUpdated = data[category].lastUpdated;
            const refreshIntervalMinutes = data[category].refreshIntervalMinutes || refreshIntervals[category as keyof typeof refreshIntervals] || 5;
            
            // Calculate next scheduled update time based on the interval
            const lastUpdateDate = new Date(lastUpdated);
            const minutesSinceEpoch = Math.floor(lastUpdateDate.getTime() / (1000 * 60));
            const intervalsSinceEpoch = Math.floor(minutesSinceEpoch / refreshIntervalMinutes);
            const nextScheduledMinute = (intervalsSinceEpoch + 1) * refreshIntervalMinutes;
            const nextUpdate = data[category].nextUpdate || new Date(nextScheduledMinute * 60 * 1000).toISOString();
            
            transformedData[categoryKey] = {
              items: data[category].items,
              lastUpdated: lastUpdated,
              nextUpdate: nextUpdate,
              refreshIntervalMinutes: refreshIntervalMinutes
            };
          } else {
            // Old structure - migrate to new structure
            const lastUpdated = data.lastUpdated || new Date().toISOString();
            const refreshIntervalMinutes = refreshIntervals[category as keyof typeof refreshIntervals] || 5;
            
            // Calculate next scheduled update time based on the interval
            const lastUpdateDate = new Date(lastUpdated);
            const minutesSinceEpoch = Math.floor(lastUpdateDate.getTime() / (1000 * 60));
            const intervalsSinceEpoch = Math.floor(minutesSinceEpoch / refreshIntervalMinutes);
            const nextScheduledMinute = (intervalsSinceEpoch + 1) * refreshIntervalMinutes;
            const nextUpdate = new Date(nextScheduledMinute * 60 * 1000).toISOString();
            
            transformedData[categoryKey] = {
              items: data[category],
              lastUpdated: lastUpdated,
              nextUpdate: nextUpdate,
              refreshIntervalMinutes: refreshIntervalMinutes
            };
          }
        } else {
          // Category doesn't exist - provide empty structure
          const lastUpdated = data.lastUpdated || new Date().toISOString();
          const refreshIntervalMinutes = refreshIntervals[category as keyof typeof refreshIntervals] || 5;
          
          // Calculate next scheduled update time based on the interval
          const lastUpdateDate = new Date(lastUpdated);
          const minutesSinceEpoch = Math.floor(lastUpdateDate.getTime() / (1000 * 60));
          const intervalsSinceEpoch = Math.floor(minutesSinceEpoch / refreshIntervalMinutes);
          const nextScheduledMinute = (intervalsSinceEpoch + 1) * refreshIntervalMinutes;
          const nextUpdate = new Date(nextScheduledMinute * 60 * 1000).toISOString();
          
          transformedData[categoryKey] = {
            items: [],
            lastUpdated: lastUpdated,
            nextUpdate: nextUpdate,
            refreshIntervalMinutes: refreshIntervalMinutes
          };
        }
      });
      
      // Weather data remains unchanged
      if (data.weather) {
        transformedData.weather = data.weather;
      }
      
      return NextResponse.json(transformedData);
    } else {
      // If the file doesn't exist yet, return an empty object with a timestamp.
      // The mobile app can then know that data is not yet available.
      const currentTime = new Date().toISOString();
      const refreshIntervals = {
        seeds: 5,
        gear: 5,
        eggs: 30,
        cosmetics: 240
      };
      
      return NextResponse.json({ 
        seeds: { 
          items: [], 
          lastUpdated: currentTime,
          nextUpdate: (() => {
            const minutesSinceEpoch = Math.floor(new Date(currentTime).getTime() / (1000 * 60));
            const intervalsSinceEpoch = Math.floor(minutesSinceEpoch / refreshIntervals.seeds);
            const nextScheduledMinute = (intervalsSinceEpoch + 1) * refreshIntervals.seeds;
            return new Date(nextScheduledMinute * 60 * 1000).toISOString();
          })(),
          refreshIntervalMinutes: refreshIntervals.seeds
        },
        gear: { 
          items: [], 
          lastUpdated: currentTime,
          nextUpdate: (() => {
            const minutesSinceEpoch = Math.floor(new Date(currentTime).getTime() / (1000 * 60));
            const intervalsSinceEpoch = Math.floor(minutesSinceEpoch / refreshIntervals.gear);
            const nextScheduledMinute = (intervalsSinceEpoch + 1) * refreshIntervals.gear;
            return new Date(nextScheduledMinute * 60 * 1000).toISOString();
          })(),
          refreshIntervalMinutes: refreshIntervals.gear
        },
        eggs: { 
          items: [], 
          lastUpdated: currentTime,
          nextUpdate: (() => {
            const minutesSinceEpoch = Math.floor(new Date(currentTime).getTime() / (1000 * 60));
            const intervalsSinceEpoch = Math.floor(minutesSinceEpoch / refreshIntervals.eggs);
            const nextScheduledMinute = (intervalsSinceEpoch + 1) * refreshIntervals.eggs;
            return new Date(nextScheduledMinute * 60 * 1000).toISOString();
          })(),
          refreshIntervalMinutes: refreshIntervals.eggs
        },
        cosmetics: { 
          items: [], 
          lastUpdated: currentTime,
          nextUpdate: (() => {
            const minutesSinceEpoch = Math.floor(new Date(currentTime).getTime() / (1000 * 60));
            const intervalsSinceEpoch = Math.floor(minutesSinceEpoch / refreshIntervals.cosmetics);
            const nextScheduledMinute = (intervalsSinceEpoch + 1) * refreshIntervals.cosmetics;
            return new Date(nextScheduledMinute * 60 * 1000).toISOString();
          })(),
          refreshIntervalMinutes: refreshIntervals.cosmetics
        },
        lastUpdated: currentTime
      }, { status: 404 });
    }
  } catch (error) {
    console.error('Error reading stock data file:', error);
    return NextResponse.json({ error: 'Failed to read stock data.' }, { status: 500 });
  }
} 
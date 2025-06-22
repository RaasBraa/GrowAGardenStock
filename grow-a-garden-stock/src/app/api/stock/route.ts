import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

interface StockCategory {
  items: unknown[];
  lastUpdated: string;
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
        
        if (data[category]) {
          if (typeof data[category] === 'object' && data[category].items && data[category].lastUpdated) {
            // New structure already exists
            transformedData[categoryKey] = {
              items: data[category].items,
              lastUpdated: data[category].lastUpdated
            };
          } else {
            // Old structure - migrate to new structure
            transformedData[categoryKey] = {
              items: data[category],
              lastUpdated: data.lastUpdated || new Date().toISOString()
            };
          }
        } else {
          // Category doesn't exist - provide empty structure
          transformedData[categoryKey] = {
            items: [],
            lastUpdated: data.lastUpdated || new Date().toISOString()
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
      return NextResponse.json({ 
        seeds: { items: [], lastUpdated: currentTime },
        gear: { items: [], lastUpdated: currentTime },
        eggs: { items: [], lastUpdated: currentTime },
        cosmetics: { items: [], lastUpdated: currentTime },
        lastUpdated: currentTime
      }, { status: 404 });
    }
  } catch (error) {
    console.error('Error reading stock data file:', error);
    return NextResponse.json({ error: 'Failed to read stock data.' }, { status: 500 });
  }
} 
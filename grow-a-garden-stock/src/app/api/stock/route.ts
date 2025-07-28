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
  events: StockCategory;
  travellingMerchant?: {
    items: unknown[];
    lastUpdated: string;
    isActive: boolean;
  };
  // Support both old and new weather formats for backward compatibility
  weather?: {
    // New multiple weather format
    activeWeather?: Array<{
      current: string;
      endsAt: string;
    }>;
    lastUpdated?: string;
    // Old single weather format (for backward compatibility)
    current?: string;
    endsAt?: string;
  };
  lastUpdated: string;
}

export async function GET() {
  const stockFilePath = path.resolve(process.cwd(), 'stock-data.json');

  try {
    // Simply read and serve the data from the stock manager
    if (fs.existsSync(stockFilePath)) {
      const fileContents = fs.readFileSync(stockFilePath, 'utf-8');
      
      // Validate JSON before parsing
      let data;
      try {
        data = JSON.parse(fileContents);
      } catch (parseError) {
        console.error('❌ Error parsing stock-data.json:', parseError);
        console.error('📄 File contents preview:', fileContents.substring(0, 200) + '...');
        
        // Return error response
        return NextResponse.json(
          { 
            error: 'Stock data file is corrupted',
            message: 'The stock data file appears to be corrupted. Please try again later.',
            timestamp: new Date().toISOString()
          }, 
          { status: 500 }
        );
      }
      
      // Transform the data to the new structure with individual timestamps
      const transformedData = {
        lastUpdated: data.lastUpdated // Keep for backward compatibility
      } as TransformedStockData;
      
      // Process each category
      ['seeds', 'gear', 'eggs', 'cosmetics', 'events'].forEach(category => {
        const categoryKey = category as keyof Pick<TransformedStockData, 'seeds' | 'gear' | 'eggs' | 'cosmetics' | 'events'>;
        
        // Define refresh intervals in minutes for each category
        const refreshIntervals = {
          seeds: 5,
          gear: 5,
          eggs: 30,
          cosmetics: 240,
          events: 30
        };
        
        const categoryData = data[category as keyof typeof data];
        const refreshInterval = refreshIntervals[category as keyof typeof refreshIntervals];
        
        if (categoryData && categoryData.items) {
          transformedData[categoryKey] = {
            items: categoryData.items,
            lastUpdated: categoryData.lastUpdated || data.lastUpdated,
            nextUpdate: categoryData.nextUpdate || new Date(Date.now() + refreshInterval * 60 * 1000).toISOString(),
            refreshIntervalMinutes: refreshInterval
          };
        } else {
          // Provide default structure if category is missing
          transformedData[categoryKey] = {
            items: [],
            lastUpdated: data.lastUpdated || new Date().toISOString(),
            nextUpdate: new Date(Date.now() + refreshInterval * 60 * 1000).toISOString(),
            refreshIntervalMinutes: refreshInterval
          };
        }
      });
      
      // Add weather and travelling merchant data if available
      if (data.weather) {
        // Handle both old single weather format and new multiple weather format
        if (data.weather.activeWeather && Array.isArray(data.weather.activeWeather)) {
          // New multiple weather format - provide both formats for backward compatibility
          const activeWeather = data.weather.activeWeather;
          if (activeWeather.length > 0) {
            // Use the first active weather for backward compatibility
            const firstWeather = activeWeather[0];
            transformedData.weather = {
              // New format
              activeWeather: activeWeather,
              lastUpdated: data.weather.lastUpdated,
              // Old format for backward compatibility
              current: firstWeather.current,
              endsAt: firstWeather.endsAt
            };
          } else {
            // No active weather
            transformedData.weather = {
              activeWeather: [],
              lastUpdated: data.weather.lastUpdated
            };
          }
        } else if (data.weather.current && data.weather.endsAt) {
          // Old single weather format - provide both formats
          transformedData.weather = {
            // New format
            activeWeather: [data.weather],
            lastUpdated: data.weather.lastUpdated || data.lastUpdated,
            // Old format for backward compatibility
            current: data.weather.current,
            endsAt: data.weather.endsAt
          };
        }
      }
      
      if (data.travellingMerchant) {
        transformedData.travellingMerchant = data.travellingMerchant;
      }
      
      return NextResponse.json(transformedData);
    } else {
      // File doesn't exist, return empty data structure
      const now = new Date().toISOString();
      const emptyData: TransformedStockData = {
        lastUpdated: now,
        seeds: { items: [], lastUpdated: now, nextUpdate: now, refreshIntervalMinutes: 5 },
        gear: { items: [], lastUpdated: now, nextUpdate: now, refreshIntervalMinutes: 5 },
        eggs: { items: [], lastUpdated: now, nextUpdate: now, refreshIntervalMinutes: 30 },
        cosmetics: { items: [], lastUpdated: now, nextUpdate: now, refreshIntervalMinutes: 240 },
        events: { items: [], lastUpdated: now, nextUpdate: now, refreshIntervalMinutes: 30 }
      };
      
      return NextResponse.json(emptyData);
    }
  } catch (error) {
    console.error('Error reading stock data file:', error);
    return NextResponse.json({ error: 'Failed to read stock data.' }, { status: 500 });
  }
} 
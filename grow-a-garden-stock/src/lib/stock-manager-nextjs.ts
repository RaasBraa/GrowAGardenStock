// Next.js compatible version of stock-manager
// This version only provides the interfaces and basic data access
// without importing the full stock manager that requires ts-node

export interface StockItem {
  id: string;
  name: string;
  quantity: number;
  stockId?: string;
}

export interface WeatherInfo {
  current: string;
  endsAt: string;
}

export interface TravellingMerchantItem {
  id: string;
  name: string;
  quantity: number;
  price?: number;
}

export interface StockCategory {
  items: StockItem[];
  lastUpdated: string;
  nextUpdate: string;
  refreshIntervalMinutes: number;
  lastStockId?: string;
}

export interface AllStockData {
  lastUpdated: string;
  seeds: StockCategory;
  gear: StockCategory;
  eggs: StockCategory;
  cosmetics: StockCategory;
  events: StockCategory;
  weather?: WeatherInfo;
  travellingMerchant?: {
    items: TravellingMerchantItem[];
    lastUpdated: string;
    isActive: boolean;
  };
}

import * as fs from 'fs';
import * as path from 'path';

// Simple function to get stock data from file
export function getStockData(): AllStockData {
  try {
    const stockDataPath = path.resolve(process.cwd(), 'stock-data.json');
    
    if (fs.existsSync(stockDataPath)) {
      const data = JSON.parse(fs.readFileSync(stockDataPath, 'utf-8'));
      return data;
    }
  } catch (error) {
    console.error('Error loading stock data:', error);
  }
  
  // Return empty data if file doesn't exist or error
  const now = new Date().toISOString();
  return {
    lastUpdated: now,
    seeds: { items: [], lastUpdated: now, nextUpdate: now, refreshIntervalMinutes: 5 },
    gear: { items: [], lastUpdated: now, nextUpdate: now, refreshIntervalMinutes: 5 },
    eggs: { items: [], lastUpdated: now, nextUpdate: now, refreshIntervalMinutes: 30 },
    cosmetics: { items: [], lastUpdated: now, nextUpdate: now, refreshIntervalMinutes: 240 },
    events: { items: [], lastUpdated: now, nextUpdate: now, refreshIntervalMinutes: 30 }
  };
} 
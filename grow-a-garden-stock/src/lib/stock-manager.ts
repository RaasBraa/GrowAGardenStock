import * as fs from 'fs';
import * as path from 'path';
import { jstudioWebSocket } from './jstudio-websocket.js';
import { initializeDiscordListener as initializeCactusDiscord } from './discord-listener.js';
import { initializeDiscordListener as initializeVulcanDiscord } from './discord-listener-vulcan.js';
import { sendItemNotification, sendWeatherAlertNotification, sendCategoryNotification } from './pushNotifications.js';
import { randomUUID } from 'crypto';


// Stock data structure that matches your API format
export interface StockItem {
  id: string;
  name: string;
  quantity: number;
  stockId?: string; // Unique ID for this stock update
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
  start_date_unix?: number;
  end_date_unix?: number;
}

export interface TravellingMerchantData {
  merchantName: string;
  items: TravellingMerchantItem[];
  lastUpdated: string;
  isActive: boolean;
}

export interface StockCategory {
  items: StockItem[];
  lastUpdated: string;
  nextUpdate: string;
  refreshIntervalMinutes: number;
  lastStockId?: string; // Track the last stock update ID
}

export interface AllStockData {
  lastUpdated: string;
  seeds: StockCategory;
  gear: StockCategory;
  eggs: StockCategory;
  cosmetics: StockCategory;
  events: StockCategory;
  weather?: WeatherInfo;
  travellingMerchant?: TravellingMerchantData;
}

// Source tracking with better timing
export interface SourceInfo {
  name: 'websocket' | 'cactus' | 'vulcan';
  lastUpdate: string;
  isOnline: boolean;
  lastDataHash: string;
  lastSuccessfulUpdate: string; // Track when we last got valid data
  lastMessageReceived: string; // Track when we last received any message
}

class StockManager {
  private stockData: AllStockData;
  private stockDataPath: string;
  private sources: Map<string, SourceInfo> = new Map();
  private previousStockData: AllStockData | null = null;
  
  // Timing configuration - much more reasonable timeouts
  private readonly REFRESH_INTERVALS = {
    seeds: 5,
    gear: 5,
    eggs: 30,
    cosmetics: 240,
    events: 30
  };
  
  // Source priority and timing thresholds - much more reasonable
  // Note: For weather updates, Discord sources (Cactus primary, Vulcan backup) are preferred
  // WebSocket weather updates are ignored due to unreliable data structure
  private readonly SOURCE_PRIORITY = {
    websocket: { priority: 1, maxDelayMinutes: 10, minUpdateIntervalMinutes: 1 },
    cactus: { priority: 2, maxDelayMinutes: 10, minUpdateIntervalMinutes: 2 },
    vulcan: { priority: 3, maxDelayMinutes: 10, minUpdateIntervalMinutes: 5 }
  };

  constructor() {
    this.stockDataPath = path.resolve(process.cwd(), 'stock-data.json');
    this.stockData = this.loadOrCreateStockData();
    this.initializeSources();
  }

  private loadOrCreateStockData(): AllStockData {
    try {
      if (fs.existsSync(this.stockDataPath)) {
        const data = JSON.parse(fs.readFileSync(this.stockDataPath, 'utf-8'));
        // Ensure all required fields exist
        return this.ensureStockDataStructure(data);
      }
    } catch (error) {
      console.error('Error loading stock data:', error);
    }
    
    return this.createEmptyStockData();
  }

  private ensureStockDataStructure(data: Partial<AllStockData>): AllStockData {
    const now = new Date().toISOString();
    return {
      lastUpdated: data.lastUpdated || now,
      seeds: data.seeds || this.createEmptyCategory('seeds'),
      gear: data.gear || this.createEmptyCategory('gear'),
      eggs: data.eggs || this.createEmptyCategory('eggs'),
      cosmetics: data.cosmetics || this.createEmptyCategory('cosmetics'),
      events: data.events || this.createEmptyCategory('events'),
      weather: data.weather,
      travellingMerchant: data.travellingMerchant
    };
  }

  private createEmptyCategory(category: string): StockCategory {
    const now = new Date().toISOString();
    return {
      items: [],
      lastUpdated: now,
      nextUpdate: this.calculateNextUpdate(this.REFRESH_INTERVALS[category as keyof typeof this.REFRESH_INTERVALS]),
      refreshIntervalMinutes: this.REFRESH_INTERVALS[category as keyof typeof this.REFRESH_INTERVALS]
    };
  }

  private createEmptyStockData(): AllStockData {
    const now = new Date().toISOString();
    return {
      lastUpdated: now,
      seeds: this.createEmptyCategory('seeds'),
      gear: this.createEmptyCategory('gear'),
      eggs: this.createEmptyCategory('eggs'),
      cosmetics: this.createEmptyCategory('cosmetics'),
      events: this.createEmptyCategory('events')
    };
  }

  private initializeSources() {
    this.sources.set('websocket', {
      name: 'websocket',
      lastUpdate: new Date(0).toISOString(),
      isOnline: false,
      lastDataHash: '',
      lastSuccessfulUpdate: new Date(0).toISOString(),
      lastMessageReceived: new Date(0).toISOString()
    });
    
    this.sources.set('cactus', {
      name: 'cactus',
      lastUpdate: new Date(0).toISOString(),
      isOnline: false,
      lastDataHash: '',
      lastSuccessfulUpdate: new Date(0).toISOString(),
      lastMessageReceived: new Date(0).toISOString()
    });
    
    this.sources.set('vulcan', {
      name: 'vulcan',
      lastUpdate: new Date(0).toISOString(),
      isOnline: false,
      lastDataHash: '',
      lastSuccessfulUpdate: new Date(0).toISOString(),
      lastMessageReceived: new Date(0).toISOString()
    });
  }

  public async start() {
    console.log('🚀 Starting Stock Manager with multi-source coordination...');
    
    // Start JStudio WebSocket (primary source)
    console.log('📡 Starting JStudio WebSocket listener...');
    await jstudioWebSocket.start();
    this.updateSourceStatus('websocket', true);
    
    // Start Cactus Discord (backup 1)
    console.log('🌵 Starting Cactus Discord listener...');
    initializeCactusDiscord();
    this.updateSourceStatus('cactus', true);
    
    // Start Vulcan Discord (backup 2)
    console.log('🔥 Starting Vulcan Discord listener...');
    initializeVulcanDiscord();
    this.updateSourceStatus('vulcan', true);
    
    // Set up periodic validation - every 2 minutes instead of 30 seconds
    setInterval(() => this.validateDataConsistency(), 120000);
    
    console.log('✅ Stock Manager started successfully!');
    console.log('📊 Multi-source coordination active');
    console.log('🔍 Data validation and source prioritization enabled');
  }

  public async updateStockData(
    source: 'websocket' | 'cactus' | 'vulcan',
    category: keyof Pick<AllStockData, 'seeds' | 'gear' | 'eggs' | 'cosmetics' | 'events'>,
    items: StockItem[],
    weather?: WeatherInfo,
    travellingMerchant?: TravellingMerchantItem[],
    merchantName?: string
  ) {
    const now = new Date().toISOString();
    const sourceInfo = this.sources.get(source);
    
    if (!sourceInfo) {
      console.error(`❌ Unknown source: ${source}`);
      return;
    }

    // Always update last message received timestamp
    sourceInfo.lastMessageReceived = now;
    sourceInfo.isOnline = true;

    // Check if this is a weather-only update (empty items array with weather data)
    const isWeatherUpdate = items.length === 0 && weather !== undefined;
    
    // Check if we should accept this update based on source priority
    if (!this.shouldAcceptUpdate(source, category, isWeatherUpdate)) {
      console.log(`⏭️ Skipping ${source} update for ${category} - higher priority source has recent data`);
      return;
    }

    // Update source info for successful updates
    sourceInfo.lastUpdate = now;
    sourceInfo.lastSuccessfulUpdate = now;
    
    // Create data hash for comparison
    const dataHash = this.createDataHash(category, items, weather);
    
    // Check if this is newer data than what we have
    if (!this.shouldUpdateData(source, category, dataHash)) {
      console.log(`⏭️ Skipping ${source} update for ${category} - data not newer`);
      return;
    }

    console.log(`📥 Received ${source} update for ${category}:`, items.length, 'items');
    
    // Validate that critical categories are not empty
    if ((category === 'seeds' || category === 'gear' || category === 'eggs') && items.length === 0) {
      console.log(`⚠️ Rejecting empty ${category} update from ${source} - shop should never be completely empty`);
      return;
    }
    
    // Generate stock ID for this update
    const stockId = randomUUID();
    console.log(`🆔 Generated stock ID: ${stockId.substring(0, 8)}...`);
    
    // Store previous data for comparison
    this.previousStockData = JSON.parse(JSON.stringify(this.stockData));
    
    // Update the stock data with stock IDs
    if (category === 'seeds' || category === 'gear' || category === 'eggs' || category === 'cosmetics') {
      const itemsWithStockId = items.map(item => ({
        ...item,
        stockId: stockId
      }));
      
      this.stockData[category] = {
        items: itemsWithStockId,
        lastUpdated: now,
        nextUpdate: this.calculateNextUpdate(this.REFRESH_INTERVALS[category]),
        refreshIntervalMinutes: this.REFRESH_INTERVALS[category],
        lastStockId: stockId
      };
    }
    
    if (weather) {
      this.stockData.weather = weather;
    }
    
    if (travellingMerchant) {
      this.stockData.travellingMerchant = {
        merchantName: merchantName || 'Unknown Merchant',
        items: travellingMerchant,
        lastUpdated: now,
        isActive: travellingMerchant.length > 0
      };
    }
    
    this.stockData.lastUpdated = now;
    sourceInfo.lastDataHash = dataHash;
    
    // Save to file
    this.saveStockData();
    
    // Send notifications (only for new/changed items)
    this.sendNotifications(stockId, category, items, weather);
    
    console.log(`✅ Updated stock data from ${source} for ${category}`);
  }

  private shouldAcceptUpdate(source: string, category: string, isWeatherUpdate: boolean = false): boolean {
    const sourceConfig = this.SOURCE_PRIORITY[source as keyof typeof this.SOURCE_PRIORITY];
    const now = Date.now();
    
    // Special handling for weather updates - they should be treated as their own category
    if (isWeatherUpdate && this.stockData.weather) {
      // For weather updates, check against weather last update time instead of seeds
      const weatherLastUpdated = this.stockData.weather.endsAt; // Use weather end time as reference
      const currentTime = new Date(weatherLastUpdated).getTime();
      const timeSinceLastUpdate = now - currentTime;
      const minUpdateInterval = sourceConfig.minUpdateIntervalMinutes * 60 * 1000;
      
      // Check if enough time has passed since last weather update
      if (timeSinceLastUpdate < minUpdateInterval) {
        return false;
      }
    } else {
      // Normal category handling
      const currentCategory = this.stockData[category as keyof AllStockData];
      
      if (!currentCategory || typeof currentCategory !== 'object' || !('lastUpdated' in currentCategory)) {
        return true; // No existing data, accept any update
      }
      
      const currentLastUpdated = (currentCategory as StockCategory).lastUpdated;
      const currentTime = new Date(currentLastUpdated).getTime();
      const timeSinceLastUpdate = now - currentTime;
      const minUpdateInterval = sourceConfig.minUpdateIntervalMinutes * 60 * 1000;
      
      // Check if enough time has passed since last update
      if (timeSinceLastUpdate < minUpdateInterval) {
        return false;
      }
    }
    
    // Check if a higher priority source has updated recently
    for (const [sourceName, sourceInfo] of this.sources) {
      const sourcePriority = this.SOURCE_PRIORITY[sourceName as keyof typeof this.SOURCE_PRIORITY];
      if (sourcePriority.priority < sourceConfig.priority) {
        const lastUpdate = new Date(sourceInfo.lastSuccessfulUpdate).getTime();
        const timeSinceHigherPriorityUpdate = now - lastUpdate;
        const higherPriorityThreshold = sourcePriority.maxDelayMinutes * 60 * 1000;
        
        // If higher priority source updated recently, don't accept lower priority
        if (timeSinceHigherPriorityUpdate < higherPriorityThreshold) {
          return false;
        }
      }
    }
    
    return true;
  }

  private shouldUpdateData(source: string, category: string, dataHash: string): boolean {
    const sourceInfo = this.sources.get(source);
    if (!sourceInfo) return false;
    
    // If this is the same data we already have, skip
    if (sourceInfo.lastDataHash === dataHash) {
      return false;
    }
    
    // Check if this source is more recent than our current data
    const currentCategory = this.stockData[category as keyof AllStockData];
    if (currentCategory && typeof currentCategory === 'object' && 'lastUpdated' in currentCategory) {
      const currentLastUpdated = (currentCategory as StockCategory).lastUpdated;
      const currentTime = new Date(currentLastUpdated).getTime();
      const sourceTime = new Date(sourceInfo.lastUpdate).getTime();
      
      // Only update if source data is newer
      if (sourceTime <= currentTime) {
        return false;
      }
    }
    
    return true;
  }

  private createDataHash(category: string, items: StockItem[], weather?: WeatherInfo): string {
    const data = {
      category,
      items: items.map(item => `${item.id}:${item.quantity}`).sort().join(','),
      weather: weather ? `${weather.current}:${weather.endsAt}` : ''
    };
    
    return JSON.stringify(data);
  }

  private async sendNotifications(
    stockId: string,
    category: string,
    items: StockItem[],
    weather?: WeatherInfo
  ) {
    // Send weather notifications
    if (weather) {
      await sendWeatherAlertNotification(weather.current, `Ends: ${weather.endsAt}`);
    }
    
    // Send notifications based on category type
    switch (category) {
      case 'seeds':
      case 'gear':
      case 'eggs':
        // Per-item notifications for these categories
        for (const item of items) {
          const shouldNotify = this.shouldNotifyForItem();
          if (shouldNotify) {
            await sendItemNotification(item.name, item.quantity, category);
          }
        }
        break;
        
      case 'cosmetics':
        // Category-level notification for cosmetics
        if (items.length > 0) {
          await sendCategoryNotification('Cosmetics', 'Cosmetics', 'New cosmetic items are available in the shop!');
        }
        break;
        
      case 'travellingMerchant':
        // Category-level notification for travelling merchant
        if (items.length > 0) {
          await sendCategoryNotification('Travelling Merchant', 'Travelling Merchant', 'The travelling merchant has arrived with new items!');
        }
        break;
        
      case 'events':
        // Category-level notification for events
        if (items.length > 0) {
          await sendCategoryNotification('Events', 'Events', 'New event items are available!');
        }
        break;
        
      default:
        console.log(`⚠️ Unknown category for notifications: ${category}`);
        break;
    }
  }

  private shouldNotifyForItem(): boolean {
    // Always send notifications for stock updates (removed quantity change and time delay checks)
    return true;
  }

  private validateDataConsistency() {
    console.log('🔍 Validating data consistency between sources...');
    
    const now = new Date();
    const sources = Array.from(this.sources.values());
    
    // Check for offline sources with more reasonable timeouts
    for (const source of sources) {
      const lastMessageTime = new Date(source.lastMessageReceived).getTime();
      const timeDiff = now.getTime() - lastMessageTime;
      const maxDelay = this.SOURCE_PRIORITY[source.name].maxDelayMinutes * 60 * 1000;
      
      if (timeDiff > maxDelay) {
        source.isOnline = false;
        console.log(`⚠️ Source ${source.name} appears offline (last message: ${source.lastMessageReceived})`);
      } else {
        source.isOnline = true;
      }
    }
    
    // Log source status
    const onlineSources = sources.filter(s => s.isOnline);
    console.log(`📊 Online sources: ${onlineSources.map(s => s.name).join(', ')}`);
  }

  private updateSourceStatus(source: string, isOnline: boolean) {
    const sourceInfo = this.sources.get(source);
    if (sourceInfo) {
      sourceInfo.isOnline = isOnline;
      if (isOnline) {
        sourceInfo.lastUpdate = new Date().toISOString();
      }
    }
  }

  private calculateNextUpdate(intervalMinutes: number): string {
    const now = new Date();
    const minutesSinceEpoch = Math.floor(now.getTime() / (1000 * 60));
    const intervalsSinceEpoch = Math.floor(minutesSinceEpoch / intervalMinutes);
    const nextScheduledMinute = (intervalsSinceEpoch + 1) * intervalMinutes;
    return new Date(nextScheduledMinute * 60 * 1000).toISOString();
  }

  private saveStockData() {
    try {
      fs.writeFileSync(this.stockDataPath, JSON.stringify(this.stockData, null, 2));
      console.log('💾 Stock data saved successfully');
    } catch (error) {
      console.error('❌ Error saving stock data:', error);
    }
  }

  public getStockData(): AllStockData {
    return this.stockData;
  }

  public getSourceStatus(): SourceInfo[] {
    return Array.from(this.sources.values());
  }

  public stop() {
    console.log('🛑 Stopping Stock Manager...');
    jstudioWebSocket.stop();
    // Note: Discord listeners don't have explicit stop methods, they'll be cleaned up by process exit
  }

  public updateSourceActivity(source: 'websocket' | 'cactus' | 'vulcan') {
    const sourceInfo = this.sources.get(source);
    if (sourceInfo) {
      sourceInfo.lastMessageReceived = new Date().toISOString();
      sourceInfo.isOnline = true;
    }
  }
}

export const stockManager = new StockManager(); 
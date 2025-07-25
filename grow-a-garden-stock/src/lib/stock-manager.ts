import * as fs from 'fs';
import * as path from 'path';
import { jstudioWebSocket } from './jstudio-websocket.js';
import { initializeDiscordListener as initializeCactusDiscord } from './discord-listener.js';
import { initializeDiscordListener as initializeVulcanDiscord } from './discord-listener-vulcan.js';
import { sendItemNotification, sendWeatherAlertNotification, sendCategoryNotification } from './notification-manager.js';
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
  private lastTravellingMerchantNotification: string | null = null; // Track last notification to prevent duplicates
  
  // Rate limiting to prevent server overload
  private lastUpdateTime: { [key: string]: number } = {};
  private readonly MIN_UPDATE_INTERVAL = 2000; // 2 seconds between updates for same category
  
  // Background notification queue to prevent blocking
  private notificationQueue: Array<() => Promise<void>> = [];
  private isProcessingNotifications = false;
  
  // Validation logging control
  private lastValidationLog: number | null = null;
  private lastOnlineCount: number = 0;
  private lastSaveLog: number | null = null;
  
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
    websocket: { priority: 1, maxDelayMinutes: 2, minUpdateIntervalMinutes: 1 },
    cactus: { priority: 2, maxDelayMinutes: 2, minUpdateIntervalMinutes: 2 },
    vulcan: { priority: 3, maxDelayMinutes: 2, minUpdateIntervalMinutes: 5 }
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
    
    // Start WebSocket listener
    console.log('📡 Starting JStudio WebSocket listener...');
    jstudioWebSocket.start();
    
    // Start Discord listeners
    console.log('🌵 Starting Cactus Discord listener...');
    initializeCactusDiscord();
    
    console.log('🔥 Starting Vulcan Discord listener...');
    initializeVulcanDiscord();
    
    // Set up periodic checks
    setInterval(() => {
      this.validateDataConsistency();
      this.checkAndClearExpiredTravellingMerchant();
    }, 60000); // Check every 60 seconds instead of 30
    
    console.log('✅ Stock Manager started successfully!');
    console.log('📊 Multi-source coordination is now active');
    console.log('🌐 API endpoint: http://103.45.246.244:3000/api/stock');
    console.log('💡 The Stock Manager will automatically:');
    console.log('   • Prioritize JStudio WebSocket as primary source (99% uptime)');
    console.log('   • Use Cactus Discord as backup 1 (faster updates)');
    console.log('   • Use Vulcan Discord as backup 2 (last resort)');
    console.log('   • Validate data consistency between sources');
    console.log('   • Prevent duplicate notifications');
    console.log('   • Handle travelling merchant updates');
    console.log('   • Clear expired travelling merchant data');
    console.log('   • Save data to stock-data.json');
    console.log('   • Serve data via /api/stock endpoint');
    console.log('   • Send push notifications to mobile app');
    console.log('📱 Your mobile app will get instant updates!');
    console.log('🔍 Data validation and source monitoring active');
  }

  public async updateStockData(
    source: 'websocket' | 'cactus' | 'vulcan',
    category: keyof Pick<AllStockData, 'seeds' | 'gear' | 'eggs' | 'cosmetics' | 'events'>,
    items: StockItem[],
    weather?: WeatherInfo,
    travellingMerchant?: TravellingMerchantItem[],
    merchantName?: string
  ) {
    const now = Date.now();
    const updateKey = `${source}-${category}`;
    
    // Rate limiting: prevent too frequent updates
    if (this.lastUpdateTime[updateKey] && (now - this.lastUpdateTime[updateKey]) < this.MIN_UPDATE_INTERVAL) {
      console.log(`⏭️ Rate limited: ${source} update for ${category} - too soon since last update`);
      return;
    }
    
    this.lastUpdateTime[updateKey] = now;
    
    const nowISO = new Date().toISOString();
    const sourceInfo = this.sources.get(source);
    
    if (!sourceInfo) {
      console.error(`❌ Unknown source: ${source}`);
      return;
    }

    // Always update last message received timestamp
    sourceInfo.lastMessageReceived = nowISO;
    sourceInfo.isOnline = true;

    // Check if this is a weather-only update (empty items array with weather data)
    const isWeatherUpdate = items.length === 0 && weather !== undefined;
    
    // Check if this is a travelling merchant update (empty items array with travelling merchant data)
    const isTravellingMerchantUpdate = items.length === 0 && travellingMerchant !== undefined;
    
    if (isWeatherUpdate) {
      console.log(`🌤️ Processing weather-only update from ${source}`);
    }
    
    if (isTravellingMerchantUpdate) {
      console.log(`🛒 Processing travelling merchant update from ${source}`);
    }
    
    // Check if we should accept this update based on source priority
    if (!this.shouldAcceptUpdate(source, category, isWeatherUpdate, travellingMerchant)) {
      console.log(`⏭️ Skipping ${source} update for ${category} - higher priority source has recent data`);
      return;
    }

    // Update source info for successful updates
    sourceInfo.lastUpdate = nowISO;
    sourceInfo.lastSuccessfulUpdate = nowISO;
    
    // Create data hash for comparison
    const dataHash = this.createDataHash(category, items, weather, travellingMerchant, merchantName);
    
    // Check if this is newer data than what we have
    if (!this.shouldUpdateData(source, category, dataHash)) {
      console.log(`⏭️ Skipping ${source} update for ${category} - data not newer`);
      return;
    }

    console.log(`📥 Received ${source} update for ${category}:`, items.length, 'items');
    
    // Validate that critical categories are not empty (but allow weather-only updates and travelling merchant updates)
    if ((category === 'seeds' || category === 'gear' || category === 'eggs') && items.length === 0 && !weather && !travellingMerchant) {
      console.log(`⚠️ Rejecting empty ${category} update from ${source} - shop should never be completely empty`);
      return;
    }
    
    // Generate stock ID for this update
    const stockId = randomUUID();
    console.log(`🆔 Generated stock ID: ${stockId.substring(0, 8)}...`);
    
    // Store previous data for comparison
    this.previousStockData = JSON.parse(JSON.stringify(this.stockData));
    
    console.log(`💾 About to save travelling merchant data:`, travellingMerchant ? travellingMerchant.length : 0, 'items');
    
    // Update the stock data with stock IDs
    if (category === 'seeds' || category === 'gear' || category === 'eggs' || category === 'cosmetics' || category === 'events') {
      // For weather-only updates, preserve existing items
      if (isWeatherUpdate) {
        console.log(`🌤️ Weather-only update: preserving existing ${category} items`);
        // Don't update the category items, just update the timestamp
        this.stockData[category].lastUpdated = nowISO;
      } else if (isTravellingMerchantUpdate) {
        console.log(`🛒 Travelling merchant update: preserving existing ${category} items`);
        // Don't update the category items, just update the timestamp
        this.stockData[category].lastUpdated = nowISO;
      } else {
        // Normal update with new items
        const itemsWithStockId = items.map(item => ({
          ...item,
          stockId: stockId
        }));
        
        this.stockData[category] = {
          items: itemsWithStockId,
          lastUpdated: nowISO,
          nextUpdate: this.calculateNextUpdate(this.REFRESH_INTERVALS[category]),
          refreshIntervalMinutes: this.REFRESH_INTERVALS[category],
          lastStockId: stockId
        };
      }
    }
    
    if (weather) {
      this.stockData.weather = weather;
      console.log(`🌤️ Weather data updated: ${weather.current}`);
    }
    
    if (travellingMerchant !== undefined) {
      // Handle travelling merchant updates (both arrival and departure)
      if (travellingMerchant.length > 0) {
        // Merchant has arrived with items
        console.log(`🛒 About to save travelling merchant data with ${travellingMerchant.length} items`);
        this.stockData.travellingMerchant = {
          merchantName: merchantName || 'Unknown Merchant',
          items: travellingMerchant,
          lastUpdated: nowISO,
          isActive: true
        };
        console.log(`🛒 Travelling merchant data updated: ${merchantName || 'Unknown Merchant'} with ${travellingMerchant.length} items`);
      } else {
        // Merchant has left (empty array)
        console.log(`🛒 Clearing travelling merchant data - merchant has left`);
        this.stockData.travellingMerchant = {
          merchantName: 'No Merchant',
          items: [],
          lastUpdated: nowISO,
          isActive: false
        };
      }
    }
    
    this.stockData.lastUpdated = nowISO;
    sourceInfo.lastDataHash = dataHash;
    
    // Save to file
    this.saveStockData();
    
    // Check for expired travelling merchant data
    this.checkAndClearExpiredTravellingMerchant();
    
    // Send notifications (only for new/changed items)
    this.sendNotifications(stockId, category, items, weather, travellingMerchant, merchantName);
    
    console.log(`✅ Updated stock data from ${source} for ${category}`);
  }

  private shouldAcceptUpdate(source: string, category: string, isWeatherUpdate: boolean = false, travellingMerchant?: TravellingMerchantItem[]): boolean {
    const sourceConfig = this.SOURCE_PRIORITY[source as keyof typeof this.SOURCE_PRIORITY];
    const now = Date.now();
    
    console.log(`🔍 Checking if should accept ${source} update for ${category}`);
    console.log(`🔍 Is weather update: ${isWeatherUpdate}`);
    console.log(`🔍 Has travelling merchant: ${travellingMerchant ? travellingMerchant.length : 0} items`);
    
    // Special handling for weather updates - they should be treated as their own category
    if (isWeatherUpdate) {
      // For weather updates, always accept them regardless of timing
      // Weather updates are important and should override timing restrictions
      console.log(`🔍 Accepting weather update from ${source}`);
      return true;
    }
    
    // Special handling for travelling merchant updates - always accept them regardless of timing
    if (travellingMerchant !== undefined) {
      // For travelling merchant updates (both arrival and departure), always accept them regardless of timing
      // Travelling merchant updates are important and should override timing restrictions
      console.log(`🔍 Accepting travelling merchant update from ${source} (${travellingMerchant.length} items)`);
      return true;
    }
    
    // Normal category handling
    const currentCategory = this.stockData[category as keyof AllStockData];
    
    if (!currentCategory || typeof currentCategory !== 'object' || !('lastUpdated' in currentCategory)) {
      console.log(`🔍 Accepting ${source} update for ${category} - no existing data`);
      return true; // No existing data, accept any update
    }
    
    const currentLastUpdated = (currentCategory as StockCategory).lastUpdated;
    const currentTime = new Date(currentLastUpdated).getTime();
    const timeSinceLastUpdate = now - currentTime;
    const minUpdateInterval = sourceConfig.minUpdateIntervalMinutes * 60 * 1000;
    
    console.log(`🔍 Time since last update: ${timeSinceLastUpdate}ms, min interval: ${minUpdateInterval}ms`);
    
    // Check if enough time has passed since last update
    if (timeSinceLastUpdate < minUpdateInterval) {
      console.log(`🔍 Rejecting ${source} update for ${category} - too soon since last update`);
      return false;
    }
    
    // Check if a higher priority source has updated recently
    for (const [sourceName, sourceInfo] of this.sources) {
      const sourcePriority = this.SOURCE_PRIORITY[sourceName as keyof typeof this.SOURCE_PRIORITY];
      // Check if this source has higher priority (lower number) than the current source
      if (sourcePriority.priority < sourceConfig.priority) {
        const lastUpdate = new Date(sourceInfo.lastSuccessfulUpdate).getTime();
        const timeSinceHigherPriorityUpdate = now - lastUpdate;
        const higherPriorityThreshold = sourcePriority.maxDelayMinutes * 60 * 1000;
        
        console.log(`🔍 Checking ${sourceName} (priority ${sourcePriority.priority}) vs ${source} (priority ${sourceConfig.priority})`);
        console.log(`🔍 Time since ${sourceName} update: ${timeSinceHigherPriorityUpdate}ms, threshold: ${higherPriorityThreshold}ms`);
        
        // If higher priority source updated recently, don't accept lower priority
        if (timeSinceHigherPriorityUpdate < higherPriorityThreshold) {
          console.log(`🔍 Rejecting ${source} update for ${category} - higher priority source ${sourceName} updated recently`);
          return false;
        }
      }
    }
    
    console.log(`🔍 Accepting ${source} update for ${category}`);
    return true;
  }

  private shouldUpdateData(source: string, category: string, dataHash: string): boolean {
    const sourceInfo = this.sources.get(source);
    if (!sourceInfo) return false;
    
    console.log(`🔍 shouldUpdateData: checking if ${source} update for ${category} should be saved`);
    console.log(`🔍 Current data hash: ${sourceInfo.lastDataHash}`);
    console.log(`🔍 New data hash: ${dataHash}`);
    
    // If this is the same data we already have, skip
    if (sourceInfo.lastDataHash === dataHash) {
      console.log(`🔍 Rejecting ${source} update for ${category} - same data hash`);
      return false;
    }
    
    // Special handling for weather updates - always accept new weather data
    if (category === 'seeds' && dataHash.includes('weather')) {
      console.log(`🔍 Accepting ${source} update for ${category} - weather update`);
      return true;
    }
    
    // Special handling for travelling merchant updates - always accept new travelling merchant data
    if (dataHash.includes('travellingMerchant')) {
      console.log(`🔍 Accepting ${source} update for ${category} - travelling merchant update`);
      return true;
    }
    
    // Check if enough time has passed since the last update for this category
    const currentCategory = this.stockData[category as keyof AllStockData];
    if (currentCategory && typeof currentCategory === 'object' && 'lastUpdated' in currentCategory) {
      const currentLastUpdated = (currentCategory as StockCategory).lastUpdated;
      const currentTime = new Date(currentLastUpdated).getTime();
      const now = Date.now();
      const timeSinceLastUpdate = now - currentTime;
      const minInterval = 60000; // 1 minute minimum interval
      
      console.log(`🔍 Current category last updated: ${currentLastUpdated}`);
      console.log(`🔍 Time since last update: ${timeSinceLastUpdate}ms, min interval: ${minInterval}ms`);
      
      // Only update if enough time has passed since last update
      if (timeSinceLastUpdate < minInterval) {
        console.log(`🔍 Rejecting ${source} update for ${category} - too soon since last update`);
        return false;
      }
    }
    
    console.log(`🔍 Accepting ${source} update for ${category} - enough time has passed`);
    return true;
  }

  private createDataHash(category: string, items: StockItem[], weather?: WeatherInfo, travellingMerchant?: TravellingMerchantItem[], merchantName?: string): string {
    const data = {
      category,
      items: items.map(item => `${item.id}:${item.quantity}`).sort().join(','),
      weather: weather ? `${weather.current}:${weather.endsAt}` : '',
      travellingMerchant: travellingMerchant ? {
        merchantName,
        items: travellingMerchant.map(item => `${item.id}:${item.quantity}`).sort().join(',')
      } : ''
    };
    
    const hash = JSON.stringify(data);
    console.log(`🔍 Created data hash for ${category}:`, hash);
    return hash;
  }

  private async sendNotifications(
    stockId: string,
    category: string,
    items: StockItem[],
    weather?: WeatherInfo,
    travellingMerchant?: TravellingMerchantItem[],
    merchantName?: string
  ) {
    console.log(`🔔 Queueing notifications for category: ${category}`);
    
    // Queue the notification task instead of sending immediately
    this.notificationQueue.push(async () => {
      console.log(`🔔 Processing queued notifications for category: ${category}`);
      console.log(`🔔 Items to notify for: ${items.length}`);
      console.log(`🔔 Weather to notify for: ${weather ? weather.current : 'none'}`);
      console.log(`🔔 Travelling merchant to notify for: ${travellingMerchant ? travellingMerchant.length : 0} items`);
      
      // Send weather notifications
      if (weather) {
        await sendWeatherAlertNotification(weather.current, `Ends: ${weather.endsAt}`);
      }
      
      // Send travelling merchant notifications (only when merchant arrives with items)
      if (travellingMerchant && travellingMerchant.length > 0) {
        // Create a unique identifier for this travelling merchant update
        const merchantIdentifier = `${merchantName || 'Unknown'}-${travellingMerchant.map(item => `${item.id}:${item.quantity}`).sort().join(',')}`;
        
        // Only send notification if we haven't already sent one for this exact merchant with these exact items
        if (this.lastTravellingMerchantNotification !== merchantIdentifier) {
          console.log(`🔔 Sending travelling merchant notification for: ${merchantName || 'Unknown Merchant'}`);
          await sendCategoryNotification('Travelling Merchant', 'Travelling Merchant', `The ${merchantName || 'travelling'} merchant has arrived with new items!`);
          this.lastTravellingMerchantNotification = merchantIdentifier;
          console.log(`🔔 Travelling merchant notification sent and tracked: ${merchantIdentifier}`);
        } else {
          console.log(`🔔 Skipping travelling merchant notification - already sent for: ${merchantIdentifier}`);
        }
      } else if (travellingMerchant && travellingMerchant.length === 0) {
        // Clear the notification tracking when merchant leaves
        this.lastTravellingMerchantNotification = null;
        console.log(`🔔 Cleared travelling merchant notification tracking - merchant has left`);
      }
      
      // Send notifications based on category type
      switch (category) {
        case 'seeds':
        case 'gear':
        case 'eggs':
          console.log(`🔔 Processing ${category} notifications for ${items.length} items`);
          // Per-item notifications for these categories
          for (const item of items) {
            const shouldNotify = this.shouldNotifyForItem();
            console.log(`🔔 Should notify for ${item.name}: ${shouldNotify}`);
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
      
      console.log(`🔔 Queued notification process completed for category: ${category}`);
    });
    
    // Start processing the queue if not already running
    this.processNotificationQueue();
  }

  private async processNotificationQueue() {
    if (this.isProcessingNotifications || this.notificationQueue.length === 0) {
      return;
    }
    
    this.isProcessingNotifications = true;
    
    try {
      while (this.notificationQueue.length > 0) {
        const notificationTask = this.notificationQueue.shift();
        if (notificationTask) {
          try {
            await notificationTask();
          } catch (error) {
            console.error('❌ Error processing notification:', error);
          }
        }
        
        // Small delay between notifications to prevent overload
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } finally {
      this.isProcessingNotifications = false;
    }
  }

  private shouldNotifyForItem(): boolean {
    // Always send notifications for stock updates (removed quantity change and time delay checks)
    return true;
  }

  private validateDataConsistency() {
    // Only log validation every 5 minutes to reduce spam
    const now = Date.now();
    if (!this.lastValidationLog || (now - this.lastValidationLog) > 300000) { // 5 minutes
      console.log('🔍 Validating data consistency between sources...');
      this.lastValidationLog = now;
    }
    
    const sources = Array.from(this.sources.values());
    
    // Check for offline sources with more reasonable timeouts
    for (const source of sources) {
      const lastMessageTime = new Date(source.lastMessageReceived).getTime();
      const timeDiff = now - lastMessageTime;
      const maxDelay = this.SOURCE_PRIORITY[source.name].maxDelayMinutes * 60 * 1000;
      
      if (timeDiff > maxDelay) {
        source.isOnline = false;
        // Only log offline status if it changed
        if (source.isOnline !== false) {
          console.log(`⚠️ Source ${source.name} appears offline (last message: ${source.lastMessageReceived})`);
        }
      } else {
        source.isOnline = true;
      }
    }
    
    // Only log source status if there are changes
    const onlineSources = sources.filter(s => s.isOnline);
    const onlineCount = onlineSources.length;
    if (this.lastOnlineCount !== onlineCount) {
      console.log(`📊 Online sources: ${onlineSources.map(s => s.name).join(', ')} (${onlineCount}/${sources.length})`);
      this.lastOnlineCount = onlineCount;
    }
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
      // Only log saves every 30 seconds to reduce spam
      const now = Date.now();
      if (!this.lastSaveLog || (now - this.lastSaveLog) > 30000) { // 30 seconds
        console.log('💾 Saving stock data...');
        this.lastSaveLog = now;
      }
      fs.writeFileSync(this.stockDataPath, JSON.stringify(this.stockData, null, 2));
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

  private checkAndClearExpiredTravellingMerchant() {
    if (!this.stockData.travellingMerchant || !this.stockData.travellingMerchant.isActive) {
      return;
    }

    const now = Date.now() / 1000; // Current time in seconds
    const merchant = this.stockData.travellingMerchant;
    
    // Check if any items have end dates that have passed
    const hasExpiredItems = merchant.items.some(item => {
      if (item.end_date_unix) {
        const hasExpired = now > item.end_date_unix;
        if (hasExpired) {
          console.log(`🛒 Travelling merchant item ${item.name} has expired (end time: ${new Date(item.end_date_unix * 1000).toISOString()})`);
        }
        return hasExpired;
      }
      return false;
    });

    if (hasExpiredItems) {
      console.log(`🛒 Clearing expired travelling merchant data`);
      this.stockData.travellingMerchant = {
        merchantName: 'No Merchant',
        items: [],
        lastUpdated: new Date().toISOString(),
        isActive: false
      };
      this.saveStockData();
    }
  }
}

export const stockManager = new StockManager(); 
import * as fs from 'fs';
import * as path from 'path';
import { jstudioWebSocket } from './jstudio-websocket.js';
import { growAGardenProWebSocket } from './growagardenpro-websocket.js';
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

export interface MultipleWeatherInfo {
  activeWeather: WeatherInfo[];
  lastUpdated: string;
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
  weather?: MultipleWeatherInfo;
  travellingMerchant?: TravellingMerchantData;
}

// Source tracking with better timing
export interface SourceInfo {
  name: 'gagpro' | 'websocket' | 'cactus' | 'vulcan';
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
  private lastWeatherNotifications: Map<string, string> = new Map(); // Track last weather notification for each type
  
  // Duplicate item detection to prevent spam notifications
  private itemAppearanceHistory: Map<string, Array<{ timestamp: number; quantity: number }>> = new Map();
  private readonly DUPLICATE_DETECTION_WINDOW = 15 * 60 * 1000; // 15 minutes (longer window to catch daily seeds)
  private readonly MAX_SAME_QUANTITY_APPEARANCES = 2; // Max appearances with same quantity before filtering (more aggressive)
  private duplicateHistoryPath: string;
  private lastDailySeedReset: string = ''; // Track when daily seeds last changed
  
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
    gagpro: { priority: 0, maxDelayMinutes: 2, minUpdateIntervalMinutes: 1 }, // Primary: GrowAGardenPro WebSocket
    websocket: { priority: 1, maxDelayMinutes: 2, minUpdateIntervalMinutes: 1 }, // Backup 1: JStudio WebSocket
    cactus: { priority: 2, maxDelayMinutes: 2, minUpdateIntervalMinutes: 2 }, // Backup 2: Cactus Discord
    vulcan: { priority: 3, maxDelayMinutes: 2, minUpdateIntervalMinutes: 5 } // Backup 3: Vulcan Discord
  };

  constructor() {
    this.stockDataPath = path.resolve(process.cwd(), 'stock-data.json');
    this.duplicateHistoryPath = path.resolve(process.cwd(), 'duplicate-history.json');
    this.stockData = this.loadOrCreateStockData();
    this.loadDuplicateHistory();
    this.initializeSources();
  }

  private loadOrCreateStockData(): AllStockData {
    try {
      if (fs.existsSync(this.stockDataPath)) {
        // Use atomic read to prevent corruption
        const data = fs.readFileSync(this.stockDataPath, 'utf-8');
        const parsedData = JSON.parse(data);
        // Ensure all required fields exist
        return this.ensureStockDataStructure(parsedData);
      }
    } catch (error) {
      console.error('Error loading stock data:', error);
      // If file is corrupted, try to backup and create new one
      if (fs.existsSync(this.stockDataPath)) {
        const backupPath = `${this.stockDataPath}.corrupted.${Date.now()}`;
        try {
          fs.renameSync(this.stockDataPath, backupPath);
          console.log(`💾 Corrupted stock data backed up to: ${backupPath}`);
        } catch (backupError) {
          console.error('Failed to backup corrupted file:', backupError);
        }
      }
    }
    
    return this.createEmptyStockData();
  }

  private ensureStockDataStructure(data: Partial<AllStockData>): AllStockData {
    const now = new Date().toISOString();
    
    // Handle weather data conversion from old format to new format
    let weatherData: MultipleWeatherInfo | undefined;
    if (data.weather) {
      if (data.weather.activeWeather && Array.isArray(data.weather.activeWeather)) {
        // Already in new format
        weatherData = data.weather as MultipleWeatherInfo;
      } else {
        // Check if it's old single weather format
        const oldWeather = data.weather as unknown as { current?: string; endsAt?: string; lastUpdated?: string };
        if (oldWeather.current && oldWeather.endsAt) {
          // Convert old single weather format to new multiple weather format
          weatherData = {
            activeWeather: [{ current: oldWeather.current, endsAt: oldWeather.endsAt }],
            lastUpdated: oldWeather.lastUpdated || now
          };
          console.log('🔄 Converted old weather format to new multiple weather format');
        }
      }
    }
    
    return {
      lastUpdated: data.lastUpdated || now,
      seeds: data.seeds || this.createEmptyCategory('seeds'),
      gear: data.gear || this.createEmptyCategory('gear'),
      eggs: data.eggs || this.createEmptyCategory('eggs'),
      cosmetics: data.cosmetics || this.createEmptyCategory('cosmetics'),
      events: data.events || this.createEmptyCategory('events'),
      weather: weatherData,
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
    this.sources.set('gagpro', {
      name: 'gagpro',
      lastUpdate: new Date(0).toISOString(),
      isOnline: false,
      lastDataHash: '',
      lastSuccessfulUpdate: new Date(0).toISOString(),
      lastMessageReceived: new Date(0).toISOString()
    });
    
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

  /**
   * Check if an item should be filtered due to frequent appearances with same quantity
   * This prevents spam notifications for "daily seeds" that refresh frequently
   */
  private shouldFilterDuplicateItem(itemId: string, quantity: number): boolean {
    const now = Date.now();
    const itemKey = `${itemId}`;
    
    // Get or create appearance history for this item
    if (!this.itemAppearanceHistory.has(itemKey)) {
      this.itemAppearanceHistory.set(itemKey, []);
    }
    
    const history = this.itemAppearanceHistory.get(itemKey)!;
    
    // Clean old entries outside the detection window
    const cutoffTime = now - this.DUPLICATE_DETECTION_WINDOW;
    const recentHistory = history.filter(entry => entry.timestamp > cutoffTime);
    
    // Count appearances with the same quantity in the recent window (BEFORE adding current)
    const sameQuantityCount = recentHistory.filter(entry => entry.quantity === quantity).length;
    
    // Filter if this quantity has appeared too many times recently
    const shouldFilter = sameQuantityCount >= this.MAX_SAME_QUANTITY_APPEARANCES;
    
    // Always add current appearance to history (for tracking purposes)
    recentHistory.push({ timestamp: now, quantity });
    this.itemAppearanceHistory.set(itemKey, recentHistory);
    
    // Save the updated history
    this.saveDuplicateHistory();
    
    if (shouldFilter) {
      console.log(`🚫 Filtering duplicate seed: ${itemId} (quantity: ${quantity}) - appeared ${sameQuantityCount + 1} times with same quantity in ${this.DUPLICATE_DETECTION_WINDOW / 60000} minutes`);
    }
    
    return shouldFilter;
  }

  /**
   * Load duplicate detection history from file
   */
  private loadDuplicateHistory(): void {
    try {
      if (fs.existsSync(this.duplicateHistoryPath)) {
        const data = fs.readFileSync(this.duplicateHistoryPath, 'utf-8');
        const parsedData = JSON.parse(data);
        
        // Check if daily seeds have changed (new day)
        const today = new Date().toDateString();
        if (parsedData.lastDailySeedReset !== today) {
          console.log('🌅 New day detected - clearing duplicate history for fresh daily seeds');
          this.itemAppearanceHistory.clear();
          this.lastDailySeedReset = today;
          this.saveDuplicateHistory();
          return;
        }
        
        // Load the history
        this.itemAppearanceHistory = new Map(parsedData.history);
        this.lastDailySeedReset = parsedData.lastDailySeedReset || today;
        
        console.log(`📚 Loaded duplicate history for ${this.itemAppearanceHistory.size} items`);
      } else {
        console.log('📚 No duplicate history file found - starting fresh');
        this.lastDailySeedReset = new Date().toDateString();
      }
    } catch (error) {
      console.error('❌ Error loading duplicate history:', error);
      this.itemAppearanceHistory.clear();
      this.lastDailySeedReset = new Date().toDateString();
    }
  }

  /**
   * Save duplicate detection history to file
   */
  private saveDuplicateHistory(): void {
    try {
      const data = {
        lastDailySeedReset: this.lastDailySeedReset,
        history: Array.from(this.itemAppearanceHistory.entries()),
        lastSaved: new Date().toISOString()
      };
      
      // Atomic write to prevent corruption
      const tempPath = `${this.duplicateHistoryPath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
      fs.renameSync(tempPath, this.duplicateHistoryPath);
      
    } catch (error) {
      console.error('❌ Error saving duplicate history:', error);
    }
  }

  /**
   * Clean up old appearance history to prevent memory leaks
   */
  private cleanupAppearanceHistory(): void {
    const now = Date.now();
    const cutoffTime = now - this.DUPLICATE_DETECTION_WINDOW;
    
    for (const [itemKey, history] of this.itemAppearanceHistory.entries()) {
      const recentHistory = history.filter(entry => entry.timestamp > cutoffTime);
      
      if (recentHistory.length === 0) {
        this.itemAppearanceHistory.delete(itemKey);
      } else {
        this.itemAppearanceHistory.set(itemKey, recentHistory);
      }
    }
    
    // Save the cleaned history
    this.saveDuplicateHistory();
  }

  public async start() {
    console.log('🚀 Starting Stock Manager with multi-source coordination...');
    
    // Start primary WebSocket listener (GrowAGardenPro)
    console.log('📡 Starting GrowAGardenPro WebSocket listener (Primary)...');
    growAGardenProWebSocket.start();
    
    // Start backup WebSocket listener (JStudio)
    console.log('📡 Starting JStudio WebSocket listener (Backup)...');
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
      this.cleanupAppearanceHistory(); // Clean up duplicate detection history
    }, 60000); // Check every 60 seconds instead of 30
    
    console.log('✅ Stock Manager started successfully!');
    console.log('📊 Multi-source coordination is now active');
    console.log('🌐 API endpoint: http://103.45.246.244:3000/api/stock');
    console.log('💡 The Stock Manager will automatically:');
    console.log('   • Prioritize GrowAGardenPro WebSocket as primary source');
    console.log('   • Use JStudio WebSocket as backup 1');
    console.log('   • Use Cactus Discord as backup 2');
    console.log('   • Use Vulcan Discord as backup 3');
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
    source: 'gagpro' | 'websocket' | 'cactus' | 'vulcan',
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
      // Initialize weather structure if it doesn't exist
      if (!this.stockData.weather) {
        this.stockData.weather = {
          activeWeather: [],
          lastUpdated: nowISO
        };
      }
      
      // Add this weather event to the active weather list
      // Use case-insensitive comparison to prevent duplicates (e.g., "Rain" vs "rain")
      const normalizedWeatherName = weather.current.toLowerCase();
      const existingIndex = this.stockData.weather.activeWeather.findIndex(w => w.current.toLowerCase() === normalizedWeatherName);
      if (existingIndex >= 0) {
        // Update existing weather event - preserve capitalized name if it exists, update endsAt
        const existingWeather = this.stockData.weather.activeWeather[existingIndex];
        existingWeather.endsAt = weather.endsAt;
        // Use capitalized version if the new one is capitalized (first letter uppercase, rest lowercase)
        const isProperlyCapitalized = weather.current.charAt(0) === weather.current.charAt(0).toUpperCase() && 
                                      weather.current.slice(1).toLowerCase() === weather.current.slice(1);
        if (isProperlyCapitalized) {
          existingWeather.current = weather.current;
        }
      } else {
        // Add new weather event
        this.stockData.weather.activeWeather.push(weather);
      }
      
      // Clean up expired weather events and their notification tracking
      this.stockData.weather.activeWeather = this.stockData.weather.activeWeather.filter(w => {
        const endTime = new Date(w.endsAt);
        const now = new Date();
        const isExpired = endTime.getTime() <= now.getTime();
        
        if (isExpired) {
          console.log(`🌤️ Removing expired weather event: ${w.current}`);
          // Remove notification tracking for expired weather
          this.lastWeatherNotifications.delete(w.current);
        }
        
        return !isExpired;
      });
      
      this.stockData.weather.lastUpdated = nowISO;
      console.log(`🌤️ Weather data updated: ${weather.current} (${this.stockData.weather.activeWeather.length} active weather events)`);
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
    
    // Send notifications for new weather events only (if this was a weather update)
    // Only send weather notifications from the highest priority source to prevent duplicates
    if (weather && this.stockData.weather && this.stockData.weather.activeWeather.length > 0) {
      // Check if this is the highest priority source for weather updates
      const isHighestPrioritySource = this.isHighestPrioritySource(source);
      
      console.log(`🌤️ Checking for new weather events to notify...`);
      console.log(`🌤️ Active weather events: ${this.stockData.weather.activeWeather.length}`);
      console.log(`🌤️ Is highest priority source: ${isHighestPrioritySource}`);
      
      if (isHighestPrioritySource) {
        // Only send notifications for weather events that are new or have changed
        for (const activeWeather of this.stockData.weather.activeWeather) {
          const weatherKey = `${activeWeather.current}-${activeWeather.endsAt}`;
          const lastNotification = this.lastWeatherNotifications.get(activeWeather.current);
          
          console.log(`🌤️ Checking weather: ${activeWeather.current}`);
          console.log(`🌤️ Current key: ${weatherKey}`);
          console.log(`🌤️ Last notification: ${lastNotification || 'none'}`);
          
          if (lastNotification !== weatherKey) {
            console.log(`🌤️ New weather event detected: ${activeWeather.current} - sending notification`);
            await this.sendWeatherNotification(activeWeather);
            this.lastWeatherNotifications.set(activeWeather.current, weatherKey);
            console.log(`🌤️ Weather notification sent and tracked: ${activeWeather.current}`);
          } else {
            console.log(`🌤️ Weather event already notified: ${activeWeather.current} - skipping`);
          }
        }
      } else {
        console.log(`🌤️ Skipping weather notification - not highest priority source (${source})`);
      }
    }
    
    console.log(`✅ Updated stock data from ${source} for ${category}`);
  }

  private shouldAcceptUpdate(source: string, category: string, isWeatherUpdate: boolean = false, travellingMerchant?: TravellingMerchantItem[]): boolean {
    const sourceConfig = this.SOURCE_PRIORITY[source as keyof typeof this.SOURCE_PRIORITY];
    const now = Date.now();
    
    console.log(`🔍 Checking if should accept ${source} update for ${category}`);
    console.log(`🔍 Is weather update: ${isWeatherUpdate}`);
    console.log(`🔍 Has travelling merchant: ${travellingMerchant ? travellingMerchant.length : 0} items`);
    
    // Special handling for weather updates - check if weather data is actually new
    if (isWeatherUpdate) {
      // For weather updates, we need to check if the data is actually new
      // The actual data hash check will be done in shouldUpdateData
      console.log(`🔍 Weather update detected from ${source} - will check data hash in shouldUpdateData`);
      return true; // Let shouldUpdateData handle the actual check
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
    
    // Special handling for weather updates - check if weather data is actually new
    if (category === 'seeds' && dataHash.includes('weather')) {
      console.log(`🔍 Weather update detected - checking if data is new`);
      // Only accept if the data hash is different (meaning weather actually changed)
      if (sourceInfo.lastDataHash !== dataHash) {
        console.log(`🔍 Accepting ${source} update for ${category} - new weather data`);
        return true;
      } else {
        console.log(`🔍 Rejecting ${source} update for ${category} - same weather data`);
        return false;
      }
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
    // For weather updates, normalize the end time to prevent minor time differences from creating different hashes
    let normalizedWeather = '';
    if (weather) {
      // Round the end time to the nearest minute to prevent minor time differences
      const endTime = new Date(weather.endsAt);
      const roundedEndTime = new Date(endTime.getFullYear(), endTime.getMonth(), endTime.getDate(), 
        endTime.getHours(), endTime.getMinutes(), 0, 0); // Round to nearest minute
      normalizedWeather = `${weather.current}:${roundedEndTime.toISOString()}`;
    }
    
    const data = {
      category,
      items: items.map(item => `${item.id}:${item.quantity}`).sort().join(','),
      weather: normalizedWeather,
      travellingMerchant: travellingMerchant ? {
        merchantName,
        items: travellingMerchant.map(item => `${item.id}:${item.quantity}`).sort().join(',')
      } : ''
    };
    
    const hash = JSON.stringify(data);
    console.log(`🔍 Created data hash for ${category}:`, hash);
    return hash;
  }

  private async sendWeatherNotification(weather: WeatherInfo) {
    // Calculate time remaining
    const now = new Date();
    const endTime = new Date(weather.endsAt);
    const timeRemainingMs = endTime.getTime() - now.getTime();
    const timeRemainingSeconds = Math.max(0, Math.floor(timeRemainingMs / 1000));
    const timeRemainingMinutes = Math.floor(timeRemainingSeconds / 60);
    const remainingSeconds = timeRemainingSeconds % 60;
    
    let timeMessage;
    if (timeRemainingSeconds === 0) {
      timeMessage = "Ends now!";
    } else if (timeRemainingMinutes < 10) {
      // Include seconds for less than 10 minutes
      if (timeRemainingMinutes === 0) {
        timeMessage = `Ends in ${remainingSeconds} seconds`;
      } else if (remainingSeconds === 0) {
        timeMessage = `Ends in ${timeRemainingMinutes} minutes`;
      } else {
        timeMessage = `Ends in ${timeRemainingMinutes}m ${remainingSeconds}s`;
      }
    } else if (timeRemainingMinutes < 60) {
      timeMessage = `Ends in ${timeRemainingMinutes} minutes`;
    } else {
      const hours = Math.floor(timeRemainingMinutes / 60);
      const minutes = timeRemainingMinutes % 60;
      timeMessage = `Ends in ${hours}h ${minutes}m`;
    }
    
    console.log(`🌤️ Sending weather notification: ${weather.current} - ${timeMessage}`);
    await sendWeatherAlertNotification(weather.current, timeMessage);
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
      
      // Weather notifications are now handled by the new multiple weather system
      // to prevent duplicate notifications
      
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
            
            // Only apply duplicate filtering to seeds (where daily seeds cause spam)
            if (category === 'seeds') {
              console.log(`🔍 Checking duplicate filter for ${item.name} (${item.id}, quantity: ${item.quantity})`);
              const shouldFilterDuplicate = this.shouldFilterDuplicateItem(item.id, item.quantity);
              console.log(`🔍 Duplicate filter result for ${item.name}: ${shouldFilterDuplicate}`);
              if (shouldFilterDuplicate) {
                console.log(`🚫 Skipping notification for ${item.name} due to duplicate filtering`);
                continue;
              }
            }
            
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
          // Per-item notifications for events (changed from category-level)
          console.log(`🔔 Processing ${category} notifications for ${items.length} items`);
          for (const item of items) {
            const shouldNotify = this.shouldNotifyForItem();
            console.log(`🔔 Should notify for ${item.name}: ${shouldNotify}`);
            
            // Events don't need duplicate filtering (they're not daily seeds)
            if (shouldNotify) {
              await sendItemNotification(item.name, item.quantity, category);
            }
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
      
      // Use atomic write to prevent corruption
      const tempPath = `${this.stockDataPath}.tmp`;
      const data = JSON.stringify(this.stockData, null, 2);
      
      // Write to temporary file first
      fs.writeFileSync(tempPath, data, 'utf8');
      
      // Then atomically rename to final location
      fs.renameSync(tempPath, this.stockDataPath);
      
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
    growAGardenProWebSocket.stop();
    jstudioWebSocket.stop();
    // Note: Discord listeners don't have explicit stop methods, they'll be cleaned up by process exit
  }

  public updateSourceActivity(source: 'gagpro' | 'websocket' | 'cactus' | 'vulcan') {
    const sourceInfo = this.sources.get(source);
    if (sourceInfo) {
      sourceInfo.lastMessageReceived = new Date().toISOString();
      sourceInfo.isOnline = true;
    }
  }

  private isHighestPrioritySource(source: string): boolean {
    const sourceConfig = this.SOURCE_PRIORITY[source as keyof typeof this.SOURCE_PRIORITY];
    if (!sourceConfig) return false;
    
    // Check if this source has the highest priority (lowest priority number)
    for (const [sourceName] of this.sources) {
      const otherSourceConfig = this.SOURCE_PRIORITY[sourceName as keyof typeof this.SOURCE_PRIORITY];
      if (otherSourceConfig && otherSourceConfig.priority < sourceConfig.priority) {
        // Found a source with higher priority (lower number)
        return false;
      }
    }
    
    return true;
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
interface JStudioStockItem {
  item_id: string;
  display_name: string;
  quantity: number;
  start_date_unix: number;
  end_date_unix: number;
  Date_Start: string;
  Date_End: string;
}

interface JStudioStockData {
  discord_invite: string;
  seed_stock: JStudioStockItem[];
  gear_stock: JStudioStockItem[];
  egg_stock: JStudioStockItem[];
  cosmetic_stock: JStudioStockItem[];
  eventshop_stock: JStudioStockItem[];
}

interface JStudioWeatherItem {
  weather_id: string;
  end_duration_unix: number;
  active: boolean;
  duration: number;
  start_duration_unix: number;
  weather_name: string;
}

interface JStudioWeatherData {
  discord_invite: string;
  weather: JStudioWeatherItem[];
}

interface JStudioItemInfo {
  item_id: string;
  display_name: string;
  rarity: string;
  currency: string;
  price: number;
  description: string;
  last_seen: string;
  duration: number;
}

interface CachedData<T> {
  data: T;
  timestamp: number;
}

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
  events?: StockCategory;
  weather?: unknown;
  lastUpdated: string;
}

class JStudioAPIService {
  private baseUrl = 'https://api.joshlei.com/v2/growagarden';
  private cache: Map<string, CachedData<unknown>> = new Map();
  private cacheTimeout = 30000; // 30 seconds

  private async fetchWithCache<T>(endpoint: string): Promise<T> {
    const cacheKey = endpoint;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data as T;
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        headers: {
          'User-Agent': 'GrowAGardenStock/1.0',
          'jstudio-key': process.env.JSTUDIO_API_KEY || 'js_e9b170c145eab6364f2f7e08cb534ab1459f1a010eb82bb4e273a930ba9b46a7'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      this.cache.set(cacheKey, { data, timestamp: Date.now() });
      return data;
    } catch (error) {
      console.error(`Error fetching from JStudio API (${endpoint}):`, error);
      throw error;
    }
  }

  async getStockData(): Promise<JStudioStockData> {
    return this.fetchWithCache<JStudioStockData>('/stock');
  }

  async getWeatherData(): Promise<JStudioWeatherData> {
    return this.fetchWithCache<JStudioWeatherData>('/weather');
  }

  async getAllItemInfo(): Promise<JStudioItemInfo[]> {
    return this.fetchWithCache<JStudioItemInfo[]>('/info/');
  }

  async getItemInfo(itemId: string): Promise<JStudioItemInfo> {
    return this.fetchWithCache<JStudioItemInfo>(`/info/${itemId}`);
  }

  // Transform JStudio data to match our existing structure
  transformStockData(jstudioData: JStudioStockData): TransformedStockData {
    const now = new Date().toISOString();
    
    return {
      seeds: {
        items: jstudioData.seed_stock.map(item => ({
          id: item.item_id,
          name: item.display_name,
          quantity: item.quantity
        })),
        lastUpdated: now,
        nextUpdate: this.calculateNextUpdate(5), // 5 minutes for seeds
        refreshIntervalMinutes: 5
      },
      gear: {
        items: jstudioData.gear_stock.map(item => ({
          id: item.item_id,
          name: item.display_name,
          quantity: item.quantity
        })),
        lastUpdated: now,
        nextUpdate: this.calculateNextUpdate(5), // 5 minutes for gear
        refreshIntervalMinutes: 5
      },
      eggs: {
        items: jstudioData.egg_stock.map(item => ({
          id: item.item_id,
          name: item.display_name,
          quantity: item.quantity
        })),
        lastUpdated: now,
        nextUpdate: this.calculateNextUpdate(30), // 30 minutes for eggs
        refreshIntervalMinutes: 30
      },
      cosmetics: {
        items: jstudioData.cosmetic_stock.map(item => ({
          id: item.item_id,
          name: item.display_name,
          quantity: item.quantity
        })),
        lastUpdated: now,
        nextUpdate: this.calculateNextUpdate(240), // 4 hours for cosmetics
        refreshIntervalMinutes: 240
      },
      events: {
        items: jstudioData.eventshop_stock.map(item => ({
          id: item.item_id,
          name: item.display_name,
          quantity: item.quantity
        })),
        lastUpdated: now,
        nextUpdate: this.calculateNextUpdate(5), // 5 minutes for events
        refreshIntervalMinutes: 5
      },
      lastUpdated: now
    };
  }

  // Transform weather data to find the currently active weather
  transformWeatherData(weatherData: JStudioWeatherData) {
    const activeWeather = weatherData.weather.find(w => w.active);
    
    if (activeWeather) {
      return {
        id: activeWeather.weather_id,
        name: activeWeather.weather_name,
        startTime: new Date(activeWeather.start_duration_unix * 1000).toISOString(),
        endTime: new Date(activeWeather.end_duration_unix * 1000).toISOString()
      };
    }
    
    return null;
  }

  private calculateNextUpdate(intervalMinutes: number): string {
    const now = new Date();
    const minutesSinceEpoch = Math.floor(now.getTime() / (1000 * 60));
    const intervalsSinceEpoch = Math.floor(minutesSinceEpoch / intervalMinutes);
    const nextScheduledMinute = (intervalsSinceEpoch + 1) * intervalMinutes;
    return new Date(nextScheduledMinute * 60 * 1000).toISOString();
  }

  // Merge JStudio data with existing Discord data (for backward compatibility)
  mergeWithDiscordData(jstudioData: TransformedStockData, discordData: TransformedStockData): TransformedStockData {
    const merged = { ...discordData };
    
    // Only update if JStudio data is newer or Discord data is missing
    if (jstudioData && (!discordData.lastUpdated || 
        new Date(jstudioData.lastUpdated) > new Date(discordData.lastUpdated))) {
      
      // Update each category if it exists in JStudio data
      if (jstudioData.seeds) merged.seeds = jstudioData.seeds;
      if (jstudioData.gear) merged.gear = jstudioData.gear;
      if (jstudioData.eggs) merged.eggs = jstudioData.eggs;
      if (jstudioData.cosmetics) merged.cosmetics = jstudioData.cosmetics;
      if (jstudioData.events) merged.events = jstudioData.events;
      if (jstudioData.weather) merged.weather = jstudioData.weather;
      
      merged.lastUpdated = jstudioData.lastUpdated;
    }
    
    return merged;
  }
}

export const jstudioAPI = new JStudioAPIService();
export type { JStudioStockData, JStudioWeatherData, JStudioItemInfo }; 
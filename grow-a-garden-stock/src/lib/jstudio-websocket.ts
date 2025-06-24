import * as fs from 'fs';
import * as path from 'path';
import WebSocket from 'ws';

interface WebSocketStockData {
  seed_stock: Array<{
    item_id: string;
    display_name: string;
    quantity: number;
    start_date_unix: number;
    end_date_unix: number;
    Date_Start: string;
    Date_End: string;
  }>;
  gear_stock: Array<{
    item_id: string;
    display_name: string;
    quantity: number;
    start_date_unix: number;
    end_date_unix: number;
    Date_Start: string;
    Date_End: string;
  }>;
  egg_stock: Array<{
    item_id: string;
    display_name: string;
    quantity: number;
    start_date_unix: number;
    end_date_unix: number;
    Date_Start: string;
    Date_End: string;
  }>;
  cosmetic_stock: Array<{
    item_id: string;
    display_name: string;
    quantity: number;
    start_date_unix: number;
    end_date_unix: number;
    Date_Start: string;
    Date_End: string;
  }>;
  eventshop_stock: Array<{
    item_id: string;
    display_name: string;
    quantity: number;
    start_date_unix: number;
    end_date_unix: number;
    Date_Start: string;
    Date_End: string;
  }>;
  weather: Array<{
    weather_id: string;
    end_duration_unix: number;
    active: boolean;
    duration: number;
    start_duration_unix: number;
    weather_name: string;
  }>;
  notification: unknown[];
}

interface TransformedStockData {
  seeds: {
    items: Array<{ id: string; name: string; quantity: number }>;
    lastUpdated: string;
    nextUpdate: string;
    refreshIntervalMinutes: number;
  };
  gear: {
    items: Array<{ id: string; name: string; quantity: number }>;
    lastUpdated: string;
    nextUpdate: string;
    refreshIntervalMinutes: number;
  };
  eggs: {
    items: Array<{ id: string; name: string; quantity: number }>;
    lastUpdated: string;
    nextUpdate: string;
    refreshIntervalMinutes: number;
  };
  cosmetics: {
    items: Array<{ id: string; name: string; quantity: number }>;
    lastUpdated: string;
    nextUpdate: string;
    refreshIntervalMinutes: number;
  };
  weather?: {
    id: string;
    name: string;
    startTime: string;
    endTime: string;
  };
  lastUpdated: string;
}

class JStudioWebSocketListener {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 5000; // 5 seconds
  private isConnected = false;
  private userId: string;

  constructor(userId: string = 'growagardenstock_bot') {
    this.userId = userId;
  }

  async start() {
    console.log('Starting JStudio WebSocket listener...');
    await this.connect();
  }

  private async connect() {
    try {
      const wsUrl = `wss://websocket.joshlei.com/growagarden?user_id=${encodeURIComponent(this.userId)}`;
      console.log(`Connecting to JStudio WebSocket: ${wsUrl}`);
      
      this.ws = new WebSocket(wsUrl);
      
      this.ws.on('open', () => {
        console.log('JStudio WebSocket connection established.');
        this.isConnected = true;
        this.reconnectAttempts = 0;
      });

      this.ws.on('message', async (data: WebSocket.Data) => {
        try {
          const rawMessage = data.toString();
          const message = JSON.parse(rawMessage) as WebSocketStockData;
          console.log('Received WebSocket stock update');
          console.log('Message keys:', Object.keys(message));
          
          await this.processStockUpdate(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
          console.error('Raw message:', data.toString().substring(0, 200) + '...');
        }
      });

      this.ws.on('error', (error: Error) => {
        console.error('JStudio WebSocket error:', error);
        this.isConnected = false;
      });

      this.ws.on('close', () => {
        console.log('JStudio WebSocket connection closed.');
        this.isConnected = false;
        this.scheduleReconnect();
      });

    } catch (error) {
      console.error('Error connecting to JStudio WebSocket:', error);
      this.scheduleReconnect();
    }
  }

  private async processStockUpdate(stockData: WebSocketStockData) {
    try {
      console.log('Processing WebSocket stock update...');
      
      // Check if we have valid stock data
      if (!stockData || typeof stockData !== 'object') {
        console.log('Invalid stock data received, skipping update');
        return;
      }
      
      // Load existing data to merge with incremental updates
      const stockFilePath = path.resolve(process.cwd(), 'stock-data.json');
      let existingData: TransformedStockData;
      
      try {
        if (fs.existsSync(stockFilePath)) {
          existingData = JSON.parse(fs.readFileSync(stockFilePath, 'utf-8')) as TransformedStockData;
        } else {
          // Initialize with empty data structure
          existingData = this.createEmptyStockData();
        }
             } catch {
         console.log('Error reading existing stock data, creating new structure');
         existingData = this.createEmptyStockData();
       }
      
      const now = new Date().toISOString();
      
      // Update only the categories that are present in this WebSocket message
      if (stockData.seed_stock && stockData.seed_stock.length >= 0) {
        existingData.seeds = {
          items: stockData.seed_stock.map(item => ({
            id: item.item_id,
            name: item.display_name,
            quantity: item.quantity
          })),
          lastUpdated: now,
          nextUpdate: this.calculateNextUpdate(5),
          refreshIntervalMinutes: 5
        };
      }
      
      if (stockData.gear_stock && stockData.gear_stock.length >= 0) {
        existingData.gear = {
          items: stockData.gear_stock.map(item => ({
            id: item.item_id,
            name: item.display_name,
            quantity: item.quantity
          })),
          lastUpdated: now,
          nextUpdate: this.calculateNextUpdate(5),
          refreshIntervalMinutes: 5
        };
      }
      
      if (stockData.egg_stock && stockData.egg_stock.length >= 0) {
        existingData.eggs = {
          items: stockData.egg_stock.map(item => ({
            id: item.item_id,
            name: item.display_name,
            quantity: item.quantity
          })),
          lastUpdated: now,
          nextUpdate: this.calculateNextUpdate(30),
          refreshIntervalMinutes: 30
        };
      }
      
      if (stockData.cosmetic_stock && stockData.cosmetic_stock.length >= 0) {
        existingData.cosmetics = {
          items: stockData.cosmetic_stock.map(item => ({
            id: item.item_id,
            name: item.display_name,
            quantity: item.quantity
          })),
          lastUpdated: now,
          nextUpdate: this.calculateNextUpdate(240),
          refreshIntervalMinutes: 240
        };
      }

      // Process weather data with safety checks
      if (stockData.weather && stockData.weather.length > 0) {
        const activeWeather = stockData.weather.find(w => w && w.active);
        if (activeWeather) {
          existingData.weather = {
            id: activeWeather.weather_id,
            name: activeWeather.weather_name,
            startTime: new Date(activeWeather.start_duration_unix * 1000).toISOString(),
            endTime: new Date(activeWeather.end_duration_unix * 1000).toISOString()
          };
        }
      }
      
      // Update the overall timestamp
      existingData.lastUpdated = now;
      
      // Save the updated data
      fs.writeFileSync(stockFilePath, JSON.stringify(existingData, null, 2));
      console.log('✅ Stock data updated from WebSocket');
      console.log(`   Seeds: ${(stockData.seed_stock || []).length} items`);
      console.log(`   Gear: ${(stockData.gear_stock || []).length} items`);
      console.log(`   Eggs: ${(stockData.egg_stock || []).length} items`);
      console.log(`   Cosmetics: ${(stockData.cosmetic_stock || []).length} items`);
      console.log(`   Weather: ${existingData.weather ? existingData.weather.name : 'None active'}`);
      
    } catch (error) {
      console.error('Error processing WebSocket stock update:', error);
    }
  }

  private calculateNextUpdate(intervalMinutes: number): string {
    const now = new Date();
    const minutesSinceEpoch = Math.floor(now.getTime() / (1000 * 60));
    const intervalsSinceEpoch = Math.floor(minutesSinceEpoch / intervalMinutes);
    const nextScheduledMinute = (intervalsSinceEpoch + 1) * intervalMinutes;
    return new Date(nextScheduledMinute * 60 * 1000).toISOString();
  }

  private createEmptyStockData(): TransformedStockData {
    const now = new Date().toISOString();
    return {
      seeds: {
        items: [],
        lastUpdated: now,
        nextUpdate: this.calculateNextUpdate(5),
        refreshIntervalMinutes: 5
      },
      gear: {
        items: [],
        lastUpdated: now,
        nextUpdate: this.calculateNextUpdate(5),
        refreshIntervalMinutes: 5
      },
      eggs: {
        items: [],
        lastUpdated: now,
        nextUpdate: this.calculateNextUpdate(30),
        refreshIntervalMinutes: 30
      },
      cosmetics: {
        items: [],
        lastUpdated: now,
        nextUpdate: this.calculateNextUpdate(240),
        refreshIntervalMinutes: 240
      },
      lastUpdated: now
    };
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff
      
      console.log(`Scheduling WebSocket reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
      
      setTimeout(() => {
        this.connect();
      }, delay);
    } else {
      console.error('Max WebSocket reconnect attempts reached. Stopping WebSocket listener.');
    }
  }

  stop() {
    console.log('Stopping JStudio WebSocket listener...');
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  isConnectedToWebSocket(): boolean {
    return this.isConnected;
  }
}

export const jstudioWebSocket = new JStudioWebSocketListener(); 
import * as fs from 'fs';
import * as path from 'path';
import WebSocket from 'ws';
import { sendItemNotification, sendWeatherAlertNotification } from './pushNotifications';

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
    current: string;
    endsAt: string;
  };
  lastUpdated: string;
}

// --- Buffer for all shop and weather updates ---
const updateBuffer: {
  seeds?: Array<{ id: string; name: string; quantity: number }>;
  gear?: Array<{ id: string; name: string; quantity: number }>;
  eggs?: Array<{ id: string; name: string; quantity: number }>;
  cosmetics?: Array<{ id: string; name: string; quantity: number }>;
  weather?: { current: string; endsAt: string };
  timeout?: NodeJS.Timeout;
} = {};
const BUFFER_TIMEOUT_MS = 2500; // 2.5 seconds

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
      // let notificationCount = 0; // Remove unused
      // const now = new Date().toISOString(); // Remove unused
      // Buffer seeds
      if (stockData.seed_stock && stockData.seed_stock.length >= 0) {
        updateBuffer.seeds = stockData.seed_stock.map(item => ({
          id: item.item_id,
          name: item.display_name,
          quantity: item.quantity
        }));
      }
      // Buffer gear
      if (stockData.gear_stock && stockData.gear_stock.length >= 0) {
        updateBuffer.gear = stockData.gear_stock.map(item => ({
          id: item.item_id,
          name: item.display_name,
          quantity: item.quantity
        }));
      }
      // Buffer eggs
      if (stockData.egg_stock && stockData.egg_stock.length >= 0) {
        updateBuffer.eggs = stockData.egg_stock.map(item => ({
          id: item.item_id,
          name: item.display_name,
          quantity: item.quantity
        }));
      }
      // Buffer cosmetics
      if (stockData.cosmetic_stock && stockData.cosmetic_stock.length >= 0) {
        updateBuffer.cosmetics = stockData.cosmetic_stock.map(item => ({
          id: item.item_id,
          name: item.display_name,
          quantity: item.quantity
        }));
      }
      // Buffer weather
      if (stockData.weather && stockData.weather.length > 0) {
        const activeWeather = stockData.weather.find(w => w && w.active);
        if (activeWeather) {
          const displayName = activeWeather.weather_name.replace(/([A-Z])/g, ' $1').trim();
          updateBuffer.weather = {
            current: displayName,
            endsAt: new Date(activeWeather.end_duration_unix * 1000).toISOString()
          };
        }
      }
      // Start or reset the buffer timeout
      if (updateBuffer.timeout) clearTimeout(updateBuffer.timeout);
      updateBuffer.timeout = setTimeout(() => {
        const nowTimeout = new Date().toISOString();
        const stockFilePath = path.resolve(process.cwd(), 'stock-data.json');
        let existingData: TransformedStockData;
        try {
          if (fs.existsSync(stockFilePath)) {
            existingData = JSON.parse(fs.readFileSync(stockFilePath, 'utf-8')) as TransformedStockData;
          } else {
            existingData = this.createEmptyStockData();
          }
        } catch {
          existingData = this.createEmptyStockData();
        }
        let notificationCountTimeout = 0;
        if (updateBuffer.seeds) {
          existingData.seeds = {
            items: updateBuffer.seeds,
            lastUpdated: nowTimeout,
            nextUpdate: this.calculateNextUpdate(5),
            refreshIntervalMinutes: 5
          };
          for (const item of updateBuffer.seeds) {
            void sendItemNotification(item.name, item.quantity, 'Seeds');
            notificationCountTimeout++;
          }
        }
        if (updateBuffer.gear) {
          existingData.gear = {
            items: updateBuffer.gear,
            lastUpdated: nowTimeout,
            nextUpdate: this.calculateNextUpdate(5),
            refreshIntervalMinutes: 5
          };
          for (const item of updateBuffer.gear) {
            void sendItemNotification(item.name, item.quantity, 'Gear');
            notificationCountTimeout++;
          }
        }
        if (updateBuffer.eggs) {
          existingData.eggs = {
            items: updateBuffer.eggs,
            lastUpdated: nowTimeout,
            nextUpdate: this.calculateNextUpdate(30),
            refreshIntervalMinutes: 30
          };
          for (const item of updateBuffer.eggs) {
            void sendItemNotification(item.name, item.quantity, 'Eggs');
            notificationCountTimeout++;
          }
        }
        if (updateBuffer.cosmetics) {
          existingData.cosmetics = {
            items: updateBuffer.cosmetics,
            lastUpdated: nowTimeout,
            nextUpdate: this.calculateNextUpdate(240),
            refreshIntervalMinutes: 240
          };
          // Do NOT send notifications for cosmetics
          // for (const item of updateBuffer.cosmetics) {
          //   void sendItemNotification(item.name, item.quantity, 'Cosmetics');
          //   notificationCountTimeout++;
          // }
        }
        if (updateBuffer.weather) {
          existingData.weather = updateBuffer.weather;
          void sendWeatherAlertNotification(updateBuffer.weather.current, `Ends: ${updateBuffer.weather.endsAt}`);
          notificationCountTimeout++;
        }
        existingData.lastUpdated = nowTimeout;
        fs.writeFileSync(stockFilePath, JSON.stringify(existingData, null, 2));
        // Clear buffer
        updateBuffer.seeds = undefined;
        updateBuffer.gear = undefined;
        updateBuffer.eggs = undefined;
        updateBuffer.cosmetics = undefined;
        updateBuffer.weather = undefined;
        updateBuffer.timeout = undefined;
        console.log('✅ Stock data updated from WebSocket (buffer flush for all categories)');
        console.log(`🔔 Processed ${notificationCountTimeout} push notifications for this buffer update.`);
      }, BUFFER_TIMEOUT_MS);
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
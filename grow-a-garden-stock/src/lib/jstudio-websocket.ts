import WebSocket from 'ws';
import { stockManager, StockItem, WeatherInfo, TravellingMerchantItem } from './stock-manager';

interface WebSocketStockData {
  seed_stock: Array<{
    item_id: string;
    display_name: string;
    quantity: number;
    start_date_unix: number;
    end_date_unix: number;
    Date_Start: string;
    Date_End: string;
    icon?: string;
  }>;
  gear_stock: Array<{
    item_id: string;
    display_name: string;
    quantity: number;
    start_date_unix: number;
    end_date_unix: number;
    Date_Start: string;
    Date_End: string;
    icon?: string;
  }>;
  egg_stock: Array<{
    item_id: string;
    display_name: string;
    quantity: number;
    start_date_unix: number;
    end_date_unix: number;
    Date_Start: string;
    Date_End: string;
    icon?: string;
  }>;
  cosmetic_stock: Array<{
    item_id: string;
    display_name: string;
    quantity: number;
    start_date_unix: number;
    end_date_unix: number;
    Date_Start: string;
    Date_End: string;
    icon?: string;
  }>;
  eventshop_stock: Array<{
    item_id: string;
    display_name: string;
    quantity: number;
    start_date_unix: number;
    end_date_unix: number;
    Date_Start: string;
    Date_End: string;
    icon?: string;
  }>;
  travelingmerchant_stock: Array<{
    item_id: string;
    display_name: string;
    quantity: number;
    start_date_unix: number;
    end_date_unix: number;
    Date_Start: string;
    Date_End: string;
    icon?: string;
  }>;
  weather: Array<{
    weather_id: string;
    end_duration_unix: number;
    active: boolean;
    duration: number;
    start_duration_unix: number;
    weather_name: string;
  }>;
  notification: Array<{
    message: string;
    timestamp: number;
    end_date_unix: number;
  }>;
  discord_invite?: string;
}

class JStudioWebSocketListener {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 5000; // 5 seconds
  private isConnected = false;
  private userId: string;

  constructor(userId: string = process.env.JSTUDIO_USER_ID || '.gamer01') {
    this.userId = userId;
  }

  async start() {
    console.log('📡 Starting JStudio WebSocket listener...');
    await this.connect();
  }

  private async connect() {
    try {
      const wsUrl = `wss://websocket.joshlei.com/growagarden?user_id=${encodeURIComponent(this.userId)}`;
      console.log(`🔗 Connecting to JStudio WebSocket: ${wsUrl}`);
      
      this.ws = new WebSocket(wsUrl);
      
      this.ws.on('open', () => {
        console.log('✅ JStudio WebSocket connection established.');
        this.isConnected = true;
        this.reconnectAttempts = 0;
      });

      this.ws.on('message', async (data: WebSocket.Data) => {
        try {
          const rawMessage = data.toString();
          const message = JSON.parse(rawMessage) as WebSocketStockData;
          console.log('📥 Received WebSocket stock update');
          console.log('📋 Message keys:', Object.keys(message));
          
          await this.processStockUpdate(message);
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
          console.error('📄 Raw message:', data.toString().substring(0, 200) + '...');
        }
      });

      this.ws.on('error', (error: Error) => {
        console.error('❌ JStudio WebSocket error:', error);
        this.isConnected = false;
      });

      this.ws.on('close', () => {
        console.log('🔌 JStudio WebSocket connection closed.');
        this.isConnected = false;
        this.scheduleReconnect();
      });

    } catch (error) {
      console.error('❌ Error connecting to JStudio WebSocket:', error);
      this.scheduleReconnect();
    }
  }

  private async processStockUpdate(stockData: WebSocketStockData) {
    try {
      console.log('🔄 Processing WebSocket stock update...');
      
      // Process seeds
      if (stockData.seed_stock && stockData.seed_stock.length >= 0) {
        const seeds: StockItem[] = stockData.seed_stock.map(item => ({
          id: item.item_id,
          name: item.display_name,
          quantity: item.quantity
        }));
        stockManager.updateStockData('websocket', 'seeds', seeds);
      }
      
      // Process gear
      if (stockData.gear_stock && stockData.gear_stock.length >= 0) {
        const gear: StockItem[] = stockData.gear_stock.map(item => ({
          id: item.item_id,
          name: item.display_name,
          quantity: item.quantity
        }));
        stockManager.updateStockData('websocket', 'gear', gear);
      }
      
      // Process eggs
      if (stockData.egg_stock && stockData.egg_stock.length >= 0) {
        const eggs: StockItem[] = stockData.egg_stock.map(item => ({
          id: item.item_id,
          name: item.display_name,
          quantity: item.quantity
        }));
        stockManager.updateStockData('websocket', 'eggs', eggs);
      }
      
      // Process cosmetics
      if (stockData.cosmetic_stock && stockData.cosmetic_stock.length >= 0) {
        const cosmetics: StockItem[] = stockData.cosmetic_stock.map(item => ({
          id: item.item_id,
          name: item.display_name,
          quantity: item.quantity
        }));
        stockManager.updateStockData('websocket', 'cosmetics', cosmetics);
      }
      
      // Process events
      if (stockData.eventshop_stock && stockData.eventshop_stock.length >= 0) {
        const events: StockItem[] = stockData.eventshop_stock.map(item => ({
          id: item.item_id,
          name: item.display_name,
          quantity: item.quantity
        }));
        stockManager.updateStockData('websocket', 'events', events);
      }
      
      // Process travelling merchant (separate from eventshop)
      if (stockData.travelingmerchant_stock && stockData.travelingmerchant_stock.length >= 0) {
        const travellingMerchant: TravellingMerchantItem[] = stockData.travelingmerchant_stock.map(item => ({
          id: item.item_id,
          name: item.display_name,
          quantity: item.quantity
        }));
        console.log('🛒 Travelling Merchant items:', travellingMerchant);
        // Update travelling merchant data through stock manager
        stockManager.updateStockData('websocket', 'seeds', [], undefined, travellingMerchant);
      }
      
      // Process weather
      if (stockData.weather && stockData.weather.length > 0) {
        const activeWeather = stockData.weather.find(w => w && w.active);
        if (activeWeather) {
          const displayName = activeWeather.weather_name.replace(/([A-Z])/g, ' $1').trim();
          const weather: WeatherInfo = {
            current: displayName,
            endsAt: new Date(activeWeather.end_duration_unix * 1000).toISOString()
          };
          console.log('🌤️ Weather update:', weather);
          stockManager.updateStockData('websocket', 'seeds', [], weather);
        }
      }
      
      console.log('✅ WebSocket stock update processed successfully');
      
    } catch (error) {
      console.error('❌ Error processing WebSocket stock update:', error);
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff
      
      console.log(`🔄 Scheduling WebSocket reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
      
      setTimeout(() => {
        this.connect();
      }, delay);
    } else {
      console.error('❌ Max WebSocket reconnect attempts reached. Stopping WebSocket listener.');
    }
  }

  stop() {
    console.log('🛑 Stopping JStudio WebSocket listener...');
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
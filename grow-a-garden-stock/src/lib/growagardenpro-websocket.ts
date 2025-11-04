import { WebSocket } from 'ws';
import { stockManager, StockItem, WeatherInfo, TravellingMerchantItem } from './stock-manager.js';

interface GrowAGardenProMessage {
  type?: string;
  data?: {
    weather?: {
      type?: string;
      active?: boolean;
      effects?: string[];
      lastUpdated?: string;
      [key: string]: unknown;
    };
    weatherHistory?: Array<{
      type?: string;
      active?: boolean;
      startTime?: string;
      endTime?: string;
      [key: string]: unknown;
    }>;
    travelingMerchant?: {
      merchantName?: string;
      items?: Array<{
        name: string;
        quantity: number;
        available?: boolean;
        [key: string]: unknown;
      }>;
      arrivedAt?: string;
      leavesAt?: string;
      [key: string]: unknown;
    };
    gear?: Array<{
      name: string;
      quantity: number;
      [key: string]: unknown;
    }>;
    seeds?: Array<{
      name: string;
      quantity: number;
      [key: string]: unknown;
    }>;
    eggs?: Array<{
      name: string;
      quantity: number;
      [key: string]: unknown;
    }>;
    honey?: Array<{
      name: string;
      quantity: number;
      [key: string]: unknown;
    }>;
    events?: Array<{
      name: string;
      quantity: number;
      [key: string]: unknown;
    }>;
    cosmetics?: Array<{
      name: string;
      quantity: number;
      [key: string]: unknown;
    }>;
    timestamp?: number;
  };
}

class GrowAGardenProWebSocketListener {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 5000; // 5 seconds
  private isConnected = false;
  private reconnectTimer: NodeJS.Timeout | null = null;

  async start() {
    console.log('📡 Starting GrowAGardenPro WebSocket listener...');
    await this.connect();
    
    // Set up ping interval to keep connection alive
    setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, 25000); // Ping every 25 seconds
  }

  private async connect() {
    try {
      const wsUrl = 'wss://ws.growagardenpro.com/';
      console.log(`🔗 Connecting to GrowAGardenPro WebSocket: ${wsUrl}`);
      
      this.ws = new WebSocket(wsUrl);
      
      this.ws.on('open', () => {
        console.log('✅ GrowAGardenPro WebSocket connection established.');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        stockManager.updateSourceActivity('gagpro');
      });

      this.ws.on('message', async (data: Buffer) => {
        try {
          const rawMessage = data.toString();
          const message = JSON.parse(rawMessage) as GrowAGardenProMessage;
          
          // Update source activity on any message
          stockManager.updateSourceActivity('gagpro');
          
          // Check if message has the expected structure
          if (message.type && message.data) {
            console.log('📥 Received GrowAGardenPro WebSocket stock update');
            console.log('📋 Message type:', message.type);
            await this.processStockUpdate(message.data);
          } else {
            // Try to process as direct data (in case structure is different)
            if (message.data) {
              console.log('📥 Received GrowAGardenPro WebSocket data (no type field)');
              await this.processStockUpdate(message.data);
            } else {
              // Try to process the message itself as data (fallback)
              console.log('📥 Received GrowAGardenPro WebSocket message (trying as data)');
              await this.processStockUpdate(message as unknown as GrowAGardenProMessage['data']);
            }
          }
        } catch (error) {
          console.error('❌ Error parsing GrowAGardenPro WebSocket message:', error);
          console.error('📄 Raw message preview:', data.toString().substring(0, 200) + '...');
        }
      });

      this.ws.on('error', (error: Error) => {
        console.error('❌ GrowAGardenPro WebSocket error:', error);
        this.isConnected = false;
      });

      this.ws.on('ping', (data) => {
        console.log('🏓 Received ping from GrowAGardenPro server, sending pong...');
        this.ws?.pong(data);
      });

      this.ws.on('pong', () => {
        console.log('🏓 Received pong from GrowAGardenPro server');
      });

      this.ws.on('close', () => {
        console.log('🔌 GrowAGardenPro WebSocket connection closed.');
        this.isConnected = false;
        this.scheduleReconnect();
      });

    } catch (error) {
      console.error('❌ Error connecting to GrowAGardenPro WebSocket:', error);
      this.scheduleReconnect();
    }
  }

  private async processStockUpdate(data: GrowAGardenProMessage['data']) {
    if (!data) {
      console.log('⚠️ Empty data received from GrowAGardenPro WebSocket');
      return;
    }

    try {
      console.log('🔄 Processing GrowAGardenPro WebSocket stock update...');
      
      // Process weather
      if (data.weather && data.weather.active && data.weather.type) {
        const weather = data.weather;
        const weatherType = weather.type as string; // Type assertion: we know it exists from the if condition
        
        console.log(`🌤️ Processing GrowAGardenPro weather: ${weatherType}`);
        
        // Try to find end time from weatherHistory
        let endsAt: string;
        if (data.weatherHistory && Array.isArray(data.weatherHistory)) {
          // Find the current weather in history to get its end time
          const currentWeatherHistory = data.weatherHistory.find(
            (h: { type?: string; active?: boolean; endTime?: string }) => 
              h.type === weatherType && h.active === true && h.endTime
          );
          
          if (currentWeatherHistory && currentWeatherHistory.endTime) {
            endsAt = currentWeatherHistory.endTime;
          } else {
            // Estimate: weather typically lasts 15-20 minutes, use lastUpdated + 15 minutes
            const lastUpdated = weather.lastUpdated ? new Date(weather.lastUpdated) : new Date();
            endsAt = new Date(lastUpdated.getTime() + 15 * 60 * 1000).toISOString();
          }
        } else {
          // Estimate: weather typically lasts 15-20 minutes
          const lastUpdated = weather.lastUpdated ? new Date(weather.lastUpdated) : new Date();
          endsAt = new Date(lastUpdated.getTime() + 15 * 60 * 1000).toISOString();
        }
        
        const weatherInfo: WeatherInfo = {
          current: weatherType, // Use 'type' field as the weather name
          endsAt: endsAt
        };
        
        // Send weather update (weather-only, preserve existing items)
        await stockManager.updateStockData('gagpro', 'seeds', [], weatherInfo);
        console.log(`🌤️ Weather update sent: ${weatherType} ends at ${endsAt}`);
      }
      
      // Process seeds
      if (data.seeds && Array.isArray(data.seeds)) {
        const seeds: StockItem[] = data.seeds.map((item, index) => ({
          id: item.name || `seed-${index}`, // Use name as ID if no ID provided
          name: item.name,
          quantity: item.quantity || 0
        }));
        console.log(`🌱 Processing ${seeds.length} seeds from GrowAGardenPro`);
        stockManager.updateStockData('gagpro', 'seeds', seeds);
      }
      
      // Process gear
      if (data.gear && Array.isArray(data.gear)) {
        const gear: StockItem[] = data.gear.map((item, index) => ({
          id: item.name || `gear-${index}`,
          name: item.name,
          quantity: item.quantity || 0
        }));
        console.log(`🛠️ Processing ${gear.length} gear items from GrowAGardenPro`);
        stockManager.updateStockData('gagpro', 'gear', gear);
      }
      
      // Process eggs
      if (data.eggs && Array.isArray(data.eggs)) {
        // Combine eggs by name (sum quantities) as shown in Python code
        const eggMap = new Map<string, number>();
        data.eggs.forEach((item) => {
          const name = item.name;
          const quantity = item.quantity || 0;
          eggMap.set(name, (eggMap.get(name) || 0) + quantity);
        });
        
        const eggs: StockItem[] = Array.from(eggMap.entries()).map(([name, quantity], index) => ({
          id: name || `egg-${index}`,
          name: name,
          quantity: quantity
        }));
        console.log(`🥚 Processing ${eggs.length} egg types from GrowAGardenPro (combined by name)`);
        stockManager.updateStockData('gagpro', 'eggs', eggs);
      }
      
      // Process cosmetics
      if (data.cosmetics && Array.isArray(data.cosmetics)) {
        const cosmetics: StockItem[] = data.cosmetics.map((item, index) => ({
          id: item.name || `cosmetic-${index}`,
          name: item.name,
          quantity: item.quantity || 0
        }));
        console.log(`✨ Processing ${cosmetics.length} cosmetics from GrowAGardenPro`);
        stockManager.updateStockData('gagpro', 'cosmetics', cosmetics);
      }
      
      // Process events (separate from honey/traveling merchant)
      if (data.events && Array.isArray(data.events)) {
        const events: StockItem[] = data.events.map((item, index) => ({
          id: item.name || `event-${index}`,
          name: item.name,
          quantity: item.quantity || 0
        }));
        console.log(`🎉 Processing ${events.length} event items from GrowAGardenPro`);
        stockManager.updateStockData('gagpro', 'events', events);
      }
      
      // Process traveling merchant (honey items are merchant items)
      if (data.travelingMerchant && data.travelingMerchant.items && Array.isArray(data.travelingMerchant.items)) {
        const merchantItems = data.travelingMerchant.items.filter((item) => {
          const available = (item as { available?: boolean }).available;
          return available !== false;
        });
        const travellingMerchant: TravellingMerchantItem[] = merchantItems.map((item, index) => ({
          id: item.name || `merchant-${index}`,
          name: item.name,
          quantity: item.quantity || 0
        }));
        
        const merchantName = data.travelingMerchant.merchantName || 'Traveling Merchant';
        console.log(`🛒 Processing ${travellingMerchant.length} traveling merchant items from GrowAGardenPro: ${merchantName}`);
        stockManager.updateStockData('gagpro', 'seeds', [], undefined, travellingMerchant, merchantName);
      } else if (data.honey && Array.isArray(data.honey)) {
        // Fallback: if travelingMerchant structure not available, use honey as merchant items
        const merchantItems = data.honey.filter((item) => {
          const available = (item as { available?: boolean }).available;
          return available !== false;
        });
        const travellingMerchant: TravellingMerchantItem[] = merchantItems.map((item, index) => ({
          id: item.name || `merchant-${index}`,
          name: item.name,
          quantity: item.quantity || 0
        }));
        console.log(`🛒 Processing ${travellingMerchant.length} traveling merchant items from GrowAGardenPro (from honey field)`);
        stockManager.updateStockData('gagpro', 'seeds', [], undefined, travellingMerchant, 'Traveling Merchant');
      }
      
      console.log('✅ GrowAGardenPro WebSocket stock update processed successfully');
      
    } catch (error) {
      console.error('❌ Error processing GrowAGardenPro WebSocket stock update:', error);
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff
      
      console.log(`🔄 Scheduling GrowAGardenPro WebSocket reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
      
      this.reconnectTimer = setTimeout(() => {
        this.connect();
      }, delay);
    } else {
      console.error('❌ Max GrowAGardenPro WebSocket reconnect attempts reached. Stopping WebSocket listener.');
    }
  }

  stop() {
    console.log('🛑 Stopping GrowAGardenPro WebSocket listener...');
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
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

export const growAGardenProWebSocket = new GrowAGardenProWebSocketListener();


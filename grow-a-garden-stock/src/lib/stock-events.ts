// Simple event emitter for SSE broadcasting
export interface StockUpdateEvent {
  type: 'stock_update';
  source: 'websocket' | 'cactus' | 'vulcan';
  category: string;
  stockId: string;
  timestamp: string;
}

class StockEventEmitter {
  private listeners: Array<(data: StockUpdateEvent) => void> = [];

  onUpdate(callback: (data: StockUpdateEvent) => void) {
    this.listeners.push(callback);
  }

  removeListener(callback: (data: StockUpdateEvent) => void) {
    this.listeners = this.listeners.filter(l => l !== callback);
  }

  emit(data: StockUpdateEvent) {
    this.listeners.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('Error in stock update listener:', error);
      }
    });
  }
}

export const stockEventEmitter = new StockEventEmitter(); 
// Shared SSE functionality for both stock-updates and trigger-sse routes

// Store connected clients
export const clients = new Set<{
  id: string;
  response: Response;
  controller: ReadableStreamDefaultController;
}>();

// Send message to all connected clients
export function broadcastStockUpdate(data: Record<string, unknown>) {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  
  clients.forEach(client => {
    try {
      client.controller.enqueue(new TextEncoder().encode(message));
    } catch (error) {
      console.error('Error sending message to client:', error);
      // Remove disconnected client
      clients.delete(client);
    }
  });
}

// Generate unique client ID
export function generateClientId(): string {
  return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
} 
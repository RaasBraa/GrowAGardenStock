import { NextRequest, NextResponse } from 'next/server';
import { stockManager } from '../../../lib/stock-manager';

// Store connected clients
const clients = new Set<{
  id: string;
  response: Response;
  controller: ReadableStreamDefaultController;
}>();

// Generate unique client ID
function generateClientId(): string {
  return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

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

export async function GET(request: NextRequest) {
  const clientId = generateClientId();
  
  console.log(`📡 New SSE client connected: ${clientId}`);
  
  // Create SSE response
  const stream = new ReadableStream({
    start(controller) {
      // Add client to the set
      const client = { id: clientId, response: new Response(), controller };
      clients.add(client);
      
      // Send initial connection message
      const initialMessage = `data: ${JSON.stringify({
        type: 'connected',
        clientId,
        timestamp: new Date().toISOString(),
        message: 'Connected to stock updates stream'
      })}\n\n`;
      
      controller.enqueue(new TextEncoder().encode(initialMessage));
      
      // Send current stock data immediately
      const currentStock = stockManager.getStockData();
      const stockMessage = `data: ${JSON.stringify({
        type: 'stock_update',
        data: currentStock,
        timestamp: new Date().toISOString()
      })}\n\n`;
      
      controller.enqueue(new TextEncoder().encode(stockMessage));
      
      // Handle client disconnect
      request.signal.addEventListener('abort', () => {
        console.log(`📡 SSE client disconnected: ${clientId}`);
        clients.delete(client);
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    }
  });
}

// Optional: Add a POST endpoint to manually trigger updates (for testing)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, data } = body;
    
    const updateMessage = {
      type: type || 'manual_update',
      data,
      timestamp: new Date().toISOString()
    };
    
    broadcastStockUpdate(updateMessage);
    
    return NextResponse.json({
      success: true,
      message: 'Update broadcasted',
      clientsConnected: clients.size
    });
  } catch {
    return NextResponse.json({
      success: false,
      error: 'Invalid request body'
    }, { status: 400 });
  }
} 
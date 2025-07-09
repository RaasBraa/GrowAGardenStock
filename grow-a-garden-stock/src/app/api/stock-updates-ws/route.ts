import { NextRequest, NextResponse } from 'next/server';
import { WebSocketServer } from 'ws';
import { randomUUID } from 'crypto';

const SSE_SECRET_TOKEN = process.env.SSE_SECRET_TOKEN;

// Store active WebSocket connections
const clients = new Map<string, {
  ws: import('ws').WebSocket;
  token: string;
  connectedAt: Date;
  lastHeartbeat: Date;
  clientId: string;
}>();

// WebSocket server instance
let wss: WebSocketServer | null = null;

// Initialize WebSocket server
function initializeWebSocketServer() {
  if (wss) return wss;

  // Create WebSocket server on port 8080
  wss = new WebSocketServer({ port: 8080 });

  wss.on('connection', (ws, req) => {
    try {
      // Extract token from URL
      const url = new URL(req.url || '', 'http://localhost');
      const token = url.searchParams.get('token');
      
      // Validate token
      if (!SSE_SECRET_TOKEN || token !== SSE_SECRET_TOKEN) {
        ws.send(JSON.stringify({
          type: 'error',
          code: 'INVALID_TOKEN',
          message: 'Invalid authentication token',
          timestamp: new Date().toISOString()
        }));
        ws.close();
        return;
      }
      
      // Generate client ID
      const clientId = randomUUID();
      
      // Store client connection
      clients.set(clientId, {
        ws,
        token: token!,
        connectedAt: new Date(),
        lastHeartbeat: new Date(),
        clientId
      });
      
      console.log(`🔌 WebSocket client connected: ${clientId}`);
      
      // Send connection confirmation
      ws.send(JSON.stringify({
        type: 'connected',
        clientId,
        timestamp: new Date().toISOString()
      }));
      
      // Handle messages
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          
          if (data.type === 'heartbeat') {
            // Update last heartbeat
            const client = clients.get(clientId);
            if (client) {
              client.lastHeartbeat = new Date();
            }
            
            // Send heartbeat response
            ws.send(JSON.stringify({
              type: 'heartbeat',
              timestamp: new Date().toISOString()
            }));
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      });
      
      // Handle disconnect
      ws.on('close', () => {
        clients.delete(clientId);
        console.log(`🔌 WebSocket client disconnected: ${clientId}`);
      });
      
      // Handle errors
      ws.on('error', (error) => {
        console.error(`WebSocket error for client ${clientId}:`, error);
        clients.delete(clientId);
      });
      
    } catch (error) {
      console.error('Error handling WebSocket connection:', error);
      ws.close();
    }
  });

  // Heartbeat cleanup (run every 30 seconds)
  setInterval(() => {
    const now = new Date();
    clients.forEach((client, clientId) => {
      const timeSinceHeartbeat = now.getTime() - client.lastHeartbeat.getTime();
      if (timeSinceHeartbeat > 60000) { // 60 seconds
        console.log(`🔌 Client ${clientId} heartbeat timeout, closing connection`);
        client.ws.close();
        clients.delete(clientId);
      }
    });
  }, 30000);

  console.log('🔌 WebSocket server started on port 8080');
  return wss;
}

// Function to broadcast stock updates to all connected clients
export function broadcastStockUpdate(data: {
  type: string;
  source: string;
  category: string;
  stockId: string;
  timestamp: string;
  data?: Record<string, unknown>;
}) {
  if (!wss) {
    console.warn('WebSocket server not initialized');
    return;
  }

  const message = JSON.stringify(data);
  
  clients.forEach((client, clientId) => {
    if (client.ws.readyState === 1) { // WebSocket.OPEN
      try {
        client.ws.send(message);
        console.log(`✅ WebSocket message sent to client ${clientId} for ${data.category}`);
      } catch (error) {
        console.error(`Error sending message to client ${clientId}:`, error);
        // Remove disconnected client
        clients.delete(clientId);
      }
    }
  });
}

// GET endpoint to handle WebSocket upgrade
export async function GET() {
  // Check if environment variable is set
  if (!SSE_SECRET_TOKEN) {
    console.error('❌ SSE_SECRET_TOKEN environment variable is not set');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  // Initialize WebSocket server
  initializeWebSocketServer();

  // Return connection info
  return NextResponse.json({
    message: 'WebSocket server is running',
    endpoint: 'ws://localhost:8080/api/stock-updates-ws',
    connectedClients: clients.size,
    instructions: 'Connect to ws://localhost:8080/api/stock-updates-ws?token=YOUR_TOKEN'
  });
}

// POST endpoint to trigger WebSocket broadcasts (for backward compatibility)
export async function POST(request: NextRequest) {
  try {
    // Check if environment variable is set
    if (!SSE_SECRET_TOKEN) {
      console.error('❌ SSE_SECRET_TOKEN environment variable is not set');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const body = await request.json();
    const { token, type, source, category, stockId, timestamp, data } = body;

    // Validate secret token
    if (token !== SSE_SECRET_TOKEN) {
      console.log('❌ Unauthorized WebSocket trigger attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate required fields
    if (!type || !source || !category || !stockId || !timestamp) {
      console.log('❌ Invalid WebSocket trigger data:', body);
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Create the WebSocket event data
    const eventData = {
      type,
      source,
      category,
      stockId,
      timestamp,
      data
    };

    console.log(`🔌 Triggering WebSocket broadcast for ${category} from ${source}`);

    // Broadcast to all connected WebSocket clients
    broadcastStockUpdate(eventData);

    console.log(`✅ WebSocket broadcast triggered successfully for ${category}`);

    return NextResponse.json({
      success: true,
      message: 'WebSocket broadcast triggered',
      data: eventData,
      connectedClients: clients.size
    });

  } catch (error) {
    console.error('❌ Error in WebSocket trigger route:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Export client management functions
export function getConnectedClients() {
  return Array.from(clients.keys());
}

export function getClientCount() {
  return clients.size;
}

export function disconnectClient(clientId: string) {
  const client = clients.get(clientId);
  if (client) {
    client.ws.close();
    clients.delete(clientId);
    return true;
  }
  return false;
} 
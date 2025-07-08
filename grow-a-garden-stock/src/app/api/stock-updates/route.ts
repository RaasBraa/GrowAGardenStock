import { NextRequest, NextResponse } from 'next/server';
import { stockEventEmitter, StockUpdateEvent } from '../../../lib/stock-events';
import { clients, broadcastStockUpdate, generateClientId } from '../../../lib/sse-shared';

const SSE_SECRET_TOKEN = process.env.SSE_SECRET_TOKEN;

export async function GET(request: NextRequest) {
  // Check if environment variable is set
  if (!SSE_SECRET_TOKEN) {
    console.error('❌ SSE_SECRET_TOKEN environment variable is not set');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  // Get token from query parameter or header
  const token = request.nextUrl.searchParams.get('token') || request.headers.get('x-sse-token');
  
  // Validate token
  if (token !== SSE_SECRET_TOKEN) {
    console.log('❌ Unauthorized SSE connection attempt');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
      
      // Listen for real-time updates
      const updateListener = (updateData: StockUpdateEvent) => {
        console.log(`📡 SSE route received update for ${updateData.category} from ${updateData.source}`);
        const message = `data: ${JSON.stringify(updateData)}\n\n`;
        try {
          controller.enqueue(new TextEncoder().encode(message));
          console.log(`✅ SSE message sent to client ${clientId} for ${updateData.category}`);
        } catch (error) {
          console.error('Error sending SSE update:', error);
          // Remove this listener if there's an error
          stockEventEmitter.removeListener(updateListener);
        }
      };
      
      stockEventEmitter.onUpdate(updateListener);
      
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
      'Access-Control-Allow-Headers': 'Cache-Control, X-SSE-Token'
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
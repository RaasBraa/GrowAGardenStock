import { NextRequest, NextResponse } from 'next/server';
import { broadcastStockUpdate, getClientCount } from '../../../lib/websocket-server';

const SSE_SECRET_TOKEN = process.env.SSE_SECRET_TOKEN;

// GET endpoint to provide WebSocket connection info
export async function GET() {
  // Check if environment variable is set
  if (!SSE_SECRET_TOKEN) {
    console.error('❌ SSE_SECRET_TOKEN environment variable is not set');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  // Return connection info (WebSocket server should be running independently)
  return NextResponse.json({
    message: 'WebSocket server connection info',
    endpoint: 'ws://103.45.246.244:8080',
    connectedClients: getClientCount(),
    instructions: 'Connect to ws://103.45.246.244:8080?token=YOUR_TOKEN',
    note: 'Make sure the WebSocket server is running with: npm run start-websocket'
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
      connectedClients: getClientCount()
    });

  } catch (error) {
    console.error('❌ Error in WebSocket trigger route:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 
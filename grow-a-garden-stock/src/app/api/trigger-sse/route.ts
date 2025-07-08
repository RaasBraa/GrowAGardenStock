import { NextRequest, NextResponse } from 'next/server';
import { broadcastStockUpdate } from '../../../lib/sse-shared';

const SSE_SECRET_TOKEN = process.env.SSE_SECRET_TOKEN;

export async function POST(request: NextRequest) {
  try {
    // Check if environment variable is set
    if (!SSE_SECRET_TOKEN) {
      console.error('❌ SSE_SECRET_TOKEN environment variable is not set');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const body = await request.json();
    const { token, type, source, category, stockId, timestamp } = body;

    // Validate secret token
    if (token !== SSE_SECRET_TOKEN) {
      console.log('❌ Unauthorized SSE trigger attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate required fields
    if (!type || !source || !category || !stockId || !timestamp) {
      console.log('❌ Invalid SSE trigger data:', body);
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Create the SSE event data
    const eventData = {
      type,
      source,
      category,
      stockId,
      timestamp
    };

    console.log(`📡 Triggering SSE broadcast for ${category} from ${source}`);

    // Broadcast to all connected SSE clients
    broadcastStockUpdate(eventData);

    console.log(`✅ SSE broadcast triggered successfully for ${category}`);

    return NextResponse.json({
      success: true,
      message: 'SSE broadcast triggered',
      data: eventData
    });

  } catch (error) {
    console.error('❌ Error in SSE trigger route:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 
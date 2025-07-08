import { NextResponse } from 'next/server';
import { jstudioAPI } from '@/lib/jstudio-api';

interface RouteParams {
  params: Promise<{
    itemId: string;
  }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  const { itemId } = await params;

  if (!itemId) {
    return NextResponse.json({ error: 'Item ID is required' }, { status: 400 });
  }

  try {
    console.log(`Fetching item information for: ${itemId}`);
    const itemInfo = await jstudioAPI.getItemInfo(itemId);
    
    // Remove icon URL since the app has local images
    const itemWithoutIcon = {
      item_id: itemInfo.item_id,
      display_name: itemInfo.display_name,
      rarity: itemInfo.rarity,
      currency: itemInfo.currency,
      price: itemInfo.price,
      description: itemInfo.description,
      last_seen: itemInfo.last_seen,
      duration: itemInfo.duration
    };
    
    return NextResponse.json({
      item: itemWithoutIcon,
      lastUpdated: new Date().toISOString(),
      source: 'JStudio API'
    });
  } catch (error) {
    console.error(`Error fetching item info for ${itemId}:`, error);
    return NextResponse.json({ 
      error: 'Failed to fetch item information.',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 
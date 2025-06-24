import { NextResponse } from 'next/server';
import { jstudioAPI } from '@/lib/jstudio-api';

export async function GET() {
  try {
    console.log('Fetching all available item information from JStudio API...');
    const items = await jstudioAPI.getAllItemInfo();
    
    // Remove icon URLs since the app has local images
    const itemsWithoutIcons = items.map(item => ({
      item_id: item.item_id,
      display_name: item.display_name,
      rarity: item.rarity,
      currency: item.currency,
      price: item.price,
      description: item.description,
      last_seen: item.last_seen,
      duration: item.duration
    }));
    
    return NextResponse.json({
      items: itemsWithoutIcons,
      lastUpdated: new Date().toISOString(),
      source: 'JStudio API'
    });
  } catch (error) {
    console.error('Error fetching available items:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch available items.',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 
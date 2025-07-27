import { ALL_ITEMS } from '@/lib/notification-utils';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('Serving static available items list...');
    
    // Convert the ALL_ITEMS object to a flat array for the frontend
    const allItemsArray = [
      ...Object.values(ALL_ITEMS.seeds).map(name => ({ 
        item_id: name.toLowerCase().replace(/\s+/g, '_'), 
        display_name: name, 
        category: 'seeds' 
      })),
      ...Object.values(ALL_ITEMS.gear).map(name => ({ 
        item_id: name.toLowerCase().replace(/\s+/g, '_'), 
        display_name: name, 
        category: 'gear' 
      })),
      ...Object.values(ALL_ITEMS.eggs).map(name => ({ 
        item_id: name.toLowerCase().replace(/\s+/g, '_'), 
        display_name: name, 
        category: 'eggs' 
      })),
      ...Object.values(ALL_ITEMS.events).map(name => ({ 
        item_id: name.toLowerCase().replace(/\s+/g, '_'), 
        display_name: name, 
        category: 'events' 
      })),
      ...Object.values(ALL_ITEMS.weather).map(name => ({ 
        item_id: name.toLowerCase().replace(/\s+/g, '_'), 
        display_name: name, 
        category: 'weather' 
      }))
    ];
    
    return NextResponse.json({
      items: allItemsArray,
      lastUpdated: new Date().toISOString(),
      source: 'Static List (No API calls)'
    });
  } catch (error) {
    console.error('Error serving available items:', error);
    return NextResponse.json({ 
      error: 'Failed to serve available items.',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 
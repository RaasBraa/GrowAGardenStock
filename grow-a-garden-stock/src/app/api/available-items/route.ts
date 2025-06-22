import { NextResponse } from 'next/server';
import { getAllItems } from '../../../lib/pushNotifications';

export async function GET() {
  try {
    const items = getAllItems();
    
    return NextResponse.json({
      items,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error getting available items:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
} 
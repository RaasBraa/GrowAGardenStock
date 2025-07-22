import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import database from '@/lib/database.js';

const TOKENS_PATH = path.resolve(process.cwd(), 'push-tokens.json');

interface PushTokenEntry {
  token: string;
  created_at: string;
  last_used: string;
  is_active: boolean;
  device_type?: 'ios' | 'android';
  app_version?: string;
  user_agent?: string;
  ip_address?: string;
  preferences?: { [itemName: string]: boolean };
  onesignal_player_id?: string;
  failure_count?: number;
  last_failure?: string;
}

interface UpdatePreferencesRequest {
  token: string;
  preferences: { [itemName: string]: boolean };
}

function loadTokens(): PushTokenEntry[] {
  if (!fs.existsSync(TOKENS_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf-8')) as PushTokenEntry[];
  } catch (error) {
    console.error('Error loading tokens:', error);
    return [];
  }
}

function saveTokens(tokens: PushTokenEntry[]) {
  try {
    fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2));
  } catch (error) {
    console.error('Error saving tokens:', error);
    throw new Error('Failed to save tokens');
  }
}

function validateToken(token: string): { isValid: boolean; error?: string } {
  if (!token || typeof token !== 'string') {
    return { isValid: false, error: 'Token is required and must be a string' };
  }

  // Allow specific test tokens to bypass full validation for development
  if (token.startsWith('ExponentPushToken[test')) {
    return { isValid: true };
  }

  // Check if it's a OneSignal token (UUID format)
  if (token.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    return { isValid: true };
  }

  // Check if it's an Expo token
  // This part of the logic is no longer needed as Expo is removed.
  // Keeping it for now in case it's re-added or if there's a different validation needed.
  // if (!Expo.isExpoPushToken(token)) {
  //   return { isValid: false, error: 'Invalid push token format' };
  // }

  return { isValid: true };
}

function validatePreferences(preferences: Record<string, unknown>): { isValid: boolean; error?: string } {
  if (!preferences || typeof preferences !== 'object') {
    return { isValid: false, error: 'Preferences must be an object' };
  }
  
  // Check that all values are booleans
  for (const [itemName, enabled] of Object.entries(preferences)) {
    if (typeof enabled !== 'boolean') {
      return { isValid: false, error: `Preference for ${itemName} must be a boolean` };
    }
  }
  
  return { isValid: true };
}

// Helper function to determine if token is OneSignal
function isOneSignalToken(token: string): boolean {
  return token.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i) !== null;
}

export async function POST(req: NextRequest) {
  try {
    const body: UpdatePreferencesRequest = await req.json();
    const { token, preferences } = body;
    
    // Validate token
    const tokenValidation = validateToken(token);
    if (!tokenValidation.isValid) {
      return NextResponse.json(
        { 
          error: 'Invalid token', 
          details: tokenValidation.error 
        }, 
        { status: 400 }
      );
    }
    
    // Validate preferences
    const preferencesValidation = validatePreferences(preferences);
    if (!preferencesValidation.isValid) {
      return NextResponse.json(
        { 
          error: 'Invalid preferences', 
          details: preferencesValidation.error 
        }, 
        { status: 400 }
      );
    }
    
    // Determine if this is a OneSignal token
    const isOneSignal = isOneSignalToken(token);
    
    if (isOneSignal) {
      // Check database for OneSignal tokens
      try {
        await database.initialize();
        
        const existingTokens = await database.getTokens();
        const existingToken = existingTokens.find(t => t.token === token);
        
        if (existingToken) {
          // Update preferences in database
          const updates = {
            preferences: JSON.stringify(preferences),
            last_used: new Date().toISOString(),
            is_active: true // Reactivate if it was inactive
          };
          
          await database.updateToken(token, updates);
          
          console.log(`⚙️ Updated preferences for OneSignal token: ${token.substring(0, 20)}...`);
          console.log(`   Enabled items: ${Object.keys(preferences).filter(k => preferences[k]).length}`);
          console.log(`   Disabled items: ${Object.keys(preferences).filter(k => !preferences[k]).length}`);
          
          return NextResponse.json({ 
            message: 'OneSignal preferences updated successfully',
            action: 'updated',
            storage: 'database',
            enabledItems: Object.keys(preferences).filter(k => preferences[k]),
            disabledItems: Object.keys(preferences).filter(k => !preferences[k])
          });
        } else {
          return NextResponse.json(
            { 
              error: 'Token not found',
              message: 'The specified OneSignal token was not found in our database'
            }, 
            { status: 404 }
          );
        }
      } catch (dbError) {
        console.error('Database error:', dbError);
        return NextResponse.json(
          { 
            error: 'Database error',
            message: 'Failed to update preferences due to database error'
          }, 
          { status: 500 }
        );
      }
    }
    
    // Check JSON file for Expo tokens
    const tokens = loadTokens();
    const tokenEntry = tokens.find(t => t.token === token);
    
    if (!tokenEntry) {
      return NextResponse.json(
        { 
          error: 'Token not found',
          message: 'The specified token was not found in our database'
        }, 
        { status: 404 }
      );
    }
    
    // Update preferences
    tokenEntry.preferences = preferences;
    tokenEntry.last_used = new Date().toISOString();
    
    saveTokens(tokens);
    
    console.log(`⚙️ Updated preferences for Expo token: ${token.substring(0, 20)}...`);
    console.log(`   Enabled items: ${Object.keys(preferences).filter(k => preferences[k]).length}`);
    console.log(`   Disabled items: ${Object.keys(preferences).filter(k => !preferences[k]).length}`);
    
    return NextResponse.json({ 
      message: 'Expo preferences updated successfully',
      action: 'updated',
      storage: 'json',
      enabledItems: Object.keys(preferences).filter(k => preferences[k]),
      disabledItems: Object.keys(preferences).filter(k => !preferences[k])
    });
    
  } catch (error) {
    console.error('Error updating push preferences:', error);
    
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' }, 
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve current preferences for a token
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');
    
    if (!token) {
      return NextResponse.json(
        { error: 'Token parameter is required' }, 
        { status: 400 }
      );
    }
    
    // Validate token
    const tokenValidation = validateToken(token);
    if (!tokenValidation.isValid) {
      return NextResponse.json(
        { 
          error: 'Invalid token', 
          details: tokenValidation.error 
        }, 
        { status: 400 }
      );
    }
    
    // Determine if this is a OneSignal token
    const isOneSignal = isOneSignalToken(token);
    
    if (isOneSignal) {
      // Check database for OneSignal tokens
      try {
        await database.initialize();
        
        const existingTokens = await database.getTokens();
        const existingToken = existingTokens.find(t => t.token === token);
        
        if (existingToken) {
          const preferences = existingToken.preferences ? JSON.parse(existingToken.preferences) : {};
          return NextResponse.json({ 
            preferences,
            lastUpdated: existingToken.last_used,
            storage: 'database'
          });
        } else {
          return NextResponse.json(
            { 
              error: 'Token not found',
              message: 'The specified OneSignal token was not found in our database'
            }, 
            { status: 404 }
          );
        }
      } catch (dbError) {
        console.error('Database error:', dbError);
        return NextResponse.json(
          { 
            error: 'Database error',
            message: 'Failed to retrieve preferences due to database error'
          }, 
          { status: 500 }
        );
      }
    }
    
    // Check JSON file for Expo tokens
    const tokens = loadTokens();
    const tokenEntry = tokens.find(t => t.token === token);
    
    if (!tokenEntry) {
      return NextResponse.json(
        { 
          error: 'Token not found',
          message: 'The specified token was not found in our database'
        }, 
        { status: 404 }
      );
    }
    
    return NextResponse.json({ 
      preferences: tokenEntry.preferences || {},
      lastUpdated: tokenEntry.last_used,
      storage: 'json'
    });
    
  } catch (error) {
    console.error('Error retrieving push preferences:', error);
    
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
} 
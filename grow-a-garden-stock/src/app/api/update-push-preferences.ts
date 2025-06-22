import { NextRequest, NextResponse } from 'next/server';
import { Expo } from 'expo-server-sdk';
import * as fs from 'fs';
import * as path from 'path';

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
  
  if (token.length < 100) {
    return { isValid: false, error: 'Token appears to be too short' };
  }
  
  if (!Expo.isExpoPushToken(token)) {
    return { isValid: false, error: 'Invalid Expo push token format' };
  }
  
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
    
    // Load existing tokens
    const tokens = loadTokens();
    
    // Find the token to update
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
    
    console.log(`⚙️ Updated preferences for token: ${token.substring(0, 20)}...`);
    console.log(`   Enabled items: ${Object.keys(preferences).filter(k => preferences[k]).length}`);
    console.log(`   Disabled items: ${Object.keys(preferences).filter(k => !preferences[k]).length}`);
    
    return NextResponse.json({ 
      message: 'Preferences updated successfully',
      action: 'updated',
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
    
    // Load existing tokens
    const tokens = loadTokens();
    
    // Find the token
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
      lastUpdated: tokenEntry.last_used
    });
    
  } catch (error) {
    console.error('Error retrieving push preferences:', error);
    
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
} 
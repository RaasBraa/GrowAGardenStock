import { NextRequest, NextResponse } from 'next/server';
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
  onesignal_player_id?: string; // OneSignal player ID
}

interface RegisterRequest {
  token: string;
  device_type?: 'ios' | 'android';
  app_version?: string;
  preferences?: { [itemName: string]: boolean };
  onesignal_player_id?: string; // OneSignal player ID
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
    throw new Error('Failed to save token');
  }
}

function validateToken(token: string, onesignal_player_id?: string): { isValid: boolean; error?: string } {
  if (!token || typeof token !== 'string') {
    return { isValid: false, error: 'Token is required and must be a string' };
  }
  
  // Allow specific test tokens to bypass full validation for development
  if (token.startsWith('ExponentPushToken[test')) {
    return { isValid: true };
  }
  
  // For OneSignal, we expect either a valid OneSignal player ID or a legacy token
  if (onesignal_player_id) {
    // OneSignal player IDs are typically UUIDs
    if (!onesignal_player_id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return { isValid: false, error: 'Invalid OneSignal player ID format' };
    }
  }
  
  return { isValid: true };
}

function getClientIP(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const realIP = req.headers.get('x-real-ip');
  const cfConnectingIP = req.headers.get('cf-connecting-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  if (realIP) {
    return realIP;
  }
  if (cfConnectingIP) {
    return cfConnectingIP;
  }
  
  return 'unknown';
}

export async function POST(req: NextRequest) {
  try {
    const body: RegisterRequest = await req.json();
    const { token, device_type, app_version, preferences, onesignal_player_id } = body;
    
    // Validate token
    const validation = validateToken(token, onesignal_player_id);
    if (!validation.isValid) {
      return NextResponse.json(
        { 
          error: 'Invalid token', 
          details: validation.error 
        }, 
        { status: 400 }
      );
    }
    
    // Load existing tokens
    const tokens = loadTokens();
    
    // Check if token already exists
    const existingToken = tokens.find(t => t.token === token);
    
    if (existingToken) {
      // Update existing token with new metadata
      existingToken.last_used = new Date().toISOString();
      existingToken.is_active = true;
      if (device_type) existingToken.device_type = device_type;
      if (app_version) existingToken.app_version = app_version;
      if (preferences) existingToken.preferences = preferences;
      if (onesignal_player_id) existingToken.onesignal_player_id = onesignal_player_id;
      existingToken.user_agent = req.headers.get('user-agent') || undefined;
      existingToken.ip_address = getClientIP(req);
      
      saveTokens(tokens);
      
      console.log(`🔄 Updated existing token: ${token.substring(0, 20)}...`);
      
      return NextResponse.json({ 
        message: 'Token updated successfully',
        action: 'updated'
      });
    }
    
    // Add new token
    const newToken: PushTokenEntry = {
      token,
      created_at: new Date().toISOString(),
      last_used: new Date().toISOString(),
      is_active: true,
      device_type,
      app_version,
      preferences,
      onesignal_player_id,
      user_agent: req.headers.get('user-agent') || undefined,
      ip_address: getClientIP(req)
    };
    
    tokens.push(newToken);
    saveTokens(tokens);
    
    console.log(`✅ Registered new token: ${token.substring(0, 20)}... (${tokens.length} total tokens)`);
    
    return NextResponse.json({ 
      message: 'Token registered successfully',
      action: 'registered',
      totalTokens: tokens.length
    });
    
  } catch (error) {
    console.error('Error registering push token:', error);
    
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
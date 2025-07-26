import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import database from '../../../lib/database';

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
  failure_count?: number; // Track consecutive failures
  last_failure?: string; // Track when last failure occurred
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

// Helper function to merge preferences without overwriting existing ones
function mergePreferences(existingPreferences: { [itemName: string]: boolean } | undefined, newPreferences: { [itemName: string]: boolean } | undefined): { [itemName: string]: boolean } {
  if (!newPreferences) {
    return existingPreferences || {};
  }
  
  if (!existingPreferences) {
    return newPreferences;
  }
  
  // Merge preferences: keep existing ones, add/update new ones
  return { ...existingPreferences, ...newPreferences };
}

// Helper function to determine if token is OneSignal
function isOneSignalToken(token: string, onesignal_player_id?: string): boolean {
  return token.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/) !== null || !!onesignal_player_id;
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
    
    // Determine if this is a OneSignal token
    const isOneSignal = isOneSignalToken(token, onesignal_player_id);
    
    if (isOneSignal) {
      // Use database for OneSignal tokens
      try {
        await database.initialize();
        
        // Check if token already exists in database
        const existingTokens = await database.getTokens();
        const existingToken = existingTokens.find(t => t.token === token);
        
        if (existingToken) {
          // Update existing token
          const updates: any = {
            last_used: new Date().toISOString(),
            is_active: true, // Reactivate if it was inactive
            failure_count: 0, // Reset failure count
            last_failure: undefined // Clear last failure
          };
          
          if (device_type) updates.device_type = device_type;
          if (app_version) updates.app_version = app_version;
          if (onesignal_player_id) updates.onesignal_player_id = onesignal_player_id;
          
          // Merge preferences
          if (preferences) {
            const existingPrefs = existingToken.preferences ? JSON.parse(existingToken.preferences) : {};
            const mergedPrefs = mergePreferences(existingPrefs, preferences);
            updates.preferences = JSON.stringify(mergedPrefs);
          }
          
          await database.updateToken(token, updates);
          
          console.log(`🔄 Updated existing OneSignal token in database: ${token.substring(0, 20)}...`);
          
          return NextResponse.json({ 
            message: 'OneSignal token updated successfully',
            action: 'updated',
            storage: 'database',
            preferences: preferences ? JSON.parse(updates.preferences) : existingToken.preferences ? JSON.parse(existingToken.preferences) : {}
          });
        } else {
          // Add new OneSignal token to database
          const newToken = {
            token,
            created_at: new Date().toISOString(),
            last_used: new Date().toISOString(),
            is_active: true,
            device_type,
            app_version,
            preferences: preferences ? JSON.stringify(preferences) : undefined,
            onesignal_player_id,
            failure_count: 0
          };
          
          await database.insertToken(newToken);
          
          console.log(`✅ Registered new OneSignal token in database: ${token.substring(0, 20)}...`);
          
          return NextResponse.json({ 
            message: 'OneSignal token registered successfully',
            action: 'registered',
            storage: 'database',
            preferences: preferences || {}
          });
        }
      } catch (dbError) {
        console.error('Database error:', dbError);
        // Fallback to JSON if database fails
        console.log('🔄 Falling back to JSON storage for OneSignal token');
      }
    }
    
    // Use JSON for Expo tokens (backward compatibility)
    const tokens = loadTokens();
    
    // Check if token already exists
    const existingToken = tokens.find(t => t.token === token);
    
    if (existingToken) {
      // Update existing token with new metadata
      existingToken.last_used = new Date().toISOString();
      
      // FIXED: Reactivate token if it was previously inactive
      if (!existingToken.is_active) {
        console.log(`🔄 Reactivating previously inactive token: ${token.substring(0, 20)}...`);
        console.log(`   Previous failure count: ${existingToken.failure_count || 0}`);
        existingToken.is_active = true;
        existingToken.failure_count = 0; // Reset failure count
        existingToken.last_failure = undefined; // Clear last failure
      }
      
      if (device_type) existingToken.device_type = device_type;
      if (app_version) existingToken.app_version = app_version;
      
      // FIXED: Merge preferences instead of overwriting
      if (preferences) {
        const mergedPreferences = mergePreferences(existingToken.preferences, preferences);
        existingToken.preferences = mergedPreferences;
        console.log(`🔄 Merged preferences for token: ${token.substring(0, 20)}...`);
        console.log(`   Previous: ${Object.keys(existingToken.preferences || {}).length} items`);
        console.log(`   New: ${Object.keys(preferences).length} items`);
        console.log(`   Merged: ${Object.keys(mergedPreferences).length} items`);
      }
      
      if (onesignal_player_id) existingToken.onesignal_player_id = onesignal_player_id;
      existingToken.user_agent = req.headers.get('user-agent') || undefined;
      existingToken.ip_address = getClientIP(req);
      
      saveTokens(tokens);
      
      console.log(`🔄 Updated existing token: ${token.substring(0, 20)}...`);
      
      return NextResponse.json({ 
        message: 'Token updated successfully',
        action: 'updated',
        storage: 'json',
        preferences: existingToken.preferences
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
      storage: 'json',
      totalTokens: tokens.length,
      preferences: newToken.preferences
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
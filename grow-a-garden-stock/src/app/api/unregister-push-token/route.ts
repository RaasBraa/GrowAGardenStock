import { NextRequest, NextResponse } from 'next/server';
import { Expo } from 'expo-server-sdk';
import * as fs from 'fs';
import * as path from 'path';
import database from '@/lib/database';

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
  onesignal_player_id?: string;
}

interface UnregisterRequest {
  token: string;
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
  if (!Expo.isExpoPushToken(token)) {
    return { isValid: false, error: 'Invalid push token format' };
  }

  return { isValid: true };
}

// Helper function to determine if token is OneSignal
function isOneSignalToken(token: string): boolean {
  return token.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i) !== null;
}

export async function POST(req: NextRequest) {
  try {
    const body: UnregisterRequest = await req.json();
    const { token } = body;
    
    // Validate token
    const validation = validateToken(token);
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
    const isOneSignal = isOneSignalToken(token);
    
    if (isOneSignal) {
      // Check database for OneSignal tokens
      try {
        await database.initialize();
        
        const existingTokens = await database.getTokens();
        const existingToken = existingTokens.find(t => t.token === token);
        
        if (existingToken) {
          // Remove token from database
          await database.deleteToken(token);
          
          console.log(`🗑️ Unregistered OneSignal token: ${token.substring(0, 20)}...`);
          
          return NextResponse.json({ 
            message: 'OneSignal token unregistered successfully',
            action: 'unregistered',
            storage: 'database',
            removedToken: {
              created_at: existingToken.created_at,
              device_type: existingToken.device_type,
              app_version: existingToken.app_version
            }
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
            message: 'Failed to unregister token due to database error'
          }, 
          { status: 500 }
        );
      }
    }
    
    // Check JSON file for Expo tokens
    const tokens = loadTokens();
    const initialLength = tokens.length;
    
    // Find and remove the token
    const tokenToRemove = tokens.find(t => t.token === token);
    
    if (!tokenToRemove) {
      return NextResponse.json(
        { 
          error: 'Token not found',
          message: 'The specified token was not found in our database'
        }, 
        { status: 404 }
      );
    }
    
    // Remove the token
    const updatedTokens = tokens.filter(t => t.token !== token);
    saveTokens(updatedTokens);
    
    console.log(`🗑️ Unregistered Expo token: ${token.substring(0, 20)}... (${updatedTokens.length}/${initialLength} tokens remaining)`);
    
    return NextResponse.json({ 
      message: 'Expo token unregistered successfully',
      action: 'unregistered',
      storage: 'json',
      totalTokens: updatedTokens.length,
      removedToken: {
        created_at: tokenToRemove.created_at,
        device_type: tokenToRemove.device_type,
        app_version: tokenToRemove.app_version
      }
    });
    
  } catch (error) {
    console.error('Error unregistering push token:', error);
    
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
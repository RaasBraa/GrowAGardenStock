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

function validateToken(token: string): { isValid: boolean; error?: string } {
  if (!token || typeof token !== 'string') {
    return { isValid: false, error: 'Token is required and must be a string' };
  }

  // Allow specific test tokens to bypass full validation for development
  if (token.startsWith('ExponentPushToken[test')) {
    return { isValid: true };
  }

  // Basic validation for OneSignal player IDs (UUID format)
  const oneSignalPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!oneSignalPattern.test(token)) {
    return { isValid: false, error: 'Invalid token format' };
  }

  return { isValid: true };
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
    
    // Return preferences with additional metadata
    return NextResponse.json({ 
      success: true,
      preferences: tokenEntry.preferences || {},
      lastUpdated: tokenEntry.last_used,
      isActive: tokenEntry.is_active,
      deviceType: tokenEntry.device_type,
      appVersion: tokenEntry.app_version,
      createdAt: tokenEntry.created_at
    });
    
  } catch (error) {
    console.error('Error retrieving push preferences:', error);
    
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
} 
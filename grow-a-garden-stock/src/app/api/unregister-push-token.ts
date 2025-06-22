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
  
  if (token.length < 100) {
    return { isValid: false, error: 'Token appears to be too short' };
  }
  
  if (!Expo.isExpoPushToken(token)) {
    return { isValid: false, error: 'Invalid Expo push token format' };
  }
  
  return { isValid: true };
}

export async function DELETE(req: NextRequest) {
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
    
    // Load existing tokens
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
    
    console.log(`🗑️ Unregistered token: ${token.substring(0, 20)}... (${updatedTokens.length}/${initialLength} tokens remaining)`);
    
    return NextResponse.json({ 
      message: 'Token unregistered successfully',
      action: 'unregistered',
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
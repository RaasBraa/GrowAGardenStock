import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { getTokenStats } from '../../../lib/pushNotifications';

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

interface TokenResponse {
  id: string;
  created_at: string;
  last_used: string;
  is_active: boolean;
  device_type?: 'ios' | 'android';
  app_version?: string;
  ip_address?: string;
}

interface PaginationInfo {
  limit: number;
  offset: number;
  total: number;
  has_more: boolean;
}

interface ApiResponse {
  stats: ReturnType<typeof getTokenStats>;
  timestamp: string;
  tokens?: TokenResponse[];
  pagination?: PaginationInfo;
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

// GET - Get token statistics and list
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const includeTokens = searchParams.get('include_tokens') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    const tokens = loadTokens();
    const stats = getTokenStats();
    
    // Prepare response
    const response: ApiResponse = {
      stats,
      timestamp: new Date().toISOString()
    };
    
    if (includeTokens) {
      // Return paginated tokens with sensitive data removed
      const paginatedTokens: TokenResponse[] = tokens
        .slice(offset, offset + limit)
        .map(token => ({
          id: token.token.substring(0, 20) + '...',
          created_at: token.created_at,
          last_used: token.last_used,
          is_active: token.is_active,
          device_type: token.device_type,
          app_version: token.app_version,
          ip_address: token.ip_address
        }));
      
      response.tokens = paginatedTokens;
      response.pagination = {
        limit,
        offset,
        total: tokens.length,
        has_more: offset + limit < tokens.length
      };
    }
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Error getting token statistics:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}

// DELETE - Bulk cleanup operations
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    
    if (!action) {
      return NextResponse.json(
        { error: 'Action parameter is required' }, 
        { status: 400 }
      );
    }
    
    const tokens = loadTokens();
    let removedCount = 0;
    
    switch (action) {
      case 'cleanup_expired':
        // Remove tokens not used in 30 days
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const validTokens = tokens.filter(t => {
          const lastUsed = new Date(t.last_used);
          return lastUsed > thirtyDaysAgo && t.is_active;
        });
        removedCount = tokens.length - validTokens.length;
        
        if (removedCount > 0) {
          fs.writeFileSync(TOKENS_PATH, JSON.stringify(validTokens, null, 2));
          console.log(`🧹 Bulk cleanup: Removed ${removedCount} expired tokens`);
        }
        break;
        
      case 'cleanup_inactive':
        // Remove inactive tokens
        const activeTokens = tokens.filter(t => t.is_active);
        removedCount = tokens.length - activeTokens.length;
        
        if (removedCount > 0) {
          fs.writeFileSync(TOKENS_PATH, JSON.stringify(activeTokens, null, 2));
          console.log(`🧹 Bulk cleanup: Removed ${removedCount} inactive tokens`);
        }
        break;
        
      case 'cleanup_all':
        // Remove all tokens (use with caution!)
        removedCount = tokens.length;
        fs.writeFileSync(TOKENS_PATH, JSON.stringify([], null, 2));
        console.log(`🧹 Bulk cleanup: Removed all ${removedCount} tokens`);
        break;
        
      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: cleanup_expired, cleanup_inactive, or cleanup_all' }, 
          { status: 400 }
        );
    }
    
    const updatedStats = getTokenStats();
    
    return NextResponse.json({
      message: `Bulk cleanup completed`,
      action,
      removedCount,
      stats: updatedStats
    });
    
  } catch (error) {
    console.error('Error during bulk cleanup:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
} 
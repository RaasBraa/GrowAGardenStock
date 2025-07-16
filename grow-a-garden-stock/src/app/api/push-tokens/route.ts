import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { getTokenStats } from '@/lib/pushNotifications';
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
  onesignal_player_id?: string; // OneSignal player ID
  preferences?: string; // JSON string for database tokens
}

interface TokenResponse {
  id: string;
  created_at: string;
  last_used: string;
  is_active: boolean;
  device_type?: 'ios' | 'android';
  app_version?: string;
  ip_address?: string;
  onesignal_player_id?: string; // OneSignal player ID
  storage: 'database' | 'json';
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
    
    // Load tokens from both sources
    const jsonTokens = loadTokens();
    let dbTokens: PushTokenEntry[] = [];
    
    try {
      await database.initialize();
      const dbTokenData = await database.getTokens();
      dbTokens = dbTokenData.map(t => ({
        token: t.token,
        created_at: t.created_at,
        last_used: t.last_used,
        is_active: t.is_active,
        device_type: t.device_type,
        app_version: t.app_version,
        onesignal_player_id: t.onesignal_player_id,
        preferences: t.preferences
      }));
    } catch (dbError) {
      console.error('Database error:', dbError);
      // Continue with JSON tokens only
    }
    
    // Combine tokens from both sources
    const allTokens = [
      ...jsonTokens.map(t => ({ ...t, storage: 'json' as const })),
      ...dbTokens.map(t => ({ ...t, storage: 'database' as const }))
    ];
    
    const stats = getTokenStats();
    
    // Prepare response
    const response: ApiResponse = {
      stats,
      timestamp: new Date().toISOString()
    };
    
    if (includeTokens) {
      // Return paginated tokens with sensitive data removed
      const paginatedTokens: TokenResponse[] = allTokens
        .slice(offset, offset + limit)
        .map(token => ({
          id: token.token.substring(0, 20) + '...',
          created_at: token.created_at,
          last_used: token.last_used,
          is_active: token.is_active,
          device_type: token.device_type,
          app_version: token.app_version,
          ip_address: token.ip_address,
          onesignal_player_id: token.onesignal_player_id,
          storage: token.storage
        }));
      
      response.tokens = paginatedTokens;
      response.pagination = {
        limit,
        offset,
        total: allTokens.length,
        has_more: offset + limit < allTokens.length
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
    let dbRemovedCount = 0;
    
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
          console.log(`🧹 Bulk cleanup: Removed ${removedCount} expired JSON tokens`);
        }
        
        // Clean up database tokens
        try {
          await database.initialize();
          const dbTokens = await database.getTokens();
          const validDbTokens = dbTokens.filter(t => {
            const lastUsed = new Date(t.last_used);
            return lastUsed > thirtyDaysAgo && t.is_active;
          });
          dbRemovedCount = dbTokens.length - validDbTokens.length;
          
          if (dbRemovedCount > 0) {
            // Remove expired tokens from database
            for (const token of dbTokens) {
              const lastUsed = new Date(token.last_used);
              if (lastUsed <= thirtyDaysAgo || !token.is_active) {
                await database.deleteToken(token.token);
              }
            }
            console.log(`🧹 Bulk cleanup: Removed ${dbRemovedCount} expired database tokens`);
          }
        } catch (dbError) {
          console.error('Database cleanup error:', dbError);
        }
        break;
        
      case 'cleanup_inactive':
        // Remove inactive tokens
        const activeTokens = tokens.filter(t => t.is_active);
        removedCount = tokens.length - activeTokens.length;
        
        if (removedCount > 0) {
          fs.writeFileSync(TOKENS_PATH, JSON.stringify(activeTokens, null, 2));
          console.log(`🧹 Bulk cleanup: Removed ${removedCount} inactive JSON tokens`);
        }
        
        // Clean up inactive database tokens
        try {
          await database.initialize();
          const dbTokens = await database.getTokens();
          const activeDbTokens = dbTokens.filter(t => t.is_active);
          dbRemovedCount = dbTokens.length - activeDbTokens.length;
          
          if (dbRemovedCount > 0) {
            // Remove inactive tokens from database
            for (const token of dbTokens) {
              if (!token.is_active) {
                await database.deleteToken(token.token);
              }
            }
            console.log(`🧹 Bulk cleanup: Removed ${dbRemovedCount} inactive database tokens`);
          }
        } catch (dbError) {
          console.error('Database cleanup error:', dbError);
        }
        break;
        
      case 'cleanup_all':
        // Remove all tokens (use with caution!)
        removedCount = tokens.length;
        fs.writeFileSync(TOKENS_PATH, JSON.stringify([], null, 2));
        console.log(`🧹 Bulk cleanup: Removed all ${removedCount} JSON tokens`);
        
        // Clean up all database tokens
        try {
          await database.initialize();
          const dbTokens = await database.getTokens();
          dbRemovedCount = dbTokens.length;
          
          if (dbRemovedCount > 0) {
            // Remove all tokens from database
            for (const token of dbTokens) {
              await database.deleteToken(token.token);
            }
            console.log(`🧹 Bulk cleanup: Removed all ${dbRemovedCount} database tokens`);
          }
        } catch (dbError) {
          console.error('Database cleanup error:', dbError);
        }
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
      removedCount: removedCount + dbRemovedCount,
      jsonRemoved: removedCount,
      databaseRemoved: dbRemovedCount,
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
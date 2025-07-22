import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.resolve(process.cwd(), 'push-tokens.db');

export interface PushTokenEntry {
  id?: number;
  token: string;
  created_at: string;
  last_used: string;
  is_active: boolean;
  device_type?: 'ios' | 'android';
  app_version?: string;
  preferences?: string; // JSON string
  failure_count?: number;
  last_failure?: string;
  onesignal_player_id?: string;
}

class Database {
  private db: sqlite3.Database | null = null;
  private initializationPromise: Promise<void> | null = null;
  private operationQueue: Array<() => Promise<void>> = [];
  private isProcessingQueue = false;
  private lastOperationTime = 0;
  private readonly MIN_OPERATION_INTERVAL = 10; // 10ms between operations
  
  // Simple caching to reduce database calls
  private tokenCache: Map<string, PushTokenEntry> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_DURATION = 30000; // 30 seconds cache

  async initialize(): Promise<void> {
    // If already initialized, return immediately
    if (this.db) {
      return Promise.resolve();
    }

    // If initialization is in progress, wait for it
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // Start initialization
    this.initializationPromise = this._initialize();
    return this.initializationPromise;
  }

  private async _initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
        if (err) {
          console.error('Error opening database:', err);
          this.initializationPromise = null;
          reject(err);
          return;
        }
        
        // Enable WAL mode for better concurrency
        this.db!.run('PRAGMA journal_mode = WAL', (err) => {
          if (err) {
            console.warn('Warning: Could not enable WAL mode:', err);
          }
        });
        
        // Set busy timeout to handle concurrent access
        this.db!.configure('busyTimeout', 30000); // 30 seconds
        
        this.createTables()
          .then(() => {
            console.log('✅ Database initialized successfully');
            resolve();
          })
          .catch((error) => {
            this.initializationPromise = null;
            reject(error);
          });
      });
    });
  }

  // Queue operations to prevent database overload
  private async queueOperation<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.operationQueue.push(async () => {
        try {
          // Rate limiting between operations
          const now = Date.now();
          const timeSinceLastOp = now - this.lastOperationTime;
          if (timeSinceLastOp < this.MIN_OPERATION_INTERVAL) {
            await new Promise(resolve => setTimeout(resolve, this.MIN_OPERATION_INTERVAL - timeSinceLastOp));
          }
          
          const result = await operation();
          this.lastOperationTime = Date.now();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.operationQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      while (this.operationQueue.length > 0) {
        const operation = this.operationQueue.shift();
        if (operation) {
          await operation();
        }
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  private async createTables(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS push_tokens (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          token TEXT UNIQUE NOT NULL,
          created_at TEXT NOT NULL,
          last_used TEXT NOT NULL,
          is_active BOOLEAN DEFAULT 1,
          device_type TEXT,
          app_version TEXT,
          preferences TEXT,
          failure_count INTEGER DEFAULT 0,
          last_failure TEXT,
          onesignal_player_id TEXT
        )
      `;

      this.db!.run(createTableSQL, (err) => {
        if (err) {
          console.error('Error creating table:', err);
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  async migrateFromJSON(): Promise<void> {
    const jsonPath = path.resolve(process.cwd(), 'push-tokens.json');
    
    if (!fs.existsSync(jsonPath)) {
      console.log('📭 No push-tokens.json found to migrate');
      return;
    }

    try {
      const tokens = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      console.log(`🔄 Migrating ${tokens.length} tokens from JSON to database...`);

      for (const token of tokens) {
        await this.insertToken({
          token: token.token,
          created_at: token.created_at,
          last_used: token.last_used,
          is_active: token.is_active,
          device_type: token.device_type,
          app_version: token.app_version,
          preferences: token.preferences ? JSON.stringify(token.preferences) : undefined,
          failure_count: token.failure_count,
          last_failure: token.last_failure,
          onesignal_player_id: token.onesignal_player_id
        });
      }

      console.log(`✅ Successfully migrated ${tokens.length} tokens`);
      
      // Backup the old file
      const backupPath = `${jsonPath}.backup.${Date.now()}`;
      fs.copyFileSync(jsonPath, backupPath);
      console.log(`💾 Original file backed up to: ${backupPath}`);
      
    } catch (error) {
      console.error('❌ Error migrating from JSON:', error);
      throw error;
    }
  }

  async insertToken(token: PushTokenEntry): Promise<void> {
    return this.queueOperation(() => new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = `
        INSERT OR REPLACE INTO push_tokens 
        (token, created_at, last_used, is_active, device_type, app_version, preferences, failure_count, last_failure, onesignal_player_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      this.db!.run(sql, [
        token.token,
        token.created_at,
        token.last_used,
        token.is_active ? 1 : 0,
        token.device_type,
        token.app_version,
        token.preferences,
        token.failure_count || 0,
        token.last_failure,
        token.onesignal_player_id
      ], (err) => {
        if (err) {
          console.error('Error inserting token:', err);
          reject(err);
          return;
        }
        resolve();
      });
    }));
  }

  async updateToken(token: string, updates: Partial<PushTokenEntry>): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const setClauses: string[] = [];
      const values: any[] = [];

      if (updates.last_used !== undefined) {
        setClauses.push('last_used = ?');
        values.push(updates.last_used);
      }
      if (updates.is_active !== undefined) {
        setClauses.push('is_active = ?');
        values.push(updates.is_active ? 1 : 0);
      }
      if (updates.preferences !== undefined) {
        setClauses.push('preferences = ?');
        values.push(typeof updates.preferences === 'string' ? updates.preferences : JSON.stringify(updates.preferences));
      }
      if (updates.failure_count !== undefined) {
        setClauses.push('failure_count = ?');
        values.push(updates.failure_count);
      }
      if (updates.last_failure !== undefined) {
        setClauses.push('last_failure = ?');
        values.push(updates.last_failure);
      }
      if (updates.onesignal_player_id !== undefined) {
        setClauses.push('onesignal_player_id = ?');
        values.push(updates.onesignal_player_id);
      }

      if (setClauses.length === 0) {
        resolve();
        return;
      }

      values.push(token);

      const sql = `UPDATE push_tokens SET ${setClauses.join(', ')} WHERE token = ?`;

      this.db!.run(sql, values, (err) => {
        if (err) {
          console.error('Error updating token:', err);
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  async deleteToken(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = 'DELETE FROM push_tokens WHERE token = ?';

      this.db!.run(sql, [token], (err) => {
        if (err) {
          console.error('Error deleting token:', err);
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  async getTokens(filters?: {
    is_active?: boolean;
    device_type?: 'onesignal';
    has_preferences?: boolean;
  }): Promise<PushTokenEntry[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      let sql = 'SELECT * FROM push_tokens';
      const conditions: string[] = [];
      const values: any[] = [];

      if (filters?.is_active !== undefined) {
        conditions.push('is_active = ?');
        values.push(filters.is_active ? 1 : 0);
      }

      if (filters?.device_type === 'onesignal') {
        conditions.push("token REGEXP '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'");
      }

      if (filters?.has_preferences) {
        conditions.push('preferences IS NOT NULL AND preferences != "" AND preferences != "{}"');
      }

      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }

      this.db!.all(sql, values, (err, rows) => {
        if (err) {
          console.error('Error getting tokens:', err);
          reject(err);
          return;
        }

        const tokens: PushTokenEntry[] = rows.map((row: any) => ({
          id: row.id,
          token: row.token,
          created_at: row.created_at,
          last_used: row.last_used,
          is_active: Boolean(row.is_active),
          device_type: row.device_type,
          app_version: row.app_version,
          preferences: row.preferences,
          failure_count: row.failure_count,
          last_failure: row.last_failure,
          onesignal_player_id: row.onesignal_player_id
        }));

        resolve(tokens);
      });
    });
  }

  async getTokensForItem(itemName: string): Promise<PushTokenEntry[]> {
    const tokens = await this.getTokens({ is_active: true });
    return tokens.filter(token => {
      if (!token.preferences) return false;
      try {
        const prefs = JSON.parse(token.preferences);
        return prefs[itemName] === true;
      } catch {
        return false;
      }
    });
  }

  async getTokensForCategory(categoryName: string): Promise<PushTokenEntry[]> {
    const tokens = await this.getTokens({ is_active: true });
    return tokens.filter(token => {
      if (!token.preferences) return false;
      try {
        const prefs = JSON.parse(token.preferences);
        return prefs[categoryName] === true;
      } catch {
        return false;
      }
    });
  }

  async getTokensForWeather(): Promise<PushTokenEntry[]> {
    const tokens = await this.getTokens({ is_active: true });
    return tokens.filter(token => {
      if (!token.preferences) return false;
      try {
        const prefs = JSON.parse(token.preferences);
        return prefs["weather"] === true;
      } catch {
        return false;
      }
    });
  }

  async getOneSignalTokens(): Promise<PushTokenEntry[]> {
    return this.getTokens({ 
      is_active: true, 
      device_type: 'onesignal',
      has_preferences: true 
    });
  }

  async cleanupExpiredTokens(expiryDays: number = 30): Promise<number> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() - expiryDays);

      const sql = `
        DELETE FROM push_tokens 
        WHERE last_used < ? AND is_active = 0
      `;

      this.db!.run(sql, [expiryDate.toISOString()], function(err) {
        if (err) {
          console.error('Error cleaning up expired tokens:', err);
          reject(err);
          return;
        }
        console.log(`🧹 Cleaned up ${this.changes} expired inactive tokens`);
        resolve(this.changes);
      });
    });
  }

  async getStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    onesignal: number;
    withPreferences: number;
    withoutPreferences: number;
  }> {
    const allTokens = await this.getTokens();
    const activeTokens = await this.getTokens({ is_active: true });
    const inactiveTokens = await this.getTokens({ is_active: false });
    const oneSignalTokens = await this.getTokens({ device_type: 'onesignal' });
    const tokensWithPrefs = await this.getTokens({ has_preferences: true });
    const tokensWithoutPrefs = await this.getTokens({ has_preferences: false });

    return {
      total: allTokens.length,
      active: activeTokens.length,
      inactive: inactiveTokens.length,
      onesignal: oneSignalTokens.length,
      withPreferences: tokensWithPrefs.length,
      withoutPreferences: tokensWithoutPrefs.length
    };
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve();
        return;
      }

      this.db!.close((err) => {
        if (err) {
          console.error('Error closing database:', err);
          reject(err);
          return;
        }
        console.log('✅ Database closed successfully');
        resolve();
      });
    });
  }
}

// Singleton instance
const database = new Database();

export default database; 
import { Expo, ExpoPushMessage, ExpoPushReceipt } from 'expo-server-sdk';
import * as fs from 'fs';
import * as path from 'path';

const TOKENS_PATH = path.resolve(process.cwd(), 'push-tokens.json');
const expo = new Expo();

// Configuration constants
const RATE_LIMIT_DELAY = 1000; // 1 second between batches
const TOKEN_EXPIRY_DAYS = 30; // Remove tokens not used in 30 days
const MAX_RETRIES = 3;

interface PushTokenEntry {
  token: string;
  created_at: string;
  last_used: string;
  is_active: boolean;
  device_type?: 'ios' | 'android';
  app_version?: string;
}

interface NotificationData {
  itemName: string;
  rarity: string;
  quantity: number;
  type: 'rare_item_alert' | 'stock_update' | 'weather_alert';
  timestamp: string;
  channel?: string;
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
  }
}

function cleanupExpiredTokens(): void {
  const tokens = loadTokens();
  const now = new Date();
  const expiryDate = new Date(now.getTime() - TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  
  const validTokens = tokens.filter(t => {
    const lastUsed = new Date(t.last_used);
    return lastUsed > expiryDate && t.is_active;
  });
  
  if (validTokens.length !== tokens.length) {
    saveTokens(validTokens);
    console.log(`🧹 Cleaned up ${tokens.length - validTokens.length} expired tokens`);
  }
}

function updateTokenLastUsed(token: string): void {
  const tokens = loadTokens();
  const tokenEntry = tokens.find(t => t.token === token);
  if (tokenEntry) {
    tokenEntry.last_used = new Date().toISOString();
    saveTokens(tokens);
  }
}

function handleReceiptError(receipt: ExpoPushReceipt, token: string): void {
  if (receipt.details?.error === 'DeviceNotRegistered') {
    console.log(`📱 Device not registered, removing token: ${token.substring(0, 20)}...`);
  } else if (receipt.details?.error === 'MessageTooBig') {
    console.error(`📏 Message too big for token: ${token.substring(0, 20)}...`);
  } else if (receipt.details?.error === 'MessageRateExceeded') {
    console.warn(`⚡ Rate limit exceeded for token: ${token.substring(0, 20)}...`);
  } else if (receipt.details?.error === 'InvalidCredentials') {
    console.error(`🔐 Invalid credentials for token: ${token.substring(0, 20)}...`);
  } else {
    console.error(`❌ Push notification error for token ${token.substring(0, 20)}...:`, receipt.details || receipt.message);
  }
}

async function sendChunkWithRetry(chunk: ExpoPushMessage[], retryCount = 0): Promise<{ receipts: ExpoPushReceipt[], failedTokens: string[] }> {
  const failedTokens: string[] = [];
  
  try {
    const receipts = await expo.sendPushNotificationsAsync(chunk);
    
    receipts.forEach((receipt: ExpoPushReceipt, idx: number) => {
      const token = (chunk as ExpoPushMessage[])[idx]?.to as string;
      
      if (receipt.status === 'error') {
        handleReceiptError(receipt, token);
        failedTokens.push(token);
      } else if (receipt.status === 'ok') {
        // Update last used timestamp for successful deliveries
        updateTokenLastUsed(token);
      }
    });
    
    return { receipts, failedTokens };
  } catch (error) {
    console.error(`🚨 Push notification error (attempt ${retryCount + 1}):`, error);
    
    if (retryCount < MAX_RETRIES) {
      console.log(`🔄 Retrying in ${RATE_LIMIT_DELAY * (retryCount + 1)}ms...`);
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY * (retryCount + 1)));
      return sendChunkWithRetry(chunk, retryCount + 1);
    } else {
      // If all retries failed, mark all tokens in this chunk as failed
      chunk.forEach(message => {
        if (message.to) {
          failedTokens.push(message.to as string);
        }
      });
      return { receipts: [], failedTokens };
    }
  }
}

export async function sendRareItemNotification(itemName: string, rarity: string, quantity: number, channel?: string) {
  // Clean up expired tokens first
  cleanupExpiredTokens();
  
  const tokens = loadTokens().filter(t => t.is_active);
  if (tokens.length === 0) {
    console.log('📭 No active tokens to send notifications to');
    return;
  }

  const notificationData: NotificationData = {
    itemName,
    rarity,
    quantity,
    type: 'rare_item_alert',
    timestamp: new Date().toISOString(),
    channel
  };

  const messages: ExpoPushMessage[] = tokens.map(t => ({
    to: t.token,
    sound: 'default',
    title: `Rare Item Alert! 🌱`,
    body: `${itemName} (${rarity}) is in stock! Quantity: ${quantity}`,
    data: notificationData,
    priority: 'high',
    channelId: 'rare-items', // Android notification channel
    categoryId: 'rare-items', // iOS notification category
    subtitle: `Rarity: ${rarity}`,
    badge: 1,
  }));

  const chunks = expo.chunkPushNotifications(messages);
  const allFailedTokens: string[] = [];

  console.log(`📤 Sending ${messages.length} notifications in ${chunks.length} chunks...`);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    console.log(`📦 Processing chunk ${i + 1}/${chunks.length} (${chunk.length} messages)`);
    
    const { failedTokens } = await sendChunkWithRetry(chunk);
    allFailedTokens.push(...failedTokens);
    
    // Add delay between chunks to respect rate limits
    if (i < chunks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
    }
  }

  // Remove failed tokens
  if (allFailedTokens.length > 0) {
    const allTokens = loadTokens();
    const activeTokens = allTokens.filter(t => !allFailedTokens.includes(t.token));
    saveTokens(activeTokens);
    console.log(`🗑️ Removed ${allFailedTokens.length} failed tokens`);
  }

  const successCount = messages.length - allFailedTokens.length;
  console.log(`✅ Notification sent successfully to ${successCount}/${messages.length} devices`);
}

export async function sendStockUpdateNotification(updateType: 'seeds' | 'gear' | 'eggs' | 'cosmetics', itemCount: number) {
  cleanupExpiredTokens();
  
  const tokens = loadTokens().filter(t => t.is_active);
  if (tokens.length === 0) return;

  const notificationData: NotificationData = {
    itemName: `${updateType} update`,
    rarity: 'update',
    quantity: itemCount,
    type: 'stock_update',
    timestamp: new Date().toISOString(),
    channel: updateType
  };

  const messages: ExpoPushMessage[] = tokens.map(t => ({
    to: t.token,
    sound: 'default',
    title: `Stock Update 📦`,
    body: `${itemCount} new ${updateType} items available!`,
    data: notificationData,
    priority: 'default',
    channelId: 'stock-updates',
    categoryId: 'stock-updates',
  }));

  const chunks = expo.chunkPushNotifications(messages);
  const allFailedTokens: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const { failedTokens } = await sendChunkWithRetry(chunk);
    allFailedTokens.push(...failedTokens);
    
    if (i < chunks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
    }
  }

  if (allFailedTokens.length > 0) {
    const allTokens = loadTokens();
    const activeTokens = allTokens.filter(t => !allFailedTokens.includes(t.token));
    saveTokens(activeTokens);
  }
}

export async function sendWeatherAlertNotification(weatherType: string, description: string) {
  cleanupExpiredTokens();
  
  const tokens = loadTokens().filter(t => t.is_active);
  if (tokens.length === 0) return;

  const notificationData: NotificationData = {
    itemName: weatherType,
    rarity: 'weather',
    quantity: 1,
    type: 'weather_alert',
    timestamp: new Date().toISOString(),
    channel: 'weather'
  };

  const messages: ExpoPushMessage[] = tokens.map(t => ({
    to: t.token,
    sound: 'default',
    title: `Weather Alert ⛈️`,
    body: `${weatherType}: ${description}`,
    data: notificationData,
    priority: 'high',
    channelId: 'weather-alerts',
    categoryId: 'weather-alerts',
  }));

  const chunks = expo.chunkPushNotifications(messages);
  const allFailedTokens: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const { failedTokens } = await sendChunkWithRetry(chunk);
    allFailedTokens.push(...failedTokens);
    
    if (i < chunks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
    }
  }

  if (allFailedTokens.length > 0) {
    const allTokens = loadTokens();
    const activeTokens = allTokens.filter(t => !allFailedTokens.includes(t.token));
    saveTokens(activeTokens);
  }
}

// Utility function to get token statistics
export function getTokenStats() {
  const tokens = loadTokens();
  const activeTokens = tokens.filter(t => t.is_active);
  const expiredTokens = tokens.filter(t => {
    const lastUsed = new Date(t.last_used);
    const expiryDate = new Date(Date.now() - TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    return lastUsed < expiryDate;
  });

  return {
    total: tokens.length,
    active: activeTokens.length,
    expired: expiredTokens.length,
    lastCleanup: new Date().toISOString()
  };
} 
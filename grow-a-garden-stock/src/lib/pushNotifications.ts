import { Expo, ExpoPushMessage, ExpoPushReceipt } from 'expo-server-sdk';
import * as fs from 'fs';
import * as path from 'path';

const TOKENS_PATH = path.resolve(process.cwd(), 'push-tokens.json');
const expo = new Expo();

// Configuration constants
const RATE_LIMIT_DELAY = 1000; // 1 second between batches
const TOKEN_EXPIRY_DAYS = 30; // Remove tokens not used in 30 days
const MAX_RETRIES = 3;
const DUPLICATE_PREVENTION_WINDOW = 90 * 1000; // 1 minute 30 seconds in milliseconds

// Track recent notifications to prevent duplicates
const recentNotifications = new Map<string, number>();

interface PushTokenEntry {
  token: string;
  created_at: string;
  last_used: string;
  is_active: boolean;
  device_type?: 'ios' | 'android';
  app_version?: string;
  preferences?: { [itemName: string]: boolean };
}

interface NotificationData {
  itemName: string;
  rarity: string;
  quantity: number;
  type: 'rare_item_alert' | 'stock_update' | 'weather_alert';
  timestamp: string;
  channel?: string;
  [key: string]: unknown; // Add index signature for compatibility
}

// All available items for notifications
export const ALL_ITEMS = {
  seeds: [
    "Carrot", "Strawberry", "Blueberry", "Tomato", "Cauliflower", "Watermelon",
    "Green Apple", "Avocado", "Banana", "Pineapple", "Kiwi", "Bell Pepper",
    "Prickly Pear", "Loquat", "Feijoa", "Sugar Apple"
  ],
  gear: [
    "Watering Can", "Trowel", "Recall Wrench", "Basic Sprinkler", "Advanced Sprinkler",
    "Godly Sprinkler", "Tanning Mirror", "Master Sprinkler", "Cleaning Spray",
    "Favorite Tool", "Harvest Tool", "Friendship Pot"
  ],
  eggs: [
    "Common Egg", "Uncommon Egg", "Rare Egg", "Legendary Egg", "Mythical Egg",
    "Bug Egg", "Common Summer Egg", "Rare Summer Egg", "Paradise Egg"
  ],
  weather: [
    "Weather Alerts"
  ]
};

const categoryAssets = {
  'Seeds': { emoji: '🌱', title: 'Seed Stock Update' },
  'Gear': { emoji: '🛠️', title: 'Gear Stock Update' },
  'Eggs': { emoji: '🥚', title: 'Egg Stock Update' },
  'Cosmetics': { emoji: '✨', title: 'Cosmetic Stock Update' },
  'Default': { emoji: '🛒', title: 'Item in Stock!' }
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
  if (receipt.status === 'error') {
    if (receipt.details?.error === 'DeviceNotRegistered') {
      console.log(`📱 Device not registered, removing token: ${token.substring(0, 20)}...`);
    } else if (receipt.details?.error === 'MessageTooBig') {
      console.error(`📏 Message too big for token: ${token.substring(0, 20)}...`);
    } else if (receipt.details?.error === 'MessageRateExceeded') {
      console.warn(`⚡ Rate limit exceeded for token: ${token.substring(0, 20)}...`);
    } else if (receipt.details?.error === 'InvalidCredentials') {
      console.error(`🔐 Invalid credentials for token: ${token.substring(0, 20)}...`);
    } else {
      console.error(`❌ Push notification error for token ${token.substring(0, 20)}...:`, receipt.details);
    }
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
      } else {
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

// Helper function to get tokens interested in a specific item
function getTokensForItem(tokens: PushTokenEntry[], itemName: string): PushTokenEntry[] {
  return tokens.filter(token => {
    // If no preferences set, default to true (backward compatibility)
    if (!token.preferences) return true;
    return token.preferences[itemName] === true;
  });
}

// Helper function to get tokens interested in weather notifications
function getTokensForWeather(tokens: PushTokenEntry[]): PushTokenEntry[] {
  return tokens.filter(token => {
    // If no preferences set, default to true (backward compatibility)
    if (!token.preferences) return true;
    return token.preferences["Weather Alerts"] === true;
  });
}

// Helper function to prevent duplicate notifications
function isDuplicateNotification(itemName: string, quantity: number): boolean {
  const notificationKey = `${itemName}-${quantity}`;
  const now = Date.now();
  const lastSent = recentNotifications.get(notificationKey);
  
  if (lastSent && (now - lastSent) < DUPLICATE_PREVENTION_WINDOW) {
    return true; // This is a duplicate
  }
  
  // Record this notification
  recentNotifications.set(notificationKey, now);
  
  // Clean up old entries to prevent memory leaks
  for (const [key, timestamp] of recentNotifications.entries()) {
    if (now - timestamp > DUPLICATE_PREVENTION_WINDOW) {
      recentNotifications.delete(key);
    }
  }
  
  return false; // This is not a duplicate
}

export async function sendItemNotification(itemName: string, quantity: number, category: string) {
  // Check for duplicate notifications first
  if (isDuplicateNotification(itemName, quantity)) {
    console.log(`🚫 Skipping duplicate notification for ${itemName} (${quantity}) - sent within last 1.5 minutes`);
    return;
  }
  
  // Clean up expired tokens first
  cleanupExpiredTokens();
  
  const allTokens = loadTokens().filter(t => t.is_active);
  const interestedTokens = getTokensForItem(allTokens, itemName);
  
  if (interestedTokens.length === 0) {
    console.log(`📭 No users have notifications enabled for ${itemName}`);
    return;
  }

  const notificationData: NotificationData = {
    itemName,
    rarity: 'Common', // Default, can be enhanced later
    quantity,
    type: 'rare_item_alert',
    timestamp: new Date().toISOString(),
    channel: category.toLowerCase()
  };

  const assets = categoryAssets[category as keyof typeof categoryAssets] || categoryAssets.Default;

  const messages: ExpoPushMessage[] = interestedTokens.map(t => ({
    to: t.token,
    sound: 'default',
    title: `${assets.emoji} ${itemName} in Stock!`,
    body: `${itemName} is now available! Quantity: ${quantity}`,
    data: { ...notificationData },
    priority: 'high',
    channelId: 'item-alerts',
    categoryId: 'item-alerts',
    badge: 1,
  }));

  const chunks = expo.chunkPushNotifications(messages);
  const allFailedTokens: string[] = [];

  console.log(`📤 Sending ${itemName} notifications to ${interestedTokens.length} users in ${chunks.length} chunks...`);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
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
  console.log(`✅ ${itemName} notification sent successfully to ${successCount}/${messages.length} devices`);
}

export async function sendRareItemNotification(itemName: string, rarity: string, quantity: number, channel?: string) {
  // Clean up expired tokens first
  cleanupExpiredTokens();
  
  const allTokens = loadTokens().filter(t => t.is_active);
  const interestedTokens = getTokensForItem(allTokens, itemName);
  
  if (interestedTokens.length === 0) {
    console.log(`📭 No users have notifications enabled for ${itemName}`);
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

  const messages: ExpoPushMessage[] = interestedTokens.map(t => ({
    to: t.token,
    sound: 'default',
    title: `Rare Item Alert! 🌱`,
    body: `${itemName} (${rarity}) is in stock! Quantity: ${quantity}`,
    data: { ...notificationData },
    priority: 'high',
    channelId: 'rare-items',
    categoryId: 'rare-items',
    subtitle: `Rarity: ${rarity}`,
    badge: 1,
  }));

  const chunks = expo.chunkPushNotifications(messages);
  const allFailedTokens: string[] = [];

  console.log(`📤 Sending ${messages.length} rare item notifications in ${chunks.length} chunks...`);

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

export async function sendWeatherAlertNotification(weatherType: string, description: string) {
  cleanupExpiredTokens();
  
  const allTokens = loadTokens().filter(t => t.is_active);
  const interestedTokens = getTokensForWeather(allTokens);
  
  if (interestedTokens.length === 0) {
    console.log(`📭 No users have weather notifications enabled`);
    return;
  }

  const notificationData: NotificationData = {
    itemName: weatherType,
    rarity: 'weather',
    quantity: 1,
    type: 'weather_alert',
    timestamp: new Date().toISOString(),
    channel: 'weather'
  };

  const messages: ExpoPushMessage[] = interestedTokens.map(t => ({
    to: t.token,
    sound: 'default',
    title: `Weather Alert: ${weatherType}`,
    body: description,
    data: { ...notificationData },
    priority: 'normal',
    channelId: 'weather-alerts',
    categoryId: 'weather-alerts',
  }));

  const chunks = expo.chunkPushNotifications(messages);
  const allFailedTokens: string[] = [];

  console.log(`📤 Sending weather alert notifications to ${interestedTokens.length} users in ${chunks.length} chunks...`);

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
    console.log(`🗑️ Removed ${allFailedTokens.length} failed tokens`);
  }

  const successCount = messages.length - allFailedTokens.length;
  console.log(`✅ Weather alert sent successfully to ${successCount}/${messages.length} devices`);
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

// Utility function to get all available items
export function getAllItems() {
  return ALL_ITEMS;
} 
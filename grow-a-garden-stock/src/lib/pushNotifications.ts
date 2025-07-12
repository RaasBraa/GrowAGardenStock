import { Expo, ExpoPushMessage, ExpoPushReceipt } from 'expo-server-sdk';
import * as fs from 'fs';
import * as path from 'path';

const TOKENS_PATH = path.resolve(process.cwd(), 'push-tokens.json');
const expo = new Expo();

// Configuration constants
const RATE_LIMIT_DELAY = 100; // 100ms between batches (was 1000ms)
const TOKEN_EXPIRY_DAYS = 30; // Remove tokens not used in 30 days
const MAX_RETRIES = 3;
const TOKEN_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache
const TOKEN_FAILURE_THRESHOLD = 5; // Number of failures before marking token as inactive

// Token cache for performance
interface TokenCache {
  tokens: PushTokenEntry[];
  timestamp: number;
}

let tokenCache: TokenCache | null = null;

interface PushTokenEntry {
  token: string;
  created_at: string;
  last_used: string;
  is_active: boolean;
  device_type?: 'ios' | 'android';
  app_version?: string;
  preferences?: { [itemName: string]: boolean };
  failure_count?: number; // Track consecutive failures
  last_failure?: string; // Track when last failure occurred
}

interface NotificationData {
  itemName: string;
  rarity: string;
  quantity: number;
  type: 'rare_item_alert' | 'stock_update' | 'weather_alert' | 'category_alert';
  timestamp: string;
  channel?: string;
  [key: string]: unknown; // Add index signature for compatibility
}

// All available items for notifications
export const ALL_ITEMS = {
  seeds: [
    "Carrot", "Strawberry", "Blueberry", "Tomato", "Cauliflower", "Corn", "Watermelon",
    "Green Apple", "Avocado", "Banana", "Pineapple", "Kiwi", "Bell Pepper",
    "Prickly Pear", "Loquat", "Feijoa", "Sugar Apple"
  ],
  gear: [
    "Watering Can", "Trowel", "Recall Wrench", "Basic Sprinkler", "Advanced Sprinkler",
    "Godly Sprinkler", "Tanning Mirror", "Magnifying Glass", "Master Sprinkler", "Cleaning Spray",
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

// Optimized token loading with caching
function loadTokens(): PushTokenEntry[] {
  const now = Date.now();
  
  // Return cached tokens if still valid
  if (tokenCache && (now - tokenCache.timestamp) < TOKEN_CACHE_DURATION) {
    return tokenCache.tokens;
  }
  
  // Load from file
  if (!fs.existsSync(TOKENS_PATH)) {
    tokenCache = { tokens: [], timestamp: now };
    return [];
  }
  
  try {
    const tokens = JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf-8')) as PushTokenEntry[];
    tokenCache = { tokens, timestamp: now };
    return tokens;
  } catch (error) {
    console.error('Error loading tokens:', error);
    tokenCache = { tokens: [], timestamp: now };
    return [];
  }
}

// Optimized token saving with cache invalidation
function saveTokens(tokens: PushTokenEntry[]) {
  try {
    fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2));
    // Invalidate cache
    tokenCache = null;
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
    const isExpired = lastUsed < expiryDate;
    
    // Remove tokens that are expired and inactive
    if (isExpired && !t.is_active) {
      console.log(`🗑️ Removing expired inactive token: ${t.token.substring(0, 20)}...`);
      return false;
    }
    
    // Keep tokens that are either active or not expired
    return lastUsed > expiryDate || t.is_active;
  });
  
  if (validTokens.length !== tokens.length) {
    saveTokens(validTokens);
    console.log(`🧹 Cleaned up ${tokens.length - validTokens.length} expired tokens`);
  }
}

// Optimized token update without full file rewrite
function updateTokenLastUsed(token: string): void {
  if (!tokenCache) return;
  
  const tokenEntry = tokenCache.tokens.find(t => t.token === token);
  if (tokenEntry) {
    tokenEntry.last_used = new Date().toISOString();
    // Reset failure count on successful delivery
    tokenEntry.failure_count = 0;
    tokenEntry.last_failure = undefined;
  }
}

function handleReceiptError(receipt: ExpoPushReceipt, token: string): void {
  if (receipt.status === 'error') {
    const tokens = loadTokens();
    const tokenEntry = tokens.find(t => t.token === token);
    
    if (tokenEntry) {
      // Initialize failure tracking if not exists
      if (tokenEntry.failure_count === undefined) {
        tokenEntry.failure_count = 0;
      }
      
      tokenEntry.failure_count++;
      tokenEntry.last_failure = new Date().toISOString();
      
      if (receipt.details?.error === 'DeviceNotRegistered') {
        console.log(`📱 Device not registered, marking token as inactive: ${token.substring(0, 20)}...`);
        tokenEntry.is_active = false;
      } else if (receipt.details?.error === 'MessageTooBig') {
        console.error(`📏 Message too big for token: ${token.substring(0, 20)}...`);
      } else if (receipt.details?.error === 'MessageRateExceeded') {
        console.warn(`⚡ Rate limit exceeded for token: ${token.substring(0, 20)}... - will retry later`);
        // Don't increment failure count for rate limiting
        tokenEntry.failure_count--;
      } else if (receipt.details?.error === 'InvalidCredentials') {
        console.error(`🔐 Invalid credentials for token: ${token.substring(0, 20)}...`);
        tokenEntry.is_active = false;
      } else {
        console.error(`❌ Push notification error for token ${token.substring(0, 20)}...:`, receipt.details);
      }
      
      // Mark token as inactive if too many consecutive failures
      if (tokenEntry.failure_count >= TOKEN_FAILURE_THRESHOLD) {
        console.log(`🚫 Token ${token.substring(0, 20)}... marked inactive after ${TOKEN_FAILURE_THRESHOLD} failures`);
        tokenEntry.is_active = false;
      }
      
      saveTokens(tokens);
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
    // Only send notifications if user has explicitly enabled this item
    if (!token.preferences) return false; // No preferences = no notifications
    return token.preferences[itemName] === true;
  });
}

// Helper function to get tokens interested in category-level notifications
function getTokensForCategory(tokens: PushTokenEntry[], categoryName: string): PushTokenEntry[] {
  return tokens.filter(token => {
    // Only send notifications if user has explicitly enabled this category
    if (!token.preferences) return false; // No preferences = no notifications
    return token.preferences[categoryName] === true;
  });
}

// Helper function to get tokens interested in weather notifications
function getTokensForWeather(tokens: PushTokenEntry[]): PushTokenEntry[] {
  return tokens.filter(token => {
    // Only send notifications if user has explicitly enabled weather
    if (!token.preferences) return false; // No preferences = no notifications
    // Check for both "Weather" and "Weather Alerts" preferences
    return token.preferences["Weather"] === true || token.preferences["Weather Alerts"] === true;
  });
}

export async function sendItemNotification(itemName: string, quantity: number, category: string) {
  // Always send notifications for stock updates (removed duplicate check)
  // scheduleCleanup();
  
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

  // Use larger batch size for better performance
  const chunks = expo.chunkPushNotifications(messages);
  const allFailedTokens: string[] = [];

  console.log(`📤 Sending ${itemName} notifications to ${interestedTokens.length} users in ${chunks.length} chunks...`);

  // Process in batches for better performance
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const { failedTokens } = await sendChunkWithRetry(chunk);
    allFailedTokens.push(...failedTokens);
    
    // Reduced delay between chunks for faster processing
    if (i < chunks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
    }
  }

  // Note: Failed tokens are now handled by handleReceiptError function
  // which tracks failures and marks tokens as inactive after threshold

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
  console.log(`🌤️ Weather notification: Found ${allTokens.length} active tokens`);
  
  const interestedTokens = getTokensForWeather(allTokens);
  console.log(`🌤️ Weather notification: Found ${interestedTokens.length} tokens with weather preferences enabled`);
  
  // Debug: Show preference details for first few tokens
  if (interestedTokens.length > 0) {
    console.log(`🌤️ Weather notification: Sample preferences:`, 
      interestedTokens.slice(0, 3).map(t => ({
        token_preview: t.token.substring(0, 20) + '...',
        weather_pref: t.preferences?.["Weather"],
        weather_alerts_pref: t.preferences?.["Weather Alerts"]
      }))
    );
  }
  
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

export async function sendCategoryNotification(categoryName: string, categoryDisplayName: string, description: string) {
  cleanupExpiredTokens();
  
  const allTokens = loadTokens().filter(t => t.is_active);
  const interestedTokens = getTokensForCategory(allTokens, categoryName);
  
  if (interestedTokens.length === 0) {
    console.log(`📭 No users have notifications enabled for ${categoryName}`);
    return;
  }

  const notificationData: NotificationData = {
    itemName: categoryDisplayName,
    rarity: 'category',
    quantity: 1,
    type: 'category_alert',
    timestamp: new Date().toISOString(),
    channel: categoryName.toLowerCase()
  };

  const categoryAssets = {
    'Cosmetics': { emoji: '✨', title: 'Cosmetics Available!' },
    'Travelling Merchant': { emoji: '🛒', title: 'Travelling Merchant Arrived!' },
    'Default': { emoji: '📢', title: 'New Items Available!' }
  };

  const assets = categoryAssets[categoryDisplayName as keyof typeof categoryAssets] || categoryAssets.Default;

  const messages: ExpoPushMessage[] = interestedTokens.map(t => ({
    to: t.token,
    sound: 'default',
    title: `${assets.emoji} ${assets.title}`,
    body: description,
    data: { ...notificationData },
    priority: 'high',
    channelId: 'category-alerts',
    categoryId: 'category-alerts',
    badge: 1,
  }));

  const chunks = expo.chunkPushNotifications(messages);
  const allFailedTokens: string[] = [];

  console.log(`📤 Sending ${categoryName} category notifications to ${interestedTokens.length} users in ${chunks.length} chunks...`);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const { failedTokens } = await sendChunkWithRetry(chunk);
    allFailedTokens.push(...failedTokens);
    
    if (i < chunks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
    }
  }

  const successCount = messages.length - allFailedTokens.length;
  console.log(`✅ ${categoryName} category notification sent successfully to ${successCount}/${messages.length} devices`);
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
import * as fs from 'fs';
import * as path from 'path';

const TOKENS_PATH = path.resolve(process.cwd(), 'push-tokens.json');
const ONESIGNAL_APP_ID = '7a3f0ef9-af93-4481-93e1-375183500d50';
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;

// OneSignal optimized configuration - using full potential
const ONESIGNAL_CONFIG = {
  RATE_LIMIT_DELAY: 10, // 10ms between batches (100x faster than Expo!)
  MAX_RETRIES: 3,
  TOKEN_EXPIRY_DAYS: 30,
  TOKEN_CACHE_DURATION: 5 * 60 * 1000, // 5 minutes cache
  TOKEN_FAILURE_THRESHOLD: 5,
  MAX_PLAYER_IDS_PER_REQUEST: 2000, // OneSignal's limit
  BATCH_SIZE: 2000, // Send to 2000 users per API call
  CONCURRENT_REQUESTS: 5, // Send 5 requests simultaneously
  RETRY_DELAYS: [1000, 2000, 5000] // Exponential backoff
};

// Legacy Expo configuration (kept for backward compatibility)
const EXPO_CONFIG = {
  RATE_LIMIT_DELAY: 100, // Conservative 100ms for Expo
  MAX_RETRIES: 3,
  TOKEN_EXPIRY_DAYS: 30,
  TOKEN_CACHE_DURATION: 5 * 60 * 1000,
  TOKEN_FAILURE_THRESHOLD: 5,
  MAX_TOKENS_PER_REQUEST: 100, // Expo's limit
  BATCH_SIZE: 100 // Conservative batching for Expo
};

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
  onesignal_player_id?: string; // OneSignal player ID
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
    "Prickly Pear", "Loquat", "Feijoa", "Sugar Apple", "Giant Pinecone"
  ],
  gear: [
    "Watering Can", "Trowel", "Recall Wrench", "Basic Sprinkler", "Advanced Sprinkler",
    "Godly Sprinkler", "Tanning Mirror", "Magnifying Glass", "Master Sprinkler", "Cleaning Spray",
    "Favorite Tool", "Harvest Tool", "Friendship Pot", "Medium Toy", "Medium Treat", "Levelup Lollipop"
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
  if (tokenCache && (now - tokenCache.timestamp) < ONESIGNAL_CONFIG.TOKEN_CACHE_DURATION) {
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
  const expiryDate = new Date(now.getTime() - ONESIGNAL_CONFIG.TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  
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

function handleOneSignalError(error: string, token: string): void {
  const tokens = loadTokens();
  const tokenEntry = tokens.find(t => t.token === token);
  
  if (tokenEntry) {
    // Initialize failure tracking if not exists
    if (tokenEntry.failure_count === undefined) {
      tokenEntry.failure_count = 0;
    }
    
    tokenEntry.failure_count++;
    tokenEntry.last_failure = new Date().toISOString();
    
    // Check for specific OneSignal error types
    if (error.includes('invalid_player_ids') || error.includes('Player ID not found')) {
      console.log(`📱 Invalid OneSignal player ID, marking token as inactive: ${token.substring(0, 20)}...`);
      tokenEntry.is_active = false;
    } else if (error.includes('rate_limit') || error.includes('too many requests')) {
      console.warn(`⚡ Rate limit exceeded for token: ${token.substring(0, 20)}... - will retry later`);
      // Don't increment failure count for rate limiting
      tokenEntry.failure_count--;
    } else {
      console.error(`❌ OneSignal notification error for token ${token.substring(0, 20)}...:`, error);
    }
    
    // Mark token as inactive if too many consecutive failures
    if (tokenEntry.failure_count >= ONESIGNAL_CONFIG.TOKEN_FAILURE_THRESHOLD) {
      console.log(`🚫 Token ${token.substring(0, 20)}... marked inactive after ${ONESIGNAL_CONFIG.TOKEN_FAILURE_THRESHOLD} failures`);
      tokenEntry.is_active = false;
    }
    
    saveTokens(tokens);
  }
}

// Optimized OneSignal notification sending with full potential
async function sendOneSignalNotification(
  playerIds: string[],
  title: string,
  message: string,
  data?: Record<string, unknown>,
  retryCount = 0
): Promise<{ success: boolean; failedPlayerIds: string[] }> {
  const failedPlayerIds: string[] = [];
  
  if (!ONESIGNAL_API_KEY) {
    console.error('❌ OneSignal API key not configured');
    return { success: false, failedPlayerIds: playerIds };
  }

  // Split into batches of 2000 (OneSignal's limit)
  const batches: string[][] = [];
  for (let i = 0; i < playerIds.length; i += ONESIGNAL_CONFIG.BATCH_SIZE) {
    batches.push(playerIds.slice(i, i + ONESIGNAL_CONFIG.BATCH_SIZE));
  }

  console.log(`📤 Sending OneSignal notification in ${batches.length} batches (${playerIds.length} total recipients)`);

  // Send batches with optimized concurrency
  const batchPromises = batches.map(async (batch, batchIndex) => {
    // Add small delay between batches for optimal performance
    if (batchIndex > 0) {
      await new Promise(resolve => setTimeout(resolve, ONESIGNAL_CONFIG.RATE_LIMIT_DELAY));
    }

    try {
      const response = await fetch('https://onesignal.com/api/v1/notifications', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${ONESIGNAL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          app_id: ONESIGNAL_APP_ID,
          include_player_ids: batch,
          headings: { en: title },
          contents: { en: message },
          data: data || {},
          priority: 10, // High priority
          ttl: 86400, // 24 hours
        }),
      });

      const result = await response.json();

      if (response.ok) {
        console.log(`✅ OneSignal batch ${batchIndex + 1}/${batches.length} sent successfully to ${batch.length} devices`);
        return { success: true, failedPlayerIds: [] };
      } else {
        console.error(`❌ OneSignal API error in batch ${batchIndex + 1}:`, result);
        
        // Handle specific error cases
        if (result.errors && result.errors.invalid_player_ids) {
          console.log(`📱 Invalid player IDs in batch ${batchIndex + 1}: ${result.errors.invalid_player_ids.length}`);
          return { success: false, failedPlayerIds: result.errors.invalid_player_ids };
        } else {
          return { success: false, failedPlayerIds: batch };
        }
      }
    } catch (error) {
      console.error(`🚨 OneSignal batch ${batchIndex + 1} error (attempt ${retryCount + 1}):`, error);
      
      if (retryCount < ONESIGNAL_CONFIG.MAX_RETRIES) {
        const retryDelay = ONESIGNAL_CONFIG.RETRY_DELAYS[retryCount] || 5000;
        console.log(`🔄 Retrying batch ${batchIndex + 1} in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return sendOneSignalNotification(batch, title, message, data, retryCount + 1);
      } else {
        return { success: false, failedPlayerIds: batch };
      }
    }
  });

  // Wait for all batches to complete
  const results = await Promise.allSettled(batchPromises);
  
  // Aggregate results
  let totalSuccess = 0;
  let totalFailed = 0;
  
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      if (result.value.success) {
        totalSuccess += batches[index].length;
      } else {
        totalFailed += result.value.failedPlayerIds.length;
        failedPlayerIds.push(...result.value.failedPlayerIds);
      }
    } else {
      totalFailed += batches[index].length;
      failedPlayerIds.push(...batches[index]);
    }
  });

  const overallSuccess = totalFailed === 0;
  
  if (overallSuccess) {
    console.log(`🎉 OneSignal notification completed successfully to ${totalSuccess} devices`);
  } else {
    console.log(`⚠️ OneSignal notification completed with ${totalFailed} failures out of ${playerIds.length} total`);
  }

  return { success: overallSuccess, failedPlayerIds };
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
    // Check for the correct weather preference key (lowercase "weather")
    return token.preferences["weather"] === true;
  });
}

export async function sendItemNotification(itemName: string, quantity: number, category: string) {
  cleanupExpiredTokens();
  
  const allTokens = loadTokens().filter(t => t.is_active && t.onesignal_player_id);
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

  const playerIds = interestedTokens.map(t => t.onesignal_player_id!).filter(Boolean);
  
  if (playerIds.length === 0) {
    console.log(`📭 No valid OneSignal player IDs for ${itemName} notifications`);
    return;
  }

  console.log(`📤 Sending ${itemName} notifications to ${playerIds.length} users via OneSignal (optimized)...`);

  const { success, failedPlayerIds } = await sendOneSignalNotification(
    playerIds,
    `${assets.emoji} ${itemName} in Stock!`,
    `${itemName} is now available! Quantity: ${quantity}`,
    notificationData
  );

  if (success) {
    console.log(`✅ ${itemName} notification sent successfully to ${playerIds.length} devices`);
  } else {
    console.log(`❌ ${itemName} notification failed for ${failedPlayerIds.length} devices`);
  }
}

export async function sendRareItemNotification(itemName: string, rarity: string, quantity: number, channel?: string) {
  cleanupExpiredTokens();
  
  const allTokens = loadTokens().filter(t => t.is_active && t.onesignal_player_id);
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

  const playerIds = interestedTokens.map(t => t.onesignal_player_id!).filter(Boolean);
  
  if (playerIds.length === 0) {
    console.log(`📭 No valid OneSignal player IDs for ${itemName} notifications`);
    return;
  }

  console.log(`📤 Sending ${playerIds.length} rare item notifications via OneSignal (optimized)...`);

  const { success, failedPlayerIds } = await sendOneSignalNotification(
    playerIds,
    `Rare Item Alert! 🌱`,
    `${itemName} (${rarity}) is in stock! Quantity: ${quantity}`,
    notificationData
  );

  if (success) {
    console.log(`✅ Rare item notification sent successfully to ${playerIds.length} devices`);
  } else {
    console.log(`❌ Rare item notification failed for ${failedPlayerIds.length} devices`);
  }
}

export async function sendWeatherAlertNotification(weatherType: string, description: string) {
  cleanupExpiredTokens();
  
  const allTokens = loadTokens().filter(t => t.is_active && t.onesignal_player_id);
  const interestedTokens = getTokensForWeather(allTokens);
  
  console.log(`🌤️ Weather notification: ${interestedTokens.length}/${allTokens.length} tokens have weather enabled`);
  
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

  const playerIds = interestedTokens.map(t => t.onesignal_player_id!).filter(Boolean);
  
  if (playerIds.length === 0) {
    console.log(`📭 No valid OneSignal player IDs for weather notifications`);
    return;
  }

  console.log(`📤 Sending weather alert notifications to ${playerIds.length} users via OneSignal (optimized)...`);

  const { success, failedPlayerIds } = await sendOneSignalNotification(
    playerIds,
    `Weather Alert: ${weatherType}`,
    description,
    notificationData
  );

  if (success) {
    console.log(`✅ Weather alert sent successfully to ${playerIds.length} devices`);
  } else {
    console.log(`❌ Weather alert failed for ${failedPlayerIds.length} devices`);
  }
}

export async function sendCategoryNotification(categoryName: string, categoryDisplayName: string, description: string) {
  cleanupExpiredTokens();
  
  const allTokens = loadTokens().filter(t => t.is_active && t.onesignal_player_id);
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

  const playerIds = interestedTokens.map(t => t.onesignal_player_id!).filter(Boolean);
  
  if (playerIds.length === 0) {
    console.log(`📭 No valid OneSignal player IDs for ${categoryName} notifications`);
    return;
  }

  console.log(`📤 Sending ${categoryName} category notifications to ${playerIds.length} users via OneSignal (optimized)...`);

  const { success, failedPlayerIds } = await sendOneSignalNotification(
    playerIds,
    `${assets.emoji} ${assets.title}`,
    description,
    notificationData
  );

  if (success) {
    console.log(`✅ ${categoryName} category notification sent successfully to ${playerIds.length} devices`);
  } else {
    console.log(`❌ ${categoryName} category notification failed for ${failedPlayerIds.length} devices`);
  }
}

// Utility function to get token statistics
export function getTokenStats() {
  const tokens = loadTokens();
  const activeTokens = tokens.filter(t => t.is_active);
  const expiredTokens = tokens.filter(t => {
    const lastUsed = new Date(t.last_used);
    const expiryDate = new Date(Date.now() - ONESIGNAL_CONFIG.TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
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

// Export configurations for reference
export { ONESIGNAL_CONFIG, EXPO_CONFIG }; 
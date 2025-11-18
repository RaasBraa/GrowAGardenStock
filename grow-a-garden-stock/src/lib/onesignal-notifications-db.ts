import database from './database.js';

const ONESIGNAL_APP_ID = '7a3f0ef9-af93-4481-93e1-375183500d50';

// Get API key dynamically to ensure environment variables are loaded
function getOneSignalApiKey(): string | undefined {
  return process.env.ONESIGNAL_API_KEY;
}

// OneSignal configuration based on official rate limits
// https://documentation.onesignal.com/reference/rate-limits
const ONESIGNAL_CONFIG = {
  // Rate Limits (per second) - OneSignal allows 150 requests/sec (free) or 6,000 requests/sec (paid)
  RATE_LIMIT_PER_SECOND: 150, // Conservative: 150 requests per second (free tier)
  RATE_LIMIT_DELAY: 10, // Minimal delay: 10ms between requests (100 requests/sec)
  
  // Retry Configuration
  MAX_RETRIES: 3,
  RETRY_DELAYS: [1000, 2000, 5000], // Exponential backoff
  
  // Token Management
  TOKEN_EXPIRY_DAYS: 30,
  TOKEN_FAILURE_THRESHOLD: 5,
  
  // Batch Configuration (Reduced for memory safety)
  MAX_PLAYER_IDS_PER_REQUEST: 1000, // Reduced from 2000 to 1000 for memory safety
  BATCH_SIZE: 1000, // Reduced from 2000 to 1000 for memory safety
  CONCURRENT_REQUESTS: 3, // Reduced from 5 to 3 for memory safety
  
  // Rate limiting state
  lastRequestTime: 0,
  requestCount: 0,
  rateLimitResetTime: 0
};

interface NotificationData {
  itemName: string;
  rarity: string;
  quantity: number;
  type: 'rare_item_alert' | 'stock_update' | 'weather_alert' | 'category_alert';
  timestamp: string;
  channel?: string;
  [key: string]: unknown;
}

// All available items for notifications
export const ALL_ITEMS = {
  seeds: [
    "Carrot", "Strawberry", "Blueberry", "Orange Tulip", "Tomato", "Corn", "Daffodil",
    "Watermelon", "Pumpkin", "Apple", "Bamboo", "Broccoli", "Coconut", "Cactus", 
    "Dragon Fruit", "Mango", "Potato", "Grape", "Mushroom", "Pepper", "Cacao", 
    "Brussels Sprout", "Sunflower", "Beanstalk", "Ember Lily", "Sugar Apple", "Burning Bud", 
    "Giant Pinecone", "Elder Strawberry", "Romanesco", "Cocomango", "Crimson Thorn", "Great Pumpkin",
    "Buttercup", "Trinity Fruit", "Zebrazinkle"
  ],
  gear: [
    "Watering Can", "Trowel", "Recall Wrench", "Basic Sprinkler", "Advanced Sprinkler",
    "Godly Sprinkler", "Tanning Mirror", "Magnifying Glass", "Master Sprinkler", "Cleaning Spray",
    "Favorite Tool", "Harvest Tool", "Friendship Pot", "Medium Toy", "Medium Treat", "Levelup Lollipop",
    "Cleansing Pet Shard", "Pet Name Reroller", "Pet Lead", "Rainbow Lollipop"
  ],
  eggs: [
    "Common Egg", "Uncommon Egg", "Rare Egg", "Legendary Egg", "Mythical Egg",
    "Bug Egg", "Common Summer Egg", "Rare Summer Egg", "Paradise Egg", "Jungle Egg"
  ],
  events: [
    "Zen Seed Pack", "Zen Egg", "Hot Spring", "Zen Sand", "Tranquil Radar", 
    "Corrupt Radar", "Zenflare", "Zen Crate", "Sakura Bush", "Soft Sunshine", 
    "Koi", "Zen Gnome Crate", "Spiked Mango", "Pet Shard Tranquil", 
    "Pet Shard Corrupted", "Raiju"
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
  'Events': { emoji: '🎉', title: 'Event Stock Update' },
  'Default': { emoji: '🛒', title: 'Item in Stock!' }
}

// Rate limiting helper function
async function respectRateLimit(): Promise<void> {
  const now = Date.now();
  
  // Reset counter if second has passed
  if (now > ONESIGNAL_CONFIG.rateLimitResetTime) {
    ONESIGNAL_CONFIG.requestCount = 0;
    ONESIGNAL_CONFIG.rateLimitResetTime = now + 1000; // Next second
  }
  
  // Check if we're at the rate limit
  if (ONESIGNAL_CONFIG.requestCount >= ONESIGNAL_CONFIG.RATE_LIMIT_PER_SECOND) {
    const waitTime = ONESIGNAL_CONFIG.rateLimitResetTime - now;
    console.log(`⚡ Rate limit reached (${ONESIGNAL_CONFIG.RATE_LIMIT_PER_SECOND}/sec), waiting ${waitTime}ms...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
    ONESIGNAL_CONFIG.requestCount = 0;
    ONESIGNAL_CONFIG.rateLimitResetTime = Date.now() + 1000;
  }
  
  // Ensure minimum delay between requests (much shorter now)
  const timeSinceLastRequest = now - ONESIGNAL_CONFIG.lastRequestTime;
  if (timeSinceLastRequest < ONESIGNAL_CONFIG.RATE_LIMIT_DELAY) {
    const delay = ONESIGNAL_CONFIG.RATE_LIMIT_DELAY - timeSinceLastRequest;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  ONESIGNAL_CONFIG.lastRequestTime = Date.now();
  ONESIGNAL_CONFIG.requestCount++;
}

// Helper function to split player IDs into batches
function splitIntoBatches(playerIds: string[], batchSize: number): string[][] {
  const batches: string[][] = [];
  for (let i = 0; i < playerIds.length; i += batchSize) {
    batches.push(playerIds.slice(i, i + batchSize));
  }
  return batches;
}

// Helper function to send notifications in batches
async function sendBatchedNotifications(
  playerIds: string[],
  title: string,
  message: string,
  data?: Record<string, unknown>
): Promise<{ success: boolean; failedPlayerIds: string[] }> {
  if (playerIds.length <= ONESIGNAL_CONFIG.MAX_PLAYER_IDS_PER_REQUEST) {
    // No batching needed, send directly
    return sendOneSignalNotification(playerIds, title, message, data);
  }

  console.log(`📦 Sending notification to ${playerIds.length} users in batches of ${ONESIGNAL_CONFIG.BATCH_SIZE}...`);
  
  const batches = splitIntoBatches(playerIds, ONESIGNAL_CONFIG.BATCH_SIZE);
  const allFailedPlayerIds: string[] = [];
  let successCount = 0;
  let failureCount = 0;

  // Process batches with limited concurrency
  const concurrencyLimit = ONESIGNAL_CONFIG.CONCURRENT_REQUESTS;
  const batchPromises: Promise<{ success: boolean; failedPlayerIds: string[] }>[] = [];

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`📤 Sending batch ${i + 1}/${batches.length} to ${batch.length} users...`);
    
    const batchPromise = sendOneSignalNotification(batch, title, message, data);
    batchPromises.push(batchPromise);
    
    // Limit concurrent requests
    if (batchPromises.length >= concurrencyLimit) {
      const results = await Promise.all(batchPromises);
      batchPromises.length = 0; // Clear array
      
      for (const result of results) {
        if (result.success) {
          successCount += batch.length;
        } else {
          failureCount += batch.length;
          allFailedPlayerIds.push(...result.failedPlayerIds);
        }
      }
      
      // Memory cleanup after each batch
      if (global.gc) {
        global.gc();
      }
      
      // Small delay between batch groups
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
  
  // Process remaining batches
  if (batchPromises.length > 0) {
    const results = await Promise.all(batchPromises);
    
    for (const result of results) {
      if (result.success) {
        successCount += result.failedPlayerIds.length === 0 ? 1000 : 1000 - result.failedPlayerIds.length;
      } else {
        failureCount += result.failedPlayerIds.length;
        allFailedPlayerIds.push(...result.failedPlayerIds);
      }
    }
  }
  
  // Final memory cleanup
  if (global.gc) {
    global.gc();
  }
  
  console.log(`✅ Batch notification completed: ${successCount} successful, ${failureCount} failed`);
  return { success: failureCount === 0, failedPlayerIds: allFailedPlayerIds };
}

async function sendOneSignalNotification(
  playerIds: string[],
  title: string,
  message: string,
  data?: Record<string, unknown>,
  retryCount = 0
): Promise<{ success: boolean; failedPlayerIds: string[] }> {
  const apiKey = getOneSignalApiKey();
  if (!apiKey) {
    console.error('❌ OneSignal API key not configured');
    return { success: false, failedPlayerIds: playerIds };
  }

  if (playerIds.length === 0) {
    return { success: true, failedPlayerIds: [] };
  }

  // Check if we need to use batching
  if (playerIds.length > ONESIGNAL_CONFIG.MAX_PLAYER_IDS_PER_REQUEST) {
    return sendBatchedNotifications(playerIds, title, message, data);
  }

  // Respect rate limits
  await respectRateLimit();

  const payload: Record<string, unknown> = {
    app_id: ONESIGNAL_APP_ID,
    include_player_ids: playerIds,
    headings: { en: title },
    contents: { en: message },
    data: data || {},
    ios_sound: 'default',
    android_sound: 'default'
  };

  // Only add android_channel_id if explicitly configured
  if (process.env.ONESIGNAL_ANDROID_CHANNEL_ID) {
    payload.android_channel_id = process.env.ONESIGNAL_ANDROID_CHANNEL_ID;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout for slow networks
    
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${apiKey}`
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    const result = await response.json();

    if (response.ok && result.id) {
      console.log(`✅ OneSignal notification sent successfully (ID: ${result.id})`);
      return { success: true, failedPlayerIds: [] };
    } else {
      console.error('❌ OneSignal API error:', result);
      
      // Handle rate limiting specifically
      if (response.status === 429 || (result.errors && result.errors.rate_limit)) {
        console.warn(`⚡ Rate limit hit, will retry with exponential backoff`);
        if (retryCount < ONESIGNAL_CONFIG.MAX_RETRIES) {
          const delay = ONESIGNAL_CONFIG.RETRY_DELAYS[retryCount] || 5000;
          console.log(`🔄 Retrying in ${delay}ms... (attempt ${retryCount + 1}/${ONESIGNAL_CONFIG.MAX_RETRIES})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return sendOneSignalNotification(playerIds, title, message, data, retryCount + 1);
        }
      }
      
      // Handle specific error types
      if (result.errors && result.errors.invalid_player_ids) {
        const failedIds = result.errors.invalid_player_ids;
        console.log(`📱 Invalid player IDs: ${failedIds.length}`);
        
        // Mark failed tokens as inactive
        for (const playerId of failedIds) {
          await handleOneSignalError('invalid_player_ids', playerId);
        }
        
        return { success: false, failedPlayerIds: failedIds };
      }
      
      return { success: false, failedPlayerIds: playerIds };
    }
  } catch (error) {
    const errorObj = error as Error;
    const networkError = errorObj as { code?: string };
    const isNetworkError = errorObj.name === 'AbortError' || 
                          networkError.code === 'ETIMEDOUT' || 
                          networkError.code === 'ECONNRESET' ||
                          errorObj.message.includes('fetch failed') ||
                          errorObj.message.includes('timeout');
    
    if (isNetworkError) {
      console.error(`🌐 OneSignal network error (attempt ${retryCount + 1}/${ONESIGNAL_CONFIG.MAX_RETRIES + 1}):`, errorObj.message);
    } else {
      console.error('❌ OneSignal request failed:', errorObj);
    }
    
    if (retryCount < ONESIGNAL_CONFIG.MAX_RETRIES) {
      const delay = ONESIGNAL_CONFIG.RETRY_DELAYS[retryCount] || 5000;
      console.log(`🔄 Retrying in ${delay}ms... (attempt ${retryCount + 1}/${ONESIGNAL_CONFIG.MAX_RETRIES})`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return sendOneSignalNotification(playerIds, title, message, data, retryCount + 1);
    }
    
    return { success: false, failedPlayerIds: playerIds };
  }
}

async function handleOneSignalError(error: string, playerId: string): Promise<void> {
  try {
    // Find token by OneSignal player ID
    const tokens = await database.getTokens();
    const tokenEntry = tokens.find(t => t.onesignal_player_id === playerId);
    
    if (tokenEntry) {
      let failureCount = tokenEntry.failure_count || 0;
      failureCount++;
      
      const updates: Record<string, unknown> = {
        failure_count: failureCount,
        last_failure: new Date().toISOString()
      };
      
      if (error.includes('invalid_player_ids') || error.includes('Player ID not found')) {
        console.log(`📱 Invalid OneSignal player ID, marking token as inactive: ${tokenEntry.token.substring(0, 20)}...`);
        updates.is_active = false;
      } else if (error.includes('rate_limit') || error.includes('too many requests')) {
        console.warn(`⚡ Rate limit exceeded for token: ${tokenEntry.token.substring(0, 20)}... - will retry later`);
        // Don't increment failure count for rate limiting
        updates.failure_count = failureCount - 1;
      } else {
        console.error(`❌ OneSignal notification error for token ${tokenEntry.token.substring(0, 20)}...:`, error);
      }
      
      // Mark token as inactive if too many consecutive failures
      if (failureCount >= ONESIGNAL_CONFIG.TOKEN_FAILURE_THRESHOLD) {
        console.log(`🚫 Token ${tokenEntry.token.substring(0, 20)}... marked inactive after ${ONESIGNAL_CONFIG.TOKEN_FAILURE_THRESHOLD} failures`);
        updates.is_active = false;
      }
      
      await database.updateToken(tokenEntry.token, updates);
    }
  } catch (error) {
    console.error('Error handling OneSignal error:', error);
  }
}

export async function sendItemNotification(itemName: string, quantity: number, category: string) {
  try {
    // Initialize database if needed
    await database.initialize();
    
    // Clean up expired tokens
    await database.cleanupExpiredTokens();
    
    // Get tokens for this specific item
    const interestedTokens = await database.getTokensForItem(itemName);
    
    if (interestedTokens.length === 0) {
      console.log(`📭 No users have notifications enabled for ${itemName}`);
      return;
    }

    const notificationData: NotificationData = {
      itemName,
      rarity: 'Common',
      quantity,
      type: 'rare_item_alert',
      timestamp: new Date().toISOString(),
      channel: category.toLowerCase()
    };

    const assets = categoryAssets[category as keyof typeof categoryAssets] || categoryAssets.Default;

    const playerIds = interestedTokens
      .map(t => t.onesignal_player_id)
      .filter(Boolean) as string[];
    
    if (playerIds.length === 0) {
      console.log(`📭 No valid OneSignal player IDs for ${itemName} notifications`);
      return;
    }

    console.log(`📤 Sending ${itemName} notifications to ${playerIds.length} users via OneSignal (database)...`);

    const { success, failedPlayerIds } = await sendOneSignalNotification(
      playerIds,
      `${assets.emoji} ${itemName} in Stock!`,
      `${itemName} is now available! Quantity: ${quantity}`,
      notificationData
    );

    if (success) {
      console.log(`✅ ${itemName} notification sent successfully to ${playerIds.length} devices`);
      
      // Update last_used for successful tokens
      for (const token of interestedTokens) {
        await database.updateToken(token.token, { 
          last_used: new Date().toISOString(),
          failure_count: 0 
        });
      }
    } else {
      console.log(`❌ ${itemName} notification failed for ${failedPlayerIds.length} devices`);
    }
  } catch (error) {
    console.error(`❌ Error sending ${itemName} notification:`, error);
  }
}

export async function sendRareItemNotification(itemName: string, rarity: string, quantity: number, channel?: string) {
  try {
    // Initialize database if needed
    await database.initialize();
    
    await database.cleanupExpiredTokens();
    
    const interestedTokens = await database.getTokensForItem(itemName);
    
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

    const playerIds = interestedTokens
      .map(t => t.onesignal_player_id)
      .filter(Boolean) as string[];
    
    if (playerIds.length === 0) {
      console.log(`📭 No valid OneSignal player IDs for ${itemName} notifications`);
      return;
    }

    console.log(`📤 Sending ${playerIds.length} rare item notifications via OneSignal (database)...`);

    const { success, failedPlayerIds } = await sendOneSignalNotification(
      playerIds,
      `Rare Item Alert! 🌱`,
      `${itemName} (${rarity}) is in stock! Quantity: ${quantity}`,
      notificationData
    );

    if (success) {
      console.log(`✅ Rare item notification sent successfully to ${playerIds.length} devices`);
      
      // Update last_used for successful tokens
      for (const token of interestedTokens) {
        await database.updateToken(token.token, { 
          last_used: new Date().toISOString(),
          failure_count: 0 
        });
      }
    } else {
      console.log(`❌ Rare item notification failed for ${failedPlayerIds.length} devices`);
    }
  } catch (error) {
    console.error(`❌ Error sending rare item notification:`, error);
  }
}

export async function sendWeatherAlertNotification(weatherType: string, description: string) {
  try {
    // Initialize database if needed
    await database.initialize();
    
    await database.cleanupExpiredTokens();
    
    const interestedTokens = await database.getTokensForWeather();
    
    console.log(`🌤️ Weather notification: ${interestedTokens.length} tokens have weather enabled`);
    
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

    const playerIds = interestedTokens
      .map(t => t.onesignal_player_id)
      .filter(Boolean) as string[];
    
    if (playerIds.length === 0) {
      console.log(`📭 No valid OneSignal player IDs for weather notifications`);
      return;
    }

    console.log(`📤 Sending weather alert notifications to ${playerIds.length} users via OneSignal (database)...`);

    const { success, failedPlayerIds } = await sendOneSignalNotification(
      playerIds,
      `🌤️ Weather Alert: ${weatherType}`,
      description,
      notificationData
    );

    if (success) {
      console.log(`✅ Weather alert sent successfully to ${playerIds.length} devices`);
      
      // Update last_used for successful tokens
      for (const token of interestedTokens) {
        await database.updateToken(token.token, { 
          last_used: new Date().toISOString(),
          failure_count: 0 
        });
      }
    } else {
      console.log(`❌ Weather alert failed for ${failedPlayerIds.length} devices`);
    }
  } catch (error) {
    console.error(`❌ Error sending weather alert:`, error);
  }
}

export async function sendCategoryNotification(categoryName: string, categoryDisplayName: string, description: string) {
  try {
    // Initialize database if needed
    await database.initialize();
    
    await database.cleanupExpiredTokens();
    
    const interestedTokens = await database.getTokensForCategory(categoryName);
    
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
      'Events': { emoji: '🎉', title: 'Event Items Available!' },
      'Default': { emoji: '📢', title: 'New Items Available!' }
    };

    const assets = categoryAssets[categoryDisplayName as keyof typeof categoryAssets] || categoryAssets.Default;

    const playerIds = interestedTokens
      .map(t => t.onesignal_player_id)
      .filter(Boolean) as string[];
    
    if (playerIds.length === 0) {
      console.log(`📭 No valid OneSignal player IDs for ${categoryName} notifications`);
      return;
    }

    console.log(`📤 Sending ${categoryName} category notifications to ${playerIds.length} users via OneSignal (database)...`);

    const { success, failedPlayerIds } = await sendOneSignalNotification(
      playerIds,
      `${assets.emoji} ${assets.title}`,
      description,
      notificationData
    );

    if (success) {
      console.log(`✅ Category notification sent successfully to ${playerIds.length} devices`);
      
      // Update last_used for successful tokens
      for (const token of interestedTokens) {
        await database.updateToken(token.token, { 
          last_used: new Date().toISOString(),
          failure_count: 0 
        });
      }
    } else {
      console.log(`❌ Category notification failed for ${failedPlayerIds.length} devices`);
    }
  } catch (error) {
    console.error(`❌ Error sending category notification:`, error);
  }
}

export async function getTokenStats() {
  try {
    await database.initialize();
    const stats = await database.getStats();
    
    return {
      total: stats.total,
      active: stats.active,
      inactive: stats.inactive,
      onesignal: stats.onesignal,
      withPreferences: stats.withPreferences,
      withoutPreferences: stats.withoutPreferences,
      lastCleanup: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error getting token stats:', error);
    return {
      total: 0,
      active: 0,
      inactive: 0,
      onesignal: 0,
      withPreferences: 0,
      withoutPreferences: 0,
      lastCleanup: new Date().toISOString()
    };
  }
}

export function getAllItems() {
  return ALL_ITEMS;
} 
 
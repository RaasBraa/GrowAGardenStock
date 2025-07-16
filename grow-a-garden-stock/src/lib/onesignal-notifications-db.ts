import database from './database.js';

const ONESIGNAL_APP_ID = '7a3f0ef9-af93-4481-93e1-375183500d50';
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;

// OneSignal configuration based on official rate limits
// https://documentation.onesignal.com/reference/rate-limits
const ONESIGNAL_CONFIG = {
  // Rate Limits (per minute)
  RATE_LIMIT_PER_MINUTE: 300, // 300 requests per minute
  RATE_LIMIT_DELAY: 200, // 200ms between requests (300 requests/min = 1 request/200ms)
  
  // Retry Configuration
  MAX_RETRIES: 3,
  RETRY_DELAYS: [1000, 2000, 5000], // Exponential backoff
  
  // Token Management
  TOKEN_EXPIRY_DAYS: 30,
  TOKEN_FAILURE_THRESHOLD: 5,
  
  // Batch Configuration (OneSignal limits)
  MAX_PLAYER_IDS_PER_REQUEST: 2000, // OneSignal's limit per request
  BATCH_SIZE: 2000, // Send to 2000 users per API call
  CONCURRENT_REQUESTS: 1, // Reduced to 1 to respect rate limits
  
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

// Rate limiting helper function
async function respectRateLimit(): Promise<void> {
  const now = Date.now();
  
  // Reset counter if minute has passed
  if (now > ONESIGNAL_CONFIG.rateLimitResetTime) {
    ONESIGNAL_CONFIG.requestCount = 0;
    ONESIGNAL_CONFIG.rateLimitResetTime = now + 60000; // Next minute
  }
  
  // Check if we're at the rate limit
  if (ONESIGNAL_CONFIG.requestCount >= ONESIGNAL_CONFIG.RATE_LIMIT_PER_MINUTE) {
    const waitTime = ONESIGNAL_CONFIG.rateLimitResetTime - now;
    console.log(`⚡ Rate limit reached (${ONESIGNAL_CONFIG.RATE_LIMIT_PER_MINUTE}/min), waiting ${waitTime}ms...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
    ONESIGNAL_CONFIG.requestCount = 0;
    ONESIGNAL_CONFIG.rateLimitResetTime = Date.now() + 60000;
  }
  
  // Ensure minimum delay between requests
  const timeSinceLastRequest = now - ONESIGNAL_CONFIG.lastRequestTime;
  if (timeSinceLastRequest < ONESIGNAL_CONFIG.RATE_LIMIT_DELAY) {
    const delay = ONESIGNAL_CONFIG.RATE_LIMIT_DELAY - timeSinceLastRequest;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  ONESIGNAL_CONFIG.lastRequestTime = Date.now();
  ONESIGNAL_CONFIG.requestCount++;
}

async function sendOneSignalNotification(
  playerIds: string[],
  title: string,
  message: string,
  data?: Record<string, unknown>,
  retryCount = 0
): Promise<{ success: boolean; failedPlayerIds: string[] }> {
  if (!ONESIGNAL_API_KEY) {
    console.error('❌ OneSignal API key not configured');
    return { success: false, failedPlayerIds: playerIds };
  }

  if (playerIds.length === 0) {
    return { success: true, failedPlayerIds: [] };
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
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${ONESIGNAL_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

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
    console.error('❌ OneSignal request failed:', error);
    
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
      `Weather Alert: ${weatherType}`,
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
    // Initialize database if needed
    await database.initialize();
    
    const stats = await database.getStats();
    return {
      total: stats.total,
      active: stats.active,
      inactive: stats.inactive,
      expo: stats.expo,
      onesignal: stats.onesignal,
      withPreferences: stats.withPreferences,
      withoutPreferences: stats.withoutPreferences
    };
  } catch (error) {
    console.error('Error getting token stats:', error);
    return null;
  }
}

export function getAllItems() {
  return ALL_ITEMS;
} 
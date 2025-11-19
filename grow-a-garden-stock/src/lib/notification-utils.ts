import database from './database';

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
    "Grandmaster Sprinkler", "Trading Ticket", "Cleansing Pet Shard",
    "Pet Name Reroller", "Pet Lead", "Rainbow Lollipop"
  ],
  eggs: [
    "Common Egg", "Uncommon Egg", "Rare Egg", "Legendary Egg", "Mythical Egg",
    "Bug Egg", "Common Summer Egg", "Rare Summer Egg", "Paradise Egg", "Jungle Egg", "Gem Egg"
  ],
  events: [],
  weather: [
    "Weather Alerts"
  ]
};

// Utility function to get token statistics from database
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

// Utility function to get all items
export function getAllItems() {
  return ALL_ITEMS;
} 
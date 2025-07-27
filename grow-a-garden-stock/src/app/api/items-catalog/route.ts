import { NextResponse } from 'next/server';

export async function GET() {
  const itemsCatalog = {
    seeds: {
      name: "Seeds",
      description: "Plant seeds available in the shop",
      items: [
        // Common
        { id: "carrot", name: "Carrot", rarity: "Common", category: "seeds" },
        { id: "strawberry", name: "Strawberry", rarity: "Common", category: "seeds" },
        // Uncommon
        { id: "blueberry", name: "Blueberry", rarity: "Uncommon", category: "seeds" },
        { id: "orange_tulip", name: "Orange Tulip", rarity: "Uncommon", category: "seeds" },
        // Rare
        { id: "tomato", name: "Tomato", rarity: "Rare", category: "seeds" },
        { id: "daffodil", name: "Daffodil", rarity: "Rare", category: "seeds" },
        { id: "corn", name: "Corn", rarity: "Rare", category: "seeds" },
        // Legendary
        { id: "watermelon", name: "Watermelon", rarity: "Legendary", category: "seeds" },
        { id: "pumpkin", name: "Pumpkin", rarity: "Legendary", category: "seeds" },
        { id: "apple", name: "Apple", rarity: "Legendary", category: "seeds" },
        { id: "bamboo", name: "Bamboo", rarity: "Legendary", category: "seeds" },
        // Mythical
        { id: "coconut", name: "Coconut", rarity: "Mythical", category: "seeds" },
        { id: "cactus", name: "Cactus", rarity: "Mythical", category: "seeds" },
        { id: "dragon_fruit", name: "Dragon Fruit", rarity: "Mythical", category: "seeds" },
        { id: "mango", name: "Mango", rarity: "Mythical", category: "seeds" },
        // Divine
        { id: "grape", name: "Grape", rarity: "Divine", category: "seeds" },
        { id: "mushroom", name: "Mushroom", rarity: "Divine", category: "seeds" },
        { id: "pepper", name: "Pepper", rarity: "Divine", category: "seeds" },
        { id: "cacao", name: "Cacao", rarity: "Divine", category: "seeds" },
        // Prismatic
        { id: "beanstalk", name: "Beanstalk", rarity: "Prismatic", category: "seeds" },
        { id: "ember_lily", name: "Ember Lily", rarity: "Prismatic", category: "seeds" },
        { id: "sugar_apple", name: "Sugar Apple", rarity: "Prismatic", category: "seeds" },
        { id: "burning_bud", name: "Burning Bud", rarity: "Prismatic", category: "seeds" },
        { id: "giant_pinecone", name: "Giant Pinecone", rarity: "Prismatic", category: "seeds" },
        { id: "elder_strawberry", name: "Elder Strawberry", rarity: "Prismatic", category: "seeds" }
      ],
      defaultEnabled: ["grape", "mushroom", "pepper", "cacao", "beanstalk", "ember_lily", "sugar_apple", "burning_bud", "giant_pinecone", "elder_strawberry"]
    },
    gear: {
      name: "Gear",
      description: "Tools and equipment available in the shop",
      items: [
        // Common
        { id: "watering_can", name: "Watering Can", rarity: "Common", category: "gear" },
        // Uncommon
        { id: "trowel", name: "Trowel", rarity: "Uncommon", category: "gear" },
        { id: "recall_wrench", name: "Recall Wrench", rarity: "Uncommon", category: "gear" },
        // Rare
        { id: "basic_sprinkler", name: "Basic Sprinkler", rarity: "Rare", category: "gear" },
        // Legendary
        { id: "advanced_sprinkler", name: "Advanced Sprinkler", rarity: "Legendary", category: "gear" },
        { id: "medium_toy", name: "Medium Toy", rarity: "Legendary", category: "gear" },
        { id: "medium_treat", name: "Medium Treat", rarity: "Legendary", category: "gear" },
        // Mythical
        { id: "godly_sprinkler", name: "Godly Sprinkler", rarity: "Mythical", category: "gear" },
        { id: "tanning_mirror", name: "Tanning Mirror", rarity: "Mythical", category: "gear" },
        { id: "magnifying_glass", name: "Magnifying Glass", rarity: "Mythical", category: "gear" },
        // Divine
        { id: "master_sprinkler", name: "Master Sprinkler", rarity: "Divine", category: "gear" },
        { id: "cleaning_spray", name: "Cleaning Spray", rarity: "Divine", category: "gear" },
        { id: "favorite_tool", name: "Favorite Tool", rarity: "Divine", category: "gear" },
        { id: "harvest_tool", name: "Harvest Tool", rarity: "Divine", category: "gear" },
        { id: "friendship_pot", name: "Friendship Pot", rarity: "Divine", category: "gear" },
        // Prismatic
        { id: "levelup_lollipop", name: "Levelup Lollipop", rarity: "Prismatic", category: "gear" }
      ],
      defaultEnabled: ["godly_sprinkler", "tanning_mirror", "master_sprinkler", "magnifying_glass", "medium_toy", "medium_treat", "levelup_lollipop"]
    },
    eggs: {
      name: "Eggs",
      description: "Eggs available in the shop",
      items: [
        // Common
        { id: "common_egg", name: "Common Egg", rarity: "Common", category: "eggs" },
        { id: "common_summer_egg", name: "Common Summer Egg", rarity: "Common", category: "eggs" },
        // Uncommon
        { id: "uncommon_egg", name: "Uncommon Egg", rarity: "Uncommon", category: "eggs" },
        // Rare
        { id: "rare_egg", name: "Rare Egg", rarity: "Rare", category: "eggs" },
        { id: "rare_summer_egg", name: "Rare Summer Egg", rarity: "Rare", category: "eggs" },
        // Legendary
        { id: "legendary_egg", name: "Legendary Egg", rarity: "Legendary", category: "eggs" },
        // Mythical
        { id: "mythical_egg", name: "Mythical Egg", rarity: "Mythical", category: "eggs" },
        { id: "paradise_egg", name: "Paradise Egg", rarity: "Mythical", category: "eggs" },
        { id: "bee_egg", name: "Bee Egg", rarity: "Mythical", category: "eggs" },
        // Divine
        { id: "bug_egg", name: "Bug Egg", rarity: "Divine", category: "eggs" }
      ],
      defaultEnabled: ["mythical_egg", "paradise_egg", "bug_egg"]
    },
    cosmetics: {
      name: "Cosmetics",
      description: "Cosmetic items available in the shop (single notification per restock)",
      items: [],
      notificationType: "category", // Single notification for entire category
      defaultEnabled: true
    },
    travellingMerchant: {
      name: "Travelling Merchant",
      description: "Items from the travelling merchant (single notification per restock)",
      items: [],
      notificationType: "category", // Single notification for entire category
      defaultEnabled: true
    },
    weather: {
      name: "Weather",
      description: "Weather notifications (general weather updates)",
      items: [],
      notificationType: "general", // General weather notifications
      defaultEnabled: true
    },
    events: {
      name: "Events",
      description: "Event shop items (individual notifications per item)",
      items: [
        // Rare
        { id: "zen_seed_pack", name: "Zen Seed Pack", rarity: "Rare", category: "events" },
        { id: "zen_sand", name: "Zen Sand", rarity: "Rare", category: "events" },
        { id: "tranquil_radar", name: "Tranquil Radar", rarity: "Rare", category: "events" },
        { id: "corrupt_radar", name: "Corrupt Radar", rarity: "Rare", category: "events" },
        { id: "zenflare", name: "Zenflare", rarity: "Rare", category: "events" },
        // Legendary
        { id: "zen_egg", name: "Zen Egg", rarity: "Legendary", category: "events" },
        { id: "zen_crate", name: "Zen Crate", rarity: "Legendary", category: "events" },
        { id: "sakura_bush", name: "Sakura Bush", rarity: "Legendary", category: "events" },
        { id: "soft_sunshine", name: "Soft Sunshine", rarity: "Legendary", category: "events" },
        // Mythical
        { id: "koi", name: "Koi", rarity: "Mythical", category: "events" },
        { id: "zen_gnome_crate", name: "Zen Gnome Crate", rarity: "Mythical", category: "events" },
        { id: "spiked_mango", name: "Spiked Mango", rarity: "Mythical", category: "events" },
        // Divine
        { id: "hot_spring", name: "Hot Spring", rarity: "Divine", category: "events" },
        { id: "pet_shard_tranquil", name: "Pet Shard Tranquil", rarity: "Divine", category: "events" },
        { id: "pet_shard_corrupted", name: "Pet Shard Corrupted", rarity: "Divine", category: "events" },
        { id: "raiju", name: "Raiju", rarity: "Divine", category: "events" }
      ],
      notificationType: "individual", // Individual notifications per item
      defaultEnabled: ["hot_spring", "pet_shard_tranquil", "pet_shard_corrupted", "raiju", "koi", "zen_gnome_crate", "spiked_mango"]
    }
  };

  return NextResponse.json({
    success: true,
    data: itemsCatalog,
    timestamp: new Date().toISOString(),
    version: "1.0.0"
  });
} 
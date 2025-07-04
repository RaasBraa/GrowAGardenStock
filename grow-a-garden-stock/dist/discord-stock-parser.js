"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseDiscordStockMessage = parseDiscordStockMessage;
exports.parseDiscordWeatherMessage = parseDiscordWeatherMessage;
// Utility to normalize item names to IDs (e.g., "Green Apple" -> "green_apple")
function normalizeId(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}
// Map category to refresh interval (minutes)
var REFRESH_INTERVALS = {
    seeds: 5,
    gear: 5,
    eggs: 30,
    cosmetics: 240,
    weather: 5,
};
// Parse a Discord message for stock data (seeds, gear, eggs, cosmetics)
function parseDiscordStockMessage(message, category) {
    // Check if this is a Cactus message (components-based) or Vulcan message (embed-based)
    var isCactus = message.components && message.components.length > 0 && message.components[0].type === 17;
    var isVulcan = message.embeds && message.embeds.length > 0;
    if (!isCactus && !isVulcan) {
        console.log('📝 Discord message does not contain embeds or components. Ignoring.');
        return null;
    }
    var items = [];
    if (isCactus) {
        // Parse Cactus format (components-based)
        items = parseCactusMessage(message, category);
    }
    else if (isVulcan) {
        // Parse Vulcan format (embed-based)
        items = parseVulcanMessage(message, category);
    }
    if (items.length === 0) {
        console.log("\uD83D\uDCDD No items found for category ".concat(category, " in Discord message"));
        return null;
    }
    var now = new Date().toISOString();
    var refreshInterval = REFRESH_INTERVALS[category];
    // Calculate next update (rounded up to next interval)
    var nowDate = new Date();
    var minutesSinceEpoch = Math.floor(nowDate.getTime() / (1000 * 60));
    var intervalsSinceEpoch = Math.floor(minutesSinceEpoch / refreshInterval);
    var nextScheduledMinute = (intervalsSinceEpoch + 1) * refreshInterval;
    var nextUpdate = new Date(nextScheduledMinute * 60 * 1000).toISOString();
    return {
        items: items,
        lastUpdated: now,
        nextUpdate: nextUpdate,
        refreshIntervalMinutes: refreshInterval,
    };
}
/* eslint-disable @typescript-eslint/no-unused-vars */
// Reason: Linter false positive on used parameter 'category' in parseCactusMessage. This file is reviewed for real unused vars.
// Parse Cactus format (components-based)
function parseCactusMessage(message, category) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    var mainComponent = message.components[0];
    if (!mainComponent.components)
        return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    var blocks = mainComponent.components;
    // Determine which blocks contain items for this category
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    var relevantBlocks = [];
    if (category === 'seeds') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        relevantBlocks = [blocks.find(function (b) { return b.type === 10 && b.content && b.content.match(/carrot|strawberry|tomato|blueberry|cauliflower|watermelon|green apple|avocado|banana|pineapple|kiwi|bell pepper|prickly pear|loquat|feijoa|sugar apple/i); })].filter(Boolean);
    }
    else if (category === 'gear') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        relevantBlocks = [blocks.find(function (b) { return b.type === 10 && b.content && b.content.match(/watering can|trowel|recall wrench|sprinkler|mirror|spray|tool|pot|cleaning spray|magnifying glass|favorite tool|harvest tool/i); })].filter(Boolean);
    }
    else if (category === 'eggs') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        relevantBlocks = blocks.filter(function (b) { return b.type === 10 && b.content && b.content.match(/egg/i); });
    }
    else if (category === 'cosmetics') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        relevantBlocks = blocks.filter(function (b) { return b.type === 10 && b.content && b.content.match(/crate|lantern|pad|tile|bench|pillar|table|lamp|sign|log|arbour|tv|shovel|trough|stack|umbrella|post|circle|path|stone|brick|gnome|mini|light|grey|brown|orange|large|medium|small/i); });
    }
    var items = [];
    for (var _i = 0, relevantBlocks_1 = relevantBlocks; _i < relevantBlocks_1.length; _i++) {
        var block = relevantBlocks_1[_i];
        var lines = block.content.split('\n');
        for (var _a = 0, lines_1 = lines; _a < lines_1.length; _a++) {
            var line = lines_1[_a];
            // Cactus format: "<:carrot:1377592178037096548> Carrot **x10**"
            var match = line.match(/>\s*([^*]+)\*\*x(\d+)\*\*/i);
            if (match) {
                var name_1 = match[1].trim();
                var quantity = parseInt(match[2], 10);
                items.push({ id: normalizeId(name_1), name: name_1, quantity: quantity });
            }
        }
    }
    return items;
}
// Parse Vulcan format (embed-based)
function parseVulcanMessage(message, category) {
    if (!message.embeds || message.embeds.length === 0)
        return [];
    var embed = message.embeds[0];
    if (!embed.fields || embed.fields.length < 2)
        return [];
    // Vulcan puts items in the second field (index 1)
    var itemsField = embed.fields[1];
    if (!itemsField || !itemsField.value)
        return [];
    var items = [];
    var lines = itemsField.value.split('\n');
    for (var _i = 0, lines_2 = lines; _i < lines_2.length; _i++) {
        var line = lines_2[_i];
        // Try multiple Vulcan formats:
        // 1. With emoji: "<:GreenApplee:1387913815789801652> **Green Apple** (1x)"
        // 2. Without emoji: "**Green Apple** (1x)"
        var match = line.match(/>\s*\*\*([^*]+)\*\*\s*\((\d+)x\)/i);
        if (!match) {
            // Try format without emoji
            match = line.match(/\*\*([^*]+)\*\*\s*\((\d+)x\)/i);
        }
        if (match) {
            var name_2 = match[1].trim();
            var quantity = parseInt(match[2], 10);
            items.push({ id: normalizeId(name_2), name: name_2, quantity: quantity });
        }
    }
    return items;
}
// Parse a Discord message for weather data
function parseDiscordWeatherMessage(message) {
    // Check if this is a Cactus message (components-based) or Vulcan message (embed-based)
    var isCactus = message.components && message.components.length > 0 && message.components[0].type === 17;
    var isVulcan = message.embeds && message.embeds.length > 0;
    if (!isCactus && !isVulcan) {
        return null;
    }
    if (isCactus) {
        return parseCactusWeatherMessage(message);
    }
    else if (isVulcan) {
        return parseVulcanWeatherMessage(message);
    }
    return null;
}
// Parse Cactus weather format (components-based)
function parseCactusWeatherMessage(message) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    var mainComponent = message.components[0];
    if (!mainComponent.components)
        return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    var blocks = mainComponent.components;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    var weatherBlock = blocks.find(function (b) { return b.type === 10 && b.content && b.content.match(/ends:/i); });
    if (!weatherBlock)
        return null;
    // Cactus weather format: "**<:JoshLei:1381473282687238186> TropicalRain**\n- Ends: <t:1751406630:R>"
    var lines = weatherBlock.content.split('\n');
    var current = '', endsAt = '';
    for (var _i = 0, lines_3 = lines; _i < lines_3.length; _i++) {
        var line = lines_3[_i];
        if (!current && line.match(/\*\*/)) {
            // First bold line is the weather name
            current = line.replace(/\*\*/g, '').replace(/<:[^>]+>/g, '').trim();
        }
        if (line.toLowerCase().includes('ends:')) {
            // Extract timestamp from <t:...:R>
            var match = line.match(/<t:(\d+):[a-zA-Z]>/);
            if (match) {
                endsAt = new Date(parseInt(match[1], 10) * 1000).toISOString();
            }
        }
    }
    if (!current || !endsAt)
        return null;
    return { current: current, endsAt: endsAt };
}
// Parse Vulcan weather format (embed-based)
function parseVulcanWeatherMessage(message) {
    if (!message.embeds || message.embeds.length === 0)
        return null;
    var embed = message.embeds[0];
    if (!embed.fields || embed.fields.length === 0)
        return null;
    // Vulcan weather is typically in the first field
    var weatherField = embed.fields[0];
    if (!weatherField || !weatherField.value)
        return null;
    // Vulcan weather format: "**WeatherType**\n- Ends: <t:timestamp:R>"
    var lines = weatherField.value.split('\n');
    var current = '', endsAt = '';
    for (var _i = 0, lines_4 = lines; _i < lines_4.length; _i++) {
        var line = lines_4[_i];
        if (!current && line.match(/\*\*/)) {
            // First bold line is the weather name
            current = line.replace(/\*\*/g, '').trim();
        }
        if (line.toLowerCase().includes('ends:')) {
            // Extract timestamp from <t:...:R>
            var match = line.match(/<t:(\d+):[a-zA-Z]>/);
            if (match) {
                endsAt = new Date(parseInt(match[1], 10) * 1000).toISOString();
            }
        }
    }
    if (!current || !endsAt)
        return null;
    return { current: current, endsAt: endsAt };
}

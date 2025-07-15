# Notification API Endpoints Documentation

## Overview
This document describes all notification-related API endpoints after migrating from Expo to OneSignal. All endpoints maintain backward compatibility while adding OneSignal Player ID support.

## Base URL
```
http://localhost:3000/api
```

---

## 1. Register Push Token
**Endpoint:** `POST /api/register-push-token`

**Purpose:** Register a device for push notifications using OneSignal Player ID

### Request Body
```json
{
  "token": "device_identifier_or_legacy_token",
  "onesignal_player_id": "12345678-1234-1234-1234-123456789abc",
  "device_type": "ios|android",
  "app_version": "1.0.0",
  "preferences": {
    "Carrot": true,
    "Strawberry": false,
    "Weather Alerts": true,
    "Travelling Merchant": true,
    "Events": false
  }
}
```

### Response
```json
{
  "success": true,
  "message": "Device registered successfully",
  "player_id": "12345678-1234-1234-1234-123456789abc"
}
```

### Example
```javascript
const response = await fetch('/api/register-push-token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    token: "device_123",
    onesignal_player_id: "12345678-1234-1234-1234-123456789abc",
    device_type: "ios",
    app_version: "1.0.0",
    preferences: {
      "Carrot": true,
      "Weather Alerts": true
    }
  })
});
```

---

## 2. Unregister Push Token
**Endpoint:** `POST /api/unregister-push-token`

**Purpose:** Remove a device from push notifications

### Request Body
```json
{
  "token": "device_identifier_or_legacy_token",
  "onesignal_player_id": "12345678-1234-1234-1234-123456789abc"
}
```

### Response
```json
{
  "success": true,
  "message": "Device unregistered successfully"
}
```

### Example
```javascript
const response = await fetch('/api/unregister-push-token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    token: "device_123",
    onesignal_player_id: "12345678-1234-1234-1234-123456789abc"
  })
});
```

---

## 3. Update Push Preferences
**Endpoint:** `POST /api/update-push-preferences`

**Purpose:** Update notification preferences for a specific device

### Request Body
```json
{
  "token": "device_identifier_or_legacy_token",
  "onesignal_player_id": "12345678-1234-1234-1234-123456789abc",
  "preferences": {
    "Carrot": true,
    "Strawberry": false,
    "Weather Alerts": true,
    "Travelling Merchant": true,
    "Events": false
  }
}
```

### Response
```json
{
  "success": true,
  "message": "Preferences updated successfully",
  "updated_preferences": {
    "Carrot": true,
    "Strawberry": false,
    "Weather Alerts": true,
    "Travelling Merchant": true,
    "Events": false
  }
}
```

### Example
```javascript
const response = await fetch('/api/update-push-preferences', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    token: "device_123",
    onesignal_player_id: "12345678-1234-1234-1234-123456789abc",
    preferences: {
      "Carrot": true,
      "Weather Alerts": true
    }
  })
});
```

---

## 4. Get Push Tokens (Statistics)
**Endpoint:** `GET /api/push-tokens`

**Purpose:** Get statistics about registered devices and tokens

### Response
```json
{
  "total_tokens": 150,
  "active_tokens": 142,
  "inactive_tokens": 8,
  "device_types": {
    "ios": 85,
    "android": 65
  },
  "preference_stats": {
    "Carrot": 120,
    "Weather Alerts": 95,
    "Travelling Merchant": 88
  },
  "recent_activity": {
    "last_24h": 15,
    "last_7d": 45
  }
}
```

### Example
```javascript
const response = await fetch('/api/push-tokens');
const stats = await response.json();
console.log(`Total devices: ${stats.total_tokens}`);
```

---

## 5. Get Available Items
**Endpoint:** `GET /api/available-items`

**Purpose:** Get list of all items available for notification preferences

### Response
```json
{
  "seeds": [
    "Carrot", "Strawberry", "Blueberry", "Tomato", "Cauliflower", 
    "Corn", "Watermelon", "Green Apple", "Avocado", "Banana", 
    "Pineapple", "Kiwi", "Bell Pepper", "Prickly Pear", "Loquat", 
    "Feijoa", "Sugar Apple", "Giant Pinecone"
  ],
  "gear": [
    "Watering Can", "Trowel", "Recall Wrench", "Basic Sprinkler", 
    "Advanced Sprinkler", "Godly Sprinkler", "Tanning Mirror", 
    "Magnifying Glass", "Master Sprinkler", "Cleaning Spray",
    "Favorite Tool", "Harvest Tool", "Friendship Pot", 
    "Medium Toy", "Medium Treat", "Levelup Lollipop"
  ],
  "eggs": [
    "Common Egg", "Uncommon Egg", "Rare Egg", "Legendary Egg", 
    "Mythical Egg", "Bug Egg", "Common Summer Egg", 
    "Rare Summer Egg", "Paradise Egg"
  ],
  "weather": [
    "Weather Alerts"
  ],
  "categories": [
    "Seeds", "Gear", "Eggs", "Weather", "Travelling Merchant", "Events"
  ]
}
```

### Example
```javascript
const response = await fetch('/api/available-items');
const items = await response.json();
console.log('Available seeds:', items.seeds);
```

---

## 6. Get Stock Data
**Endpoint:** `GET /api/stock`

**Purpose:** Get current stock data for all items

### Response
```json
{
  "seeds": [
    {
      "name": "Carrot",
      "quantity": 5,
      "last_updated": "2024-01-15T10:30:00Z",
      "source": "cactus"
    }
  ],
  "gear": [
    {
      "name": "Watering Can",
      "quantity": 3,
      "last_updated": "2024-01-15T10:30:00Z",
      "source": "cactus"
    }
  ],
  "eggs": [
    {
      "name": "Common Egg",
      "quantity": 10,
      "last_updated": "2024-01-15T10:30:00Z",
      "source": "cactus"
    }
  ],
  "weather": {
    "current": "Sunny",
    "last_updated": "2024-01-15T10:30:00Z"
  },
  "travelling_merchant": {
    "active": true,
    "items": ["Rare Egg", "Godly Sprinkler"],
    "last_updated": "2024-01-15T10:30:00Z"
  }
}
```

### Example
```javascript
const response = await fetch('/api/stock');
const stock = await response.json();
console.log('Current seeds:', stock.seeds);
```

---

## 7. Get Item Info
**Endpoint:** `GET /api/item-info/[itemId]`

**Purpose:** Get detailed information about a specific item

### Parameters
- `itemId`: The name of the item (e.g., "Carrot", "Watering Can")

### Response
```json
{
  "name": "Carrot",
  "category": "seeds",
  "current_quantity": 5,
  "last_updated": "2024-01-15T10:30:00Z",
  "source": "cactus",
  "notification_count": 120,
  "rarity": "common"
}
```

### Example
```javascript
const response = await fetch('/api/item-info/Carrot');
const itemInfo = await response.json();
console.log(`${itemInfo.name}: ${itemInfo.current_quantity} in stock`);
```

---

## Migration Notes

### From Expo to OneSignal
- **Old**: Used Expo push tokens (`ExponentPushToken[...]`)
- **New**: Uses OneSignal Player IDs (`12345678-1234-1234-1234-123456789abc`)

### Backward Compatibility
- All endpoints still accept the `token` field for legacy support
- The `onesignal_player_id` field is now required for new registrations
- Existing Expo tokens will continue to work during migration

### Mobile App Changes Required
1. **Install OneSignal SDK**
2. **Initialize with App ID**: `7a3f0ef9-af93-4481-93e1-375183500d50`
3. **Get Player ID**: `OneSignal.getPlayerId()`
4. **Send Player ID**: Include `onesignal_player_id` in all API calls

### Error Responses
All endpoints return consistent error formats:
```json
{
  "success": false,
  "error": "Error description",
  "code": "ERROR_CODE"
}
```

Common error codes:
- `MISSING_PLAYER_ID`: OneSignal Player ID is required
- `INVALID_PREFERENCES`: Invalid preference format
- `TOKEN_NOT_FOUND`: Device not registered
- `ONESIGNAL_ERROR`: OneSignal API error

---

## Testing Endpoints

### Test Registration
```bash
curl -X POST http://localhost:3000/api/register-push-token \
  -H "Content-Type: application/json" \
  -d '{
    "token": "test_device_123",
    "onesignal_player_id": "12345678-1234-1234-1234-123456789abc",
    "device_type": "ios",
    "preferences": {"Carrot": true, "Weather Alerts": true}
  }'
```

### Test Statistics
```bash
curl http://localhost:3000/api/push-tokens
```

### Test Available Items
```bash
curl http://localhost:3000/api/available-items
``` 
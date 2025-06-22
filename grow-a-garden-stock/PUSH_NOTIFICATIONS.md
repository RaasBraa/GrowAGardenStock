# Enhanced Push Notification System

This document describes the robust and maintainable push notification system for the Grow A Garden Stock Tracker.

## 🚀 Features

### Core Functionality
- **Rare Item Alerts**: Instant notifications when rare seeds, gear, or eggs appear in stock
- **Stock Updates**: General notifications when new items are available
- **Weather Alerts**: Notifications for special weather events that affect gameplay
- **Token Management**: Automatic cleanup of expired/invalid tokens
- **Rate Limiting**: Respects Expo's API limits with intelligent batching
- **Retry Logic**: Automatic retry with exponential backoff for failed deliveries
- **Error Handling**: Comprehensive error logging and token cleanup

### Enhanced Features
- **Device Metadata**: Track device type, app version, and registration details
- **Token Statistics**: Monitor active tokens, expired tokens, and delivery rates
- **Bulk Operations**: Clean up expired or inactive tokens in bulk
- **Rich Notifications**: Enhanced message content with emojis, categories, and badges

## 📱 API Endpoints

### Register Push Token
```http
POST /api/register-push-token
Content-Type: application/json

{
  "token": "ExponentPushToken[...]",
  "device_type": "ios" | "android",
  "app_version": "1.0.0"
}
```

**Response:**
```json
{
  "message": "Token registered successfully",
  "action": "registered",
  "totalTokens": 42
}
```

### Unregister Push Token
```http
DELETE /api/unregister-push-token
Content-Type: application/json

{
  "token": "ExponentPushToken[...]"
}
```

**Response:**
```json
{
  "message": "Token unregistered successfully",
  "action": "unregistered",
  "totalTokens": 41,
  "removedToken": {
    "created_at": "2024-01-15T10:30:00.000Z",
    "device_type": "ios",
    "app_version": "1.0.0"
  }
}
```

### Token Management
```http
GET /api/push-tokens?include_tokens=true&limit=50&offset=0
```

**Response:**
```json
{
  "stats": {
    "total": 42,
    "active": 38,
    "expired": 4,
    "lastCleanup": "2024-01-15T10:30:00.000Z"
  },
  "tokens": [
    {
      "id": "ExponentPushToken[...",
      "created_at": "2024-01-15T10:30:00.000Z",
      "last_used": "2024-01-15T12:45:00.000Z",
      "is_active": true,
      "device_type": "ios",
      "app_version": "1.0.0",
      "ip_address": "192.168.1.100"
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 42,
    "has_more": false
  }
}
```

### Bulk Cleanup
```http
DELETE /api/push-tokens?action=cleanup_expired
```

**Actions:**
- `cleanup_expired`: Remove tokens not used in 30 days
- `cleanup_inactive`: Remove inactive tokens
- `cleanup_all`: Remove all tokens (use with caution!)

## 🔧 Configuration

### Environment Variables
```bash
# Required for Expo push notifications
EXPO_ACCESS_TOKEN=your_expo_access_token

# Optional: Customize notification behavior
RATE_LIMIT_DELAY=1000          # Milliseconds between batches
TOKEN_EXPIRY_DAYS=30          # Days before token cleanup
MAX_RETRIES=3                 # Maximum retry attempts
```

### Rare Item Configuration
Rare items are defined in `src/lib/discord-listener.ts`:

```typescript
const RARE_ITEMS = {
  seeds: [
    'Strawberry', 'Blueberry', 'Raspberry', 'Blackberry', 'Golden Seed',
    'Diamond Seed', 'Emerald Seed', 'Ruby Seed', 'Sapphire Seed', 'Rainbow Seed'
  ],
  gear: [
    'Harvest Tool', 'Watering Can', 'Fertilizer', 'Golden Shovel', 'Diamond Pickaxe',
    'Legendary Scythe', 'Mythical Rake', 'Epic Hoe', 'Rare Trowel'
  ],
  eggs: [
    'Uncommon Egg', 'Rare Egg', 'Epic Egg', 'Legendary Egg', 'Mythical Egg',
    'Golden Egg', 'Diamond Egg', 'Rainbow Egg'
  ]
};
```

## 📊 Notification Types

### 1. Rare Item Alerts
- **Trigger**: When rare items appear in stock
- **Priority**: High
- **Content**: Item name, rarity level, quantity, channel
- **Channels**: `rare-items` (Android), `rare-items` (iOS)

### 2. Stock Updates
- **Trigger**: When new items are available in any category
- **Priority**: Default
- **Content**: Number of new items, category
- **Channels**: `stock-updates` (Android), `stock-updates` (iOS)

### 3. Weather Alerts
- **Trigger**: When special weather events occur
- **Priority**: High
- **Content**: Weather type, description, end time
- **Channels**: `weather-alerts` (Android), `weather-alerts` (iOS)

## 🛡️ Error Handling

### Token Validation
- Validates Expo push token format
- Checks token length and structure
- Removes invalid tokens automatically

### Delivery Failures
- **DeviceNotRegistered**: Token removed immediately
- **MessageTooBig**: Logged as error, token kept
- **MessageRateExceeded**: Logged as warning, retry with delay
- **InvalidCredentials**: Logged as error, check Expo configuration

### Retry Logic
- Automatic retry with exponential backoff
- Maximum 3 retry attempts
- Increasing delays between retries (1s, 2s, 3s)

## 📈 Monitoring & Analytics

### Token Statistics
```typescript
interface TokenStats {
  total: number;        // Total registered tokens
  active: number;       // Currently active tokens
  expired: number;      // Tokens eligible for cleanup
  lastCleanup: string;  // Last cleanup timestamp
}
```

### Delivery Metrics
- Success/failure rates per notification type
- Token cleanup statistics
- Rate limiting compliance

## 🧪 Testing

### Test Script
Run the enhanced notification test:
```bash
node test-enhanced-notifications.js
```

### Manual Testing
1. Register a test token via the API
2. Trigger notifications through Discord listener
3. Verify delivery and error handling
4. Check token cleanup functionality

## 🔄 Maintenance

### Automatic Cleanup
- Expired tokens (30+ days inactive) are automatically removed
- Failed delivery tokens are cleaned up immediately
- Cleanup runs before each notification batch

### Manual Cleanup
Use the bulk cleanup API endpoints for maintenance:
```bash
# Remove expired tokens
curl -X DELETE "http://localhost:3000/api/push-tokens?action=cleanup_expired"

# Remove inactive tokens
curl -X DELETE "http://localhost:3000/api/push-tokens?action=cleanup_inactive"

# Get statistics
curl "http://localhost:3000/api/push-tokens"
```

## 🚨 Troubleshooting

### Common Issues

1. **No notifications received**
   - Check token registration
   - Verify Expo configuration
   - Check device notification permissions

2. **High failure rates**
   - Review token cleanup logs
   - Check Expo service status
   - Verify rate limiting settings

3. **Memory usage**
   - Monitor token file size
   - Run periodic cleanup
   - Check for memory leaks in retry logic

### Log Analysis
Look for these log patterns:
- `✅ Notification sent successfully to X/Y devices`
- `🧹 Cleaned up X expired tokens`
- `🗑️ Removed X failed tokens`
- `❌ Push notification error: [details]`

## 📝 Best Practices

1. **Token Management**
   - Register tokens on app startup
   - Unregister tokens on app uninstall
   - Include device metadata for debugging

2. **Notification Content**
   - Keep titles under 40 characters
   - Use descriptive but concise bodies
   - Include relevant data for deep linking

3. **Rate Limiting**
   - Respect Expo's 100 requests/second limit
   - Use appropriate delays between batches
   - Monitor delivery success rates

4. **Error Handling**
   - Log all errors with context
   - Implement graceful degradation
   - Clean up invalid tokens promptly

## 🔮 Future Enhancements

- **A/B Testing**: Test different notification content
- **User Preferences**: Allow users to customize notification types
- **Analytics Dashboard**: Web interface for monitoring
- **Scheduled Notifications**: Send notifications at optimal times
- **Geographic Targeting**: Location-based notifications 
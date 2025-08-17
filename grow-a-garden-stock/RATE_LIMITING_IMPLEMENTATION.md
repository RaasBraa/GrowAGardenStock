# Rate Limiting Implementation for Preference Updates

## 🚀 **Overview**

This implementation adds rate limiting to prevent spam and abuse when users update their push notification preferences. Users can only update their preferences once every 30 seconds.

## ⚙️ **How It Works**

### **Database Rate Limiting (OneSignal Tokens)**
- Uses the existing `last_used` column in the `push_tokens` table
- New method: `database.canUpdatePreferences(token, minIntervalSeconds)`
- Returns: `{ canUpdate: boolean, secondsRemaining: number, lastUpdate: string }`

### **JSON File Rate Limiting (Expo Tokens)**
- Checks the `last_used` field in the JSON file
- Same 30-second interval logic
- Prevents rapid updates to the JSON file

## 🔧 **Configuration**

```typescript
// Rate limiting configuration
const PREFERENCES_UPDATE_RATE_LIMIT_SECONDS = 30; // Minimum seconds between preference updates
```

**Default Rate Limit:** 30 seconds between preference updates

## 📊 **API Response Examples**

### **Successful Update (200)**
```json
{
  "message": "OneSignal preferences updated successfully",
  "action": "updated",
  "storage": "database",
  "enabledItems": ["carrot", "romanesco"],
  "disabledItems": ["strawberry"]
}
```

### **Rate Limited (429)**
```json
{
  "error": "Rate limit exceeded",
  "message": "Please wait 25 seconds before updating preferences again",
  "secondsRemaining": 25,
  "lastUpdate": "2025-01-15T10:30:00.000Z",
  "retryAfter": "2025-01-15T10:30:25.000Z"
}
```

## 🗄️ **Database Changes**

### **New Method Added**
```typescript
async canUpdatePreferences(
  token: string, 
  minIntervalSeconds: number = 30
): Promise<{
  canUpdate: boolean;
  secondsRemaining: number;
  lastUpdate: string;
}>
```

### **Uses Existing Column**
- **`last_used`**: Already exists, tracks when preferences were last updated
- **No new columns needed**: Reuses existing timestamp field

## 🧪 **Testing**

### **Test Script**
```bash
node test-rate-limiting.js
```

### **Test Scenarios**
1. **First Update**: Should succeed (200)
2. **Immediate Second Update**: Should fail with rate limit (429)
3. **After 30 Seconds**: Should succeed again (200)

## 🚫 **Rate Limit Behavior**

- **First Request**: Always allowed
- **Subsequent Requests**: Blocked if within 30 seconds
- **Error Code**: HTTP 429 (Too Many Requests)
- **Response Includes**: 
  - Seconds remaining until next update
  - Last update timestamp
  - Retry-after timestamp

## 🔄 **Implementation Details**

### **OneSignal Tokens (Database)**
```typescript
// Check rate limiting first
const rateLimitCheck = await database.canUpdatePreferences(token, PREFERENCES_UPDATE_RATE_LIMIT_SECONDS);

if (!rateLimitCheck.canUpdate) {
  return NextResponse.json({
    error: 'Rate limit exceeded',
    message: `Please wait ${rateLimitCheck.secondsRemaining} seconds before updating preferences again`,
    secondsRemaining: rateLimitCheck.secondsRemaining,
    lastUpdate: rateLimitCheck.lastUpdate,
    retryAfter: new Date(Date.now() + (rateLimitCheck.secondsRemaining * 1000)).toISOString()
  }, { status: 429 });
}
```

### **Expo Tokens (JSON File)**
```typescript
// Check rate limiting for Expo tokens
const lastUpdate = new Date(tokenEntry.last_used);
const now = new Date();
const timeDiffSeconds = Math.floor((now.getTime() - lastUpdate.getTime()) / 1000);

if (timeDiffSeconds < PREFERENCES_UPDATE_RATE_LIMIT_SECONDS) {
  const secondsRemaining = PREFERENCES_UPDATE_RATE_LIMIT_SECONDS - timeDiffSeconds;
  return NextResponse.json({
    error: 'Rate limit exceeded',
    message: `Please wait ${secondsRemaining} seconds before updating preferences again`,
    secondsRemaining: secondsRemaining,
    lastUpdate: tokenEntry.last_used,
    retryAfter: new Date(Date.now() + (secondsRemaining * 1000)).toISOString()
  }, { status: 429 });
}
```

## 🎯 **Benefits**

1. **Prevents Spam**: Users can't rapidly change preferences
2. **Reduces Server Load**: Fewer unnecessary database updates
3. **Better User Experience**: Clear feedback on when they can update again
4. **Security**: Prevents potential abuse of the API
5. **No Database Changes**: Uses existing `last_used` column

## 🔧 **Customization**

### **Change Rate Limit**
```typescript
// In update-push-preferences/route.ts
const PREFERENCES_UPDATE_RATE_LIMIT_SECONDS = 60; // Change to 1 minute
```

### **Different Limits for Different Token Types**
```typescript
// You could implement different limits for different user types
const rateLimitSeconds = isPremiumUser ? 10 : 30; // Premium users: 10s, others: 30s
```

## 📱 **Mobile App Integration**

### **Handle Rate Limit Response**
```typescript
if (response.status === 429) {
  const rateLimitData = await response.json();
  const secondsRemaining = rateLimitData.secondsRemaining;
  
  // Show user-friendly message
  showMessage(`Please wait ${secondsRemaining} seconds before updating preferences again`);
  
  // Optionally disable update button temporarily
  disableUpdateButton(secondsRemaining * 1000);
}
```

### **Retry Logic**
```typescript
// Wait for the specified time before allowing retry
setTimeout(() => {
  enableUpdateButton();
  showMessage('You can now update your preferences again');
}, secondsRemaining * 1000);
```

## 🚀 **Deployment Notes**

1. **No Database Migration Required**: Uses existing `last_used` column
2. **Backward Compatible**: Existing tokens continue to work
3. **Configurable**: Easy to adjust rate limit via constant
4. **Tested**: Includes test script for verification

## 🔍 **Monitoring & Logging**

The system logs rate limit violations:
```typescript
console.log(`⚠️ Rate limit exceeded for token: ${token.substring(0, 20)}...`);
console.log(`   Seconds remaining: ${secondsRemaining}`);
```

This helps monitor abuse patterns and adjust limits if needed.

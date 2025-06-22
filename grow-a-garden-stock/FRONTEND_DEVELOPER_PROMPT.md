# Frontend Developer Prompt: Grow A Garden Stock Tracker

## 🎯 Project Overview

You are building a **React Native mobile app** for the Roblox game "Grow A Garden" that shows live in-game shop stock and sends push notifications for rare items. The backend has been significantly enhanced with a robust push notification system.

## 🏗️ Backend Architecture

### Core Components
- **Next.js API** serving stock data and managing push tokens
- **Discord Bot Listener** monitoring game channels for real-time updates
- **Enhanced Push Notification System** with Expo integration
- **Automatic data parsing** from Discord embeds

### Data Sources
The backend monitors 5 Discord channels:
- **Seeds** - Plant seeds and rare seeds
- **Gear** - Tools, watering cans, fertilizers
- **Eggs** - Pet eggs of various rarities
- **Cosmetics** - Character customization items
- **Weather** - Special weather events affecting gameplay

## 📱 API Endpoints

### Stock Data
```http
GET /api/stock
```
**Response:**
```json
{
  "seeds": [
    { "name": "Strawberry", "quantity": 15 },
    { "name": "Golden Seed", "quantity": 3 }
  ],
  "gear": [
    { "name": "Harvest Tool", "quantity": 8 },
    { "name": "Diamond Pickaxe", "quantity": 1 }
  ],
  "eggs": [
    { "name": "Uncommon Egg", "quantity": 12 },
    { "name": "Legendary Egg", "quantity": 2 }
  ],
  "cosmetics": [
    { "name": "Rainbow Hat", "quantity": 5 }
  ],
  "weather": {
    "current": "Rainy Weather",
    "ends": "<t:1750250434:R>"
  },
  "lastUpdated": "2024-01-15T12:30:00.000Z"
}
```

### Push Notification Registration
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
  "action": "registered" | "updated",
  "totalTokens": 42
}
```

### Push Notification Unregistration
```http
DELETE /api/unregister-push-token
Content-Type: application/json

{
  "token": "ExponentPushToken[...]"
}
```

### Token Management (Optional)
```http
GET /api/push-tokens?include_tokens=true&limit=50&offset=0
```

## 🔔 Push Notification System

### Notification Types

#### 1. Rare Item Alerts
- **Trigger**: When rare items appear in stock
- **Content**: Item name, rarity level, quantity, category
- **Priority**: High
- **Example**: "🌟 Rare Item Alert! Golden Seed (Legendary) is in stock! Quantity: 3"

#### 2. Stock Updates
- **Trigger**: When new items are available in any category
- **Content**: Number of new items, category
- **Priority**: Default
- **Example**: "📦 Stock Update: 15 new seeds items available!"

#### 3. Weather Alerts
- **Trigger**: When special weather events occur
- **Content**: Weather type, description, end time
- **Priority**: High
- **Example**: "⛈️ Weather Alert: Rainy Weather - Increases crop growth by 50%"

### Notification Data Structure
```typescript
interface NotificationData {
  itemName: string;
  rarity: string;
  quantity: number;
  type: 'rare_item_alert' | 'stock_update' | 'weather_alert';
  timestamp: string;
  channel?: string;
}
```

## 🎨 UI/UX Requirements

### Main App Structure
1. **Home Screen** - Overview of all stock categories
2. **Category Screens** - Detailed view of each category (Seeds, Gear, Eggs, Cosmetics)
3. **Weather Screen** - Current weather and effects
4. **Settings Screen** - Notification preferences and app info

### Stock Display
- **Card-based layout** for each item
- **Rarity indicators** (color-coded: Common, Rare, Epic, Legendary)
- **Quantity badges** showing stock levels
- **Last updated timestamp** for each category
- **Pull-to-refresh** functionality

### Notification Integration
- **Permission request** on first app launch
- **Token registration** on app startup
- **Token cleanup** on app uninstall
- **Notification settings** in app settings
- **Deep linking** to relevant screens when notifications are tapped

### Visual Design
- **Garden/plant theme** with green color palette
- **Modern, clean interface** with smooth animations
- **Dark mode support**
- **Accessibility features** (large text, high contrast)

## 🔧 Technical Requirements

### React Native Setup
```bash
npx create-expo-app GrowAGardenApp --template
npm install expo-notifications @react-native-async-storage/async-storage
```

### Required Dependencies
- `expo-notifications` - Push notification handling
- `@react-native-async-storage/async-storage` - Local storage
- `react-native-vector-icons` - Icons
- `react-native-elements` - UI components (optional)

### Push Notification Configuration

#### 1. App Configuration (`app.json`)
```json
{
  "expo": {
    "name": "Grow A Garden Stock",
    "slug": "grow-a-garden-stock",
    "version": "1.0.0",
    "platforms": ["ios", "android"],
    "notification": {
      "icon": "./assets/notification-icon.png",
      "color": "#4CAF50",
      "iosDisplayInForeground": true
    },
    "android": {
      "package": "com.yourcompany.growagardenstock",
      "googleServicesFile": "./google-services.json"
    },
    "ios": {
      "bundleIdentifier": "com.yourcompany.growagardenstock"
    }
  }
}
```

#### 2. Notification Setup
```typescript
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Request permissions and register token
async function registerForPushNotificationsAsync() {
  let token;
  
  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      alert('Failed to get push token for push notification!');
      return;
    }
    
    token = (await Notifications.getExpoPushTokenAsync({
      projectId: 'your-project-id'
    })).data;
  }
  
  return token;
}
```

#### 3. Token Registration
```typescript
async function registerTokenWithBackend(token: string) {
  try {
    const response = await fetch('https://your-backend.com/api/register-push-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token,
        device_type: Platform.OS,
        app_version: '1.0.0'
      }),
    });
    
    const result = await response.json();
    console.log('Token registered:', result);
  } catch (error) {
    console.error('Failed to register token:', error);
  }
}
```

### Data Fetching
```typescript
async function fetchStockData() {
  try {
    const response = await fetch('https://your-backend.com/api/stock');
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to fetch stock data:', error);
    return null;
  }
}
```

## 📱 Screen Implementations

### Home Screen
- **Grid layout** showing all categories
- **Stock count badges** on each category
- **Weather widget** at the top
- **Last updated** timestamp
- **Pull-to-refresh** functionality

### Category Screen
- **List of items** with rarity indicators
- **Search/filter** functionality
- **Sort options** (by rarity, quantity, name)
- **Item details** on tap

### Weather Screen
- **Current weather** display
- **Time remaining** countdown
- **Weather effects** description
- **Historical weather** (optional)

### Settings Screen
- **Notification preferences** (enable/disable by type)
- **App information** (version, about)
- **Token management** (debug info)
- **Theme selection** (light/dark)

## 🎯 Key Features to Implement

### 1. Real-time Updates
- **Background refresh** every 30 seconds
- **Push notification handling** for immediate updates
- **Offline support** with cached data

### 2. Notification Management
- **Permission handling** with user-friendly prompts
- **Token lifecycle management** (register/unregister)
- **Notification history** (optional)
- **Custom notification sounds** for different types

### 3. User Experience
- **Loading states** and error handling
- **Smooth animations** and transitions
- **Haptic feedback** for interactions
- **Accessibility** features

### 4. Performance
- **Image optimization** for item icons
- **Lazy loading** for large lists
- **Memory management** for cached data
- **Battery optimization** for background updates

## 🔗 Integration Points

### Backend URL
Replace `https://your-backend.com` with your actual backend URL in all API calls.

### Environment Configuration
```typescript
const API_BASE_URL = __DEV__ 
  ? 'http://localhost:3000' 
  : 'https://your-production-backend.com';
```

### Error Handling
- **Network errors** with retry logic
- **API errors** with user-friendly messages
- **Token validation** errors
- **Permission denied** handling

## 📋 Development Checklist

- [ ] Set up Expo project with notifications
- [ ] Implement token registration/unregistration
- [ ] Create main navigation structure
- [ ] Build stock data fetching and display
- [ ] Implement push notification handling
- [ ] Add notification settings
- [ ] Create category-specific screens
- [ ] Add weather display
- [ ] Implement search and filtering
- [ ] Add offline support
- [ ] Test on both iOS and Android
- [ ] Add accessibility features
- [ ] Optimize performance
- [ ] Add error handling and loading states

## 🚀 Deployment Notes

### Expo Build
```bash
eas build --platform all
```

### App Store Deployment
- Configure app store metadata
- Set up app store connect
- Submit for review

### Testing
- Test on physical devices (push notifications don't work on simulators)
- Test notification permissions flow
- Test offline functionality
- Test deep linking from notifications

## 📞 Support

The backend is production-ready with:
- ✅ Robust error handling
- ✅ Automatic token cleanup
- ✅ Rate limiting and retry logic
- ✅ Comprehensive logging
- ✅ Monitoring and statistics

The push notification system is fully integrated and will automatically send notifications when rare items appear in the game! 
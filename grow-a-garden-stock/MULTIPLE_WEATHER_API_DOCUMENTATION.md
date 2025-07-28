# Multiple Weather Support - API Documentation

## Overview

The Grow A Garden Stock API now supports **multiple simultaneous weather events**. Users can receive notifications for all active weather events at the same time, and the API returns data for all currently active weather conditions.

## Weather Data Structure

### API Response Format

The `/api/stock` endpoint now returns weather data in this format with backward compatibility:

```json
{
  "weather": {
    "activeWeather": [
      {
        "current": "Sunny",
        "endsAt": "2025-01-27T12:30:00.000Z"
      },
      {
        "current": "Rain",
        "endsAt": "2025-01-27T14:45:00.000Z"
      },
      {
        "current": "Storm", 
        "endsAt": "2025-01-27T13:15:00.000Z"
      }
    ],
    "lastUpdated": "2025-01-27T12:00:00.000Z",
    "current": "Sunny",
    "endsAt": "2025-01-27T12:30:00.000Z"
  }
}
```

### Backward Compatibility

The API maintains backward compatibility by including both formats:
- **New apps**: Use `weather.activeWeather[]` array for multiple weather support
- **Old apps**: Continue using `weather.current` and `weather.endsAt` (shows first active weather)

### Key Changes

- **Before**: Single weather object with `current` and `endsAt`
- **After**: Array of weather objects in `activeWeather` field
- **Multiple Events**: Can have 0, 1, 2, 3+ active weather events simultaneously

## Notification Behavior

### Multiple Weather Notifications

When multiple weather events are active, users will receive **separate notifications** for each event:

```
🌤️ Weather Alert: Sunny
Ends in 45 minutes

🌤️ Weather Alert: Rain
Ends in 2m 45s

🌤️ Weather Alert: Storm
Ends in 1h 30m
```

### Time Format Examples

- **Less than 10 minutes**: `"Ends in 2m 45s"` or `"Ends in 30 seconds"`
- **10-59 minutes**: `"Ends in 45 minutes"`
- **More than 1 hour**: `"Ends in 2h 15m"`
- **Ending now**: `"Ends now!"`

## App Integration Guide

### 1. Update Weather Display

**Legacy Apps (Backward Compatible):**
```typescript
const weather = stockData.weather;
if (weather && weather.current) {
  displayWeather(weather.current, weather.endsAt);
}
```

**New Apps (Multiple Weather Support):**
```typescript
const weatherData = stockData.weather;
if (weatherData && weatherData.activeWeather.length > 0) {
  // Display all active weather events
  weatherData.activeWeather.forEach(weather => {
    displayWeather(weather.current, weather.endsAt);
  });
}
```

**Hybrid Approach (Recommended for Migration):**
```typescript
const weatherData = stockData.weather;
if (weatherData) {
  if (weatherData.activeWeather && weatherData.activeWeather.length > 0) {
    // New multiple weather format
    weatherData.activeWeather.forEach(weather => {
      displayWeather(weather.current, weather.endsAt);
    });
  } else if (weatherData.current) {
    // Fallback to legacy format
    displayWeather(weatherData.current, weatherData.endsAt);
  }
}
```

### 2. Weather List UI

```typescript
function WeatherList({ weatherData }) {
  if (!weatherData || weatherData.activeWeather.length === 0) {
    return <div>No active weather</div>;
  }

  return (
    <div className="weather-list">
      {weatherData.activeWeather.map((weather, index) => (
        <WeatherCard 
          key={`${weather.current}-${index}`}
          name={weather.current}
          endsAt={weather.endsAt}
        />
      ))}
    </div>
  );
}
```

### 3. Time Remaining Calculation

```typescript
function calculateTimeRemaining(endsAt: string): string {
  const now = new Date();
  const endTime = new Date(endsAt);
  const timeRemainingMs = endTime.getTime() - now.getTime();
  const timeRemainingSeconds = Math.max(0, Math.floor(timeRemainingMs / 1000));
  const timeRemainingMinutes = Math.floor(timeRemainingSeconds / 60);
  const remainingSeconds = timeRemainingSeconds % 60;
  
  if (timeRemainingSeconds === 0) {
    return "Ends now!";
  } else if (timeRemainingMinutes < 10) {
    // Include seconds for less than 10 minutes
    if (timeRemainingMinutes === 0) {
      return `Ends in ${remainingSeconds} seconds`;
    } else if (remainingSeconds === 0) {
      return `Ends in ${timeRemainingMinutes} minutes`;
    } else {
      return `Ends in ${timeRemainingMinutes}m ${remainingSeconds}s`;
    }
  } else if (timeRemainingMinutes < 60) {
    return `Ends in ${timeRemainingMinutes} minutes`;
  } else {
    const hours = Math.floor(timeRemainingMinutes / 60);
    const minutes = timeRemainingMinutes % 60;
    return `Ends in ${hours}h ${minutes}m`;
  }
}
```

### 4. Weather Card Component

```typescript
function WeatherCard({ name, endsAt }) {
  const timeRemaining = calculateTimeRemaining(endsAt);
  
  return (
    <div className="weather-card">
      <div className="weather-icon">🌤️</div>
      <div className="weather-name">{name}</div>
      <div className="weather-time">{timeRemaining}</div>
    </div>
  );
}
```

## Backward Compatibility

### API Response Compatibility

The API maintains backward compatibility:

- **Old apps**: Will still work (weather data is still present)
- **New apps**: Can access the full `activeWeather` array
- **No breaking changes**: Existing single-weather logic continues to work

### Migration Strategy

**Phase 1 (Current)**: 
- Support both single and multiple weather display
- Show multiple weather events if available
- Fall back to single weather for older data

**Phase 2 (Future)**:
- Update UI to always expect multiple weather format
- Remove single weather fallback code

## Weather Event Types

### Available Weather Events

The system supports 39 different weather types:

**Basic Weather:**
- Rain, Heatwave, Windy, Frost, Sandstorm

**Special Events:**
- SummerHarvest, NightEvent, BloodMoonEvent, MeteorShower

**Fun Events:**
- Disco, DJJhai, Blackhole, Volcano, UnderTheSea, AlienInvasion

**Zen Events:**
- ZenAura, CorruptZenAura

**TK Events:**
- TK_RouteRunner, TK_MoneyRain, TK_LightningStorm

### Weather Duration

- **Short Events**: 60-90 seconds (Blackhole, Volcano, etc.)
- **Standard Events**: 180-210 seconds (Rain, Heatwave, etc.)
- **Long Events**: 600 seconds (SummerHarvest, NightEvent, etc.)

## Notification Preferences

### Weather Notifications

Users can enable/disable weather notifications via:

```json
{
  "preferences": {
    "Weather": true
  }
}
```

- **Single Toggle**: One preference controls all weather notifications
- **All or Nothing**: Users receive notifications for ALL active weather events
- **No Individual Control**: Cannot disable specific weather types

## Error Handling

### Empty Weather Data

```typescript
// Handle case when no weather data exists
if (!stockData.weather) {
  return <div>No weather data available</div>;
}

// Handle case when no active weather events
if (stockData.weather.activeWeather.length === 0) {
  return <div>No active weather events</div>;
}
```

### Invalid Weather Data

```typescript
// Validate weather data structure
function validateWeatherData(weatherData) {
  if (!weatherData || !Array.isArray(weatherData.activeWeather)) {
    console.warn('Invalid weather data structure');
    return false;
  }
  return true;
}
```

## Performance Considerations

### API Response Size

- **Multiple weather events** increase response size
- **Typical response**: 1-3 active weather events
- **Maximum observed**: 5+ simultaneous events (rare)

### Caching Strategy

```typescript
// Cache weather data with appropriate TTL
const weatherCache = {
  data: null,
  lastUpdated: null,
  ttl: 5 * 60 * 1000 // 5 minutes
};

function getWeatherData() {
  const now = Date.now();
  if (weatherCache.data && (now - weatherCache.lastUpdated) < weatherCache.ttl) {
    return weatherCache.data;
  }
  // Fetch fresh data
}
```

## Testing Multiple Weather

### Test Scenarios

1. **Single Weather Event**
   - Verify single notification
   - Check time formatting

2. **Multiple Weather Events**
   - Verify multiple notifications
   - Check order and timing

3. **No Active Weather**
   - Verify no notifications sent
   - Check API returns empty array

4. **Weather Event Ending**
   - Verify notification when weather ends
   - Check removal from active list

### Test Data

```json
{
  "weather": {
    "activeWeather": [
      {
        "current": "Sunny",
        "endsAt": "2025-01-27T12:30:00.000Z"
      },
      {
        "current": "Rain",
        "endsAt": "2025-01-27T14:45:00.000Z"
      }
    ],
    "lastUpdated": "2025-01-27T12:00:00.000Z"
  }
}
```

## Summary

### Key Benefits

1. **Multiple Notifications**: Users get notified for all active weather events
2. **Rich UI**: Apps can display multiple weather conditions simultaneously
3. **Better UX**: Users see all relevant weather information at once
4. **Future-Proof**: Supports complex weather scenarios

### Implementation Checklist

- [ ] Update weather display to handle array of events
- [ ] Implement time remaining calculation
- [ ] Add weather card component for multiple events
- [ ] Test with single and multiple weather scenarios
- [ ] Handle empty weather data gracefully
- [ ] Update notification handling for multiple events

The multiple weather support provides a much richer experience for users, allowing them to see and be notified about all active weather conditions in the game! 🌤️ 
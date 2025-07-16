import { sendItemNotification as sendOneSignalItemNotification } from './onesignal-notifications-db';
import { sendItemNotification as sendExpoItemNotification } from './pushNotifications';

// Environment configuration
const USE_ONESIGNAL = process.env.USE_ONESIGNAL === 'true';
const ENABLE_DUAL_NOTIFICATIONS = process.env.ENABLE_DUAL_NOTIFICATIONS === 'true';

interface NotificationConfig {
  useOneSignal: boolean;
  useExpo: boolean;
  enableDual: boolean;
}

function getNotificationConfig(): NotificationConfig {
  return {
    useOneSignal: USE_ONESIGNAL,
    useExpo: !USE_ONESIGNAL || ENABLE_DUAL_NOTIFICATIONS,
    enableDual: ENABLE_DUAL_NOTIFICATIONS
  };
}

export async function sendItemNotification(
  itemName: string, 
  quantity: number, 
  category: string,
  deviceType?: 'expo' | 'onesignal' | 'auto'
) {
  const config = getNotificationConfig();
  
  console.log(`📤 Sending ${itemName} notification (OneSignal: ${config.useOneSignal}, Expo: ${config.useExpo})`);

  const promises: Promise<void>[] = [];

  // Send OneSignal notifications
  if (config.useOneSignal && (deviceType !== 'expo')) {
    promises.push(
      sendOneSignalItemNotification(itemName, quantity, category)
        .then(() => console.log(`✅ OneSignal notification sent for ${itemName}`))
        .catch(error => console.error(`❌ OneSignal notification failed for ${itemName}:`, error))
    );
  }

  // Send Expo notifications
  if (config.useExpo && (deviceType !== 'onesignal')) {
    promises.push(
      sendExpoItemNotification(itemName, quantity, category)
        .then(() => console.log(`✅ Expo notification sent for ${itemName}`))
        .catch(error => console.error(`❌ Expo notification failed for ${itemName}:`, error))
    );
  }

  // Wait for all notifications to complete
  await Promise.allSettled(promises);
}

export async function sendWeatherAlertNotification(
  weatherType: string, 
  description: string,
  deviceType?: 'expo' | 'onesignal' | 'auto'
) {
  const config = getNotificationConfig();
  
  console.log(`🌤️ Sending weather alert (OneSignal: ${config.useOneSignal}, Expo: ${config.useExpo})`);

  const promises: Promise<void>[] = [];

  // Send OneSignal notifications
  if (config.useOneSignal && (deviceType !== 'expo')) {
    promises.push(
      import('./onesignal-notifications-db').then(({ sendWeatherAlertNotification }) => 
        sendWeatherAlertNotification(weatherType, description)
      ).then(() => console.log(`✅ OneSignal weather alert sent`))
      .catch(error => console.error(`❌ OneSignal weather alert failed:`, error))
    );
  }

  // Send Expo notifications
  if (config.useExpo && (deviceType !== 'onesignal')) {
    promises.push(
      import('./pushNotifications').then(({ sendWeatherAlertNotification }) => 
        sendWeatherAlertNotification(weatherType, description)
      ).then(() => console.log(`✅ Expo weather alert sent`))
      .catch(error => console.error(`❌ Expo weather alert failed:`, error))
    );
  }

  await Promise.allSettled(promises);
}

export async function sendCategoryNotification(
  categoryName: string, 
  categoryDisplayName: string, 
  description: string,
  deviceType?: 'expo' | 'onesignal' | 'auto'
) {
  const config = getNotificationConfig();
  
  console.log(`📦 Sending category notification (OneSignal: ${config.useOneSignal}, Expo: ${config.useExpo})`);

  const promises: Promise<void>[] = [];

  // Send OneSignal notifications
  if (config.useOneSignal && (deviceType !== 'expo')) {
    promises.push(
      import('./onesignal-notifications-db').then(({ sendCategoryNotification }) => 
        sendCategoryNotification(categoryName, categoryDisplayName, description)
      ).then(() => console.log(`✅ OneSignal category notification sent`))
      .catch(error => console.error(`❌ OneSignal category notification failed:`, error))
    );
  }

  // Send Expo notifications
  if (config.useExpo && (deviceType !== 'onesignal')) {
    promises.push(
      import('./pushNotifications').then(({ sendCategoryNotification }) => 
        sendCategoryNotification(categoryName, categoryDisplayName, description)
      ).then(() => console.log(`✅ Expo category notification sent`))
      .catch(error => console.error(`❌ Expo category notification failed:`, error))
    );
  }

  await Promise.allSettled(promises);
}

// Utility function to check which system to use based on token type
export function getDeviceType(token: string): 'expo' | 'onesignal' | 'unknown' {
  if (token.startsWith('ExponentPushToken[')) {
    return 'expo';
  } else if (token.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)) {
    return 'onesignal';
  }
  return 'unknown';
}

// Migration helper
export function shouldMigrateToOneSignal(token: string): boolean {
  const deviceType = getDeviceType(token);
  return deviceType === 'expo' && USE_ONESIGNAL;
} 
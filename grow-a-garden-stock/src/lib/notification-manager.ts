import { 
  sendItemNotification as sendOneSignalItemNotification,
  sendWeatherAlertNotification as sendOneSignalWeatherNotification,
  sendCategoryNotification as sendOneSignalCategoryNotification
} from './onesignal-notifications-db.js';

export async function sendItemNotification(
  itemName: string, 
  quantity: number, 
  category: string
) {
  console.log(`📤 Sending ${itemName} notification via OneSignal`);
  
  try {
    await sendOneSignalItemNotification(itemName, quantity, category);
    console.log(`✅ OneSignal notification sent for ${itemName}`);
  } catch (error) {
    console.error(`❌ OneSignal notification failed for ${itemName}:`, error);
  }
}

export async function sendWeatherAlertNotification(
  weatherType: string, 
  description: string
) {
  console.log(`🌤️ Sending weather alert via OneSignal`);
  
  try {
    await sendOneSignalWeatherNotification(weatherType, description);
    console.log(`✅ OneSignal weather alert sent`);
  } catch (error) {
    console.error(`❌ OneSignal weather alert failed:`, error);
  }
}

export async function sendCategoryNotification(
  categoryName: string, 
  categoryDisplayName: string, 
  description: string
) {
  console.log(`📦 Sending category notification via OneSignal`);
  
  try {
    await sendOneSignalCategoryNotification(categoryName, categoryDisplayName, description);
    console.log(`✅ OneSignal category notification sent`);
  } catch (error) {
    console.error(`❌ OneSignal category notification failed:`, error);
  }
} 
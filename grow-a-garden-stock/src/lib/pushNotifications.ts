import { Expo, ExpoPushMessage, ExpoPushReceipt } from 'expo-server-sdk';
import * as fs from 'fs';
import * as path from 'path';

const TOKENS_PATH = path.resolve(process.cwd(), 'push-tokens.json');
const expo = new Expo();

interface PushTokenEntry {
  token: string;
  created_at: string;
  last_used: string;
  is_active: boolean;
}

function loadTokens(): PushTokenEntry[] {
  if (!fs.existsSync(TOKENS_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf-8')) as PushTokenEntry[];
  } catch {
    return [];
  }
}

function saveTokens(tokens: PushTokenEntry[]) {
  fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2));
}

export async function sendRareItemNotification(itemName: string, rarity: string, quantity: number) {
  const tokens = loadTokens().filter(t => t.is_active);
  if (tokens.length === 0) return;

  const messages: ExpoPushMessage[] = tokens.map(t => ({
    to: t.token,
    sound: 'default',
    title: 'Rare Item Alert!',
    body: `${itemName} is in stock!`,
    data: { itemName, rarity, quantity },
    priority: 'high',
  }));

  const chunks = expo.chunkPushNotifications(messages);
  const failedTokens: string[] = [];

  for (const chunk of chunks) {
    try {
      const receipts = await expo.sendPushNotificationsAsync(chunk);
      receipts.forEach((receipt: ExpoPushReceipt, idx: number) => {
        if (receipt.status === 'error') {
          // The 'to' property is not on the receipt, so we get it from the original chunk
          const token = (chunk as ExpoPushMessage[])[idx]?.to;
          if (token) {
            failedTokens.push(token as string);
            console.error(`Push notification error for token ${token}:`, receipt.details || receipt.message);
          }
        }
      });
    } catch (error) {
      console.error('Push notification error:', error);
    }
  }

  // Remove failed tokens
  if (failedTokens.length > 0) {
    const allTokens = loadTokens();
    const activeTokens = allTokens.filter(t => !failedTokens.includes(t.token));
    saveTokens(activeTokens);
  }
} 
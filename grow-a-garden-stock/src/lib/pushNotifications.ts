// @ts-expect-error: expo-server-sdk has no types
import { Expo } from 'expo-server-sdk';
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
  let tokens = loadTokens().filter(t => t.is_active);
  if (tokens.length === 0) return;

  const messages = tokens.map(t => ({
    to: t.token,
    sound: 'default',
    title: 'Rare Item Alert!',
    body: `${itemName} is in stock!`,
    data: { itemName, rarity, quantity },
    priority: 'high',
  }));

  const chunks = expo.chunkPushNotifications(messages);
  const failedTokens: string[] = [];

  type ExpoPushReceipt = { status: string; details?: any; message?: string };

  for (const chunk of chunks) {
    try {
      const receipts = await expo.sendPushNotificationsAsync(chunk);
      receipts.forEach((receipt: ExpoPushReceipt, idx: number) => {
        if (receipt.status === 'error') {
          const token = chunk[idx]?.to;
          if (token) failedTokens.push(token);
          console.error('Push notification error:', receipt.details || receipt.message);
        }
      });
    } catch (error) {
      console.error('Push notification error:', error);
    }
  }

  // Remove failed tokens
  if (failedTokens.length > 0) {
    tokens = tokens.filter(t => !failedTokens.includes(t.token));
    saveTokens(tokens);
  }
} 
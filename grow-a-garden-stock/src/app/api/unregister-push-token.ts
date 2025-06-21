import { NextRequest, NextResponse } from 'next/server';
// @ts-expect-error: expo-server-sdk has no types
import { Expo } from 'expo-server-sdk';
import * as fs from 'fs';
import * as path from 'path';

const TOKENS_PATH = path.resolve(process.cwd(), 'push-tokens.json');

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

export async function DELETE(req: NextRequest) {
  const { token } = await req.json();
  if (!token || typeof token !== 'string') {
    return NextResponse.json({ message: 'Token required' }, { status: 400 });
  }
  if (!Expo.isExpoPushToken(token)) {
    return NextResponse.json({ message: 'Invalid token' }, { status: 400 });
  }
  let tokens = loadTokens();
  const initialLength = tokens.length;
  tokens = tokens.filter((t) => t.token !== token);
  if (tokens.length !== initialLength) {
    saveTokens(tokens);
    return NextResponse.json({ message: 'Token unregistered' });
  } else {
    return NextResponse.json({ message: 'Token not found' }, { status: 404 });
  }
} 
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

console.log('🔍 Debugging environment variables...\n');

console.log('📋 All environment variables:');
console.log(`  ONESIGNAL_APP_ID: "${process.env.ONESIGNAL_APP_ID}"`);
console.log(`  ONESIGNAL_API_KEY: "${process.env.ONESIGNAL_API_KEY}"`);
console.log(`  ONESIGNAL_ANDROID_CHANNEL_ID: "${process.env.ONESIGNAL_ANDROID_CHANNEL_ID}"`);

console.log('\n🔍 Checking if API key is truthy:');
console.log(`  ONESIGNAL_API_KEY exists: ${!!process.env.ONESIGNAL_API_KEY}`);
console.log(`  ONESIGNAL_API_KEY length: ${process.env.ONESIGNAL_API_KEY?.length || 0}`);
console.log(`  ONESIGNAL_API_KEY starts with 'os_': ${process.env.ONESIGNAL_API_KEY?.startsWith('os_') || false}`);

console.log('\n📁 .env.local file path:');
console.log(`  ${path.resolve(__dirname, '.env.local')}`);

console.log('\n�� Debug completed'); 
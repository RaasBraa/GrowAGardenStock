import * as fs from 'fs';
import * as path from 'path';

const TOKENS_PATH = path.resolve(process.cwd(), 'push-tokens.json');

// Your specific token that's inactive
const TARGET_TOKEN = "657c6f62-1dc2-49c9-aab1-21e6f5cf2aaa";

function reactivateToken() {
  try {
    console.log('🔧 Reactivating inactive token...');
    
    // Load tokens
    const tokens = JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf-8'));
    
    // Find the target token
    const tokenEntry = tokens.find(t => t.token === TARGET_TOKEN);
    
    if (!tokenEntry) {
      console.log('❌ Token not found');
      return;
    }
    
    console.log('📊 Token status before:');
    console.log(`   Active: ${tokenEntry.is_active}`);
    console.log(`   Failure count: ${tokenEntry.failure_count || 0}`);
    console.log(`   Last failure: ${tokenEntry.last_failure || 'None'}`);
    console.log(`   Preferences: ${Object.keys(tokenEntry.preferences || {}).length} items`);
    
    // Reactivate the token
    tokenEntry.is_active = true;
    tokenEntry.failure_count = 0;
    tokenEntry.last_failure = undefined;
    tokenEntry.last_used = new Date().toISOString();
    
    // Save tokens
    fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2));
    
    console.log('\n✅ Token reactivated!');
    console.log('📊 Token status after:');
    console.log(`   Active: ${tokenEntry.is_active}`);
    console.log(`   Failure count: ${tokenEntry.failure_count}`);
    console.log(`   Last failure: ${tokenEntry.last_failure}`);
    console.log(`   Last used: ${tokenEntry.last_used}`);
    
    console.log('\n🎯 You should now receive notifications again!');
    
  } catch (error) {
    console.error('❌ Error reactivating token:', error.message);
  }
}

reactivateToken(); 
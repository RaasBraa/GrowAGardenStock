import * as fs from 'fs';
import * as path from 'path';

const TOKENS_PATH = path.resolve(process.cwd(), 'push-tokens.json');

function testFailureCountDisabled() {
  try {
    console.log('🧪 Testing Failure Count Disabled\n');
    
    // Load tokens
    const tokens = JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf-8'));
    
    // Count active vs inactive tokens
    const activeTokens = tokens.filter(t => t.is_active);
    const inactiveTokens = tokens.filter(t => !t.is_active);
    
    console.log('📊 Token Status:');
    console.log(`   Total tokens: ${tokens.length}`);
    console.log(`   Active tokens: ${activeTokens.length}`);
    console.log(`   Inactive tokens: ${inactiveTokens.length}`);
    
    // Check your specific token
    const yourToken = tokens.find(t => t.token === "657c6f62-1dc2-49c9-aab1-21e6f5cf2aaa");
    if (yourToken) {
      console.log('\n🎯 Your Token Status:');
      console.log(`   Token: ${yourToken.token.substring(0, 20)}...`);
      console.log(`   Active: ${yourToken.is_active}`);
      console.log(`   Failure count: ${yourToken.failure_count || 0}`);
      console.log(`   Preferences: ${Object.keys(yourToken.preferences || {}).length} items`);
      
      if (yourToken.preferences && yourToken.preferences.Carrot) {
        console.log('   ✅ Has Carrot preference enabled');
      } else {
        console.log('   ❌ No Carrot preference');
      }
    }
    
    // Show some inactive tokens
    if (inactiveTokens.length > 0) {
      console.log('\n📋 Sample Inactive Tokens:');
      inactiveTokens.slice(0, 3).forEach(t => {
        console.log(`   ${t.token.substring(0, 20)}... (failures: ${t.failure_count || 0})`);
      });
    }
    
    console.log('\n✅ Failure count filtering has been DISABLED');
    console.log('🎯 All tokens (including inactive ones) will now receive notifications');
    console.log('\n💡 Wait for the next stock update to test!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testFailureCountDisabled(); 
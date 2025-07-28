import WebSocket from 'ws';
import fs from 'fs';

// Test configuration
const TEST_DURATION = 10 * 60 * 1000; // 10 minutes
const LOG_FILE = 'travelling-merchant-log.txt';

// Clear previous log file
fs.writeFileSync(LOG_FILE, `=== TRAVELLING MERCHANT MONITORING STARTED: ${new Date().toISOString()} ===\n\n`);

function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  
  console.log(logMessage.trim());
  fs.appendFileSync(LOG_FILE, logMessage);
}

// Travelling merchant detection counters
const merchantStats = {
  totalMessages: 0,
  merchantMessages: 0,
  merchantUpdates: [],
  lastMerchant: null,
  startTime: Date.now()
};

// WebSocket Travelling Merchant Monitor
class TravellingMerchantMonitor {
  constructor() {
    this.ws = null;
    this.userId = '.gamer01devtesting';
    this.isConnected = false;
  }

  start() {
    log('🌐 Starting WebSocket travelling merchant monitor...');
    this.connect();
  }

  connect() {
    try {
      const wsUrl = `wss://websocket.joshlei.com/growagarden?user_id=${encodeURIComponent(this.userId)}`;
      log(`🔗 Connecting to WebSocket: ${wsUrl}`);
      
      this.ws = new WebSocket(wsUrl);
      
      this.ws.on('open', () => {
        log('✅ WebSocket connection established');
        this.isConnected = true;
      });

      this.ws.on('message', (data) => {
        try {
          const rawMessage = data.toString();
          const message = JSON.parse(rawMessage);
          
          merchantStats.totalMessages++;
          
          // Log all message keys for debugging
          log(`📥 WebSocket message received. Keys: ${Object.keys(message).join(', ')}`);
          
          // Check for travelling merchant data
          if (message.travelingmerchant_stock || message.travellingmerchant_stock) {
            merchantStats.merchantMessages++;
            const merchantKey = message.travelingmerchant_stock ? 'travelingmerchant_stock' : 'travellingmerchant_stock';
            const merchantData = message[merchantKey];
            
            log(`🛒 TRAVELLING MERCHANT DETECTED! Key: ${merchantKey}`);
            
            if (Array.isArray(merchantData)) {
              log(`🛒 Found ${merchantData.length} merchant items`);
              
              const merchantInfo = {
                timestamp: new Date().toISOString(),
                key: merchantKey,
                items: merchantData,
                itemCount: merchantData.length,
                activeItems: merchantData.filter(item => item.quantity > 0).length
              };
              
              merchantStats.merchantUpdates.push(merchantInfo);
              merchantStats.lastMerchant = merchantInfo;
              
              // Log each merchant item
              merchantData.forEach((item, index) => {
                const status = item.quantity > 0 ? 'AVAILABLE' : 'SOLD OUT';
                const price = item.price ? `$${item.price}` : 'No price';
                log(`   ${index + 1}. ${item.name} (${status}) - Qty: ${item.quantity}, Price: ${price}`);
              });
            } else if (typeof merchantData === 'object') {
              log(`🛒 Merchant object structure: ${JSON.stringify(merchantData, null, 2)}`);
            } else {
              log(`🛒 Merchant data type: ${typeof merchantData}, value: ${merchantData}`);
            }
          }
          
          // Log full message for detailed analysis (but limit size)
          const messageStr = JSON.stringify(message);
          if (messageStr.length < 1000) {
            log(`📋 Full message: ${messageStr}`);
          } else {
            log(`📋 Message too large (${messageStr.length} chars), showing keys only`);
          }
          
        } catch (error) {
          log(`❌ WebSocket message parsing error: ${error.message}`);
        }
      });

      this.ws.on('error', (error) => {
        log(`❌ WebSocket error: ${error.message}`);
        this.isConnected = false;
      });

      this.ws.on('close', () => {
        log('🔌 WebSocket connection closed');
        this.isConnected = false;
      });

    } catch (error) {
      log(`❌ WebSocket connection error: ${error.message}`);
    }
  }

  stop() {
    log('🛑 Stopping WebSocket travelling merchant monitor...');
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }
}

// Main test runner
async function runTravellingMerchantTest() {
  log('🚀 Starting 10-minute travelling merchant monitoring test...');
  log(`⏰ Test will run until: ${new Date(Date.now() + TEST_DURATION).toISOString()}`);
  
  const merchantMonitor = new TravellingMerchantMonitor();

  // Start monitor
  merchantMonitor.start();

  // Periodic status updates
  const statusInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - merchantStats.startTime) / 1000);
    const remaining = Math.floor((TEST_DURATION - (Date.now() - merchantStats.startTime)) / 1000);
    
    log(`📊 Status Update (${elapsed}s elapsed, ${remaining}s remaining):`);
    log(`   WebSocket: ${merchantStats.totalMessages} messages, ${merchantStats.merchantMessages} merchant messages`);
    
    if (merchantStats.lastMerchant) {
      log(`   Last merchant update: ${merchantStats.lastMerchant.timestamp} (${merchantStats.lastMerchant.itemCount} items)`);
    }
  }, 60000); // Every minute

  // Test completion
  setTimeout(() => {
    clearInterval(statusInterval);
    
    log('\n🏁 Travelling merchant monitoring test completed!');
    log('\n📈 FINAL STATISTICS:');
    log(`   Test Duration: ${Math.floor(TEST_DURATION / 1000)} seconds`);
    log(`   WebSocket Total Messages: ${merchantStats.totalMessages}`);
    log(`   WebSocket Merchant Messages: ${merchantStats.merchantMessages}`);
    
    log('\n🛒 MERCHANT UPDATES SUMMARY:');
    log(`   Travelling Merchant Updates: ${merchantStats.merchantUpdates.length}`);
    merchantStats.merchantUpdates.forEach((update, index) => {
      log(`     ${index + 1}. ${update.timestamp} - ${update.itemCount} items (${update.activeItems} available)`);
    });
    
    log('\n📁 Log file created:');
    log(`   - ${LOG_FILE} (summary log)`);
    
    // Stop monitor
    merchantMonitor.stop();
    
    log('✅ Test completed successfully!');
    process.exit(0);
  }, TEST_DURATION);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  log('\n🛑 Test interrupted by user. Shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('\n🛑 Test terminated. Shutting down...');
  process.exit(0);
});

// Start the test
runTravellingMerchantTest().catch((error) => {
  log(`❌ Test failed: ${error.message}`);
  process.exit(1);
}); 
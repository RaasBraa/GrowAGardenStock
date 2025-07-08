import { EventSource } from 'eventsource';

// Configuration
const SSE_URL = 'http://103.45.246.244:3000/api/stock-updates';
const TRIGGER_URL = 'http://103.45.246.244:3000/api/trigger-sse';
const TEST_DURATION = 60000; // 1 minute

console.log('🔌 HTTP-Based SSE Test Script');
console.log('============================');
console.log(`SSE URL: ${SSE_URL}`);
console.log(`Trigger URL: ${TRIGGER_URL}`);
console.log(`Test Duration: ${TEST_DURATION / 1000} seconds`);
console.log('');

let connectionAttempts = 0;
let messagesReceived = 0;
let errors = [];
let sseConnected = false;

// Test SSE connection
function testSSEConnection() {
    console.log('🔄 Attempting SSE connection...');
    
    try {
        const eventSource = new EventSource(SSE_URL);
        
        eventSource.onopen = () => {
            console.log('✅ SSE connection opened successfully!');
            console.log('📡 Ready to receive messages...');
            sseConnected = true;
            console.log('');
        };
        
        eventSource.onmessage = (event) => {
            messagesReceived++;
            console.log(`📨 Message #${messagesReceived} received:`);
            console.log(`   Data: ${event.data}`);
            console.log(`   Type: ${event.type}`);
            console.log(`   Origin: ${event.origin}`);
            console.log('');
        };
        
        eventSource.onerror = (event) => {
            connectionAttempts++;
            const error = {
                attempt: connectionAttempts,
                timestamp: new Date().toISOString(),
                error: event.error || 'Unknown error',
                readyState: eventSource.readyState
            };
            errors.push(error);
            
            console.log(`❌ SSE connection error #${connectionAttempts}:`);
            console.log(`   Error: ${error.error}`);
            console.log(`   Ready State: ${error.readyState}`);
            console.log(`   Timestamp: ${error.timestamp}`);
            console.log('');
        };
        
        return eventSource;
        
    } catch (error) {
        console.log('💥 Failed to create EventSource:');
        console.log(`   Error: ${error.message}`);
        return null;
    }
}

// Test HTTP trigger
async function testHTTPTrigger() {
    console.log('🚀 Testing HTTP trigger...');
    
    try {
        const response = await fetch(TRIGGER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: 'grow-garden-sse-secret-2024',
                type: 'stock_update',
                source: 'test',
                category: 'seeds',
                stockId: 'test-' + Date.now(),
                timestamp: new Date().toISOString()
            })
        });

        const result = await response.json();
        
        if (response.ok) {
            console.log('✅ HTTP trigger successful!');
            console.log('   Response:', result);
        } else {
            console.log('❌ HTTP trigger failed!');
            console.log('   Status:', response.status);
            console.log('   Response:', result);
        }
        
    } catch (error) {
        console.log('❌ HTTP trigger error:');
        console.log('   Error:', error.message);
    }
    
    console.log('');
}

// Main test sequence
async function runTest() {
    console.log('🧪 Starting HTTP-based SSE test...\n');
    
    // Step 1: Connect to SSE
    const eventSource = testSSEConnection();
    
    // Step 2: Wait a moment for connection
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 3: Test HTTP trigger
    if (sseConnected) {
        await testHTTPTrigger();
        
        // Step 4: Wait for SSE message
        console.log('⏳ Waiting for SSE message...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Step 5: Test multiple triggers
        console.log('🔄 Testing multiple triggers...');
        for (let i = 0; i < 3; i++) {
            await testHTTPTrigger();
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    // Step 6: Wait for final messages
    console.log('⏳ Waiting for final messages...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Step 7: Close connection and show results
    if (eventSource) {
        eventSource.close();
    }
    
    // Summary
    console.log('');
    console.log('📊 Test Summary:');
    console.log('================');
    console.log(`SSE connected: ${sseConnected ? '✅ Yes' : '❌ No'}`);
    console.log(`Messages received: ${messagesReceived}`);
    console.log(`Errors encountered: ${errors.length}`);
    
    if (messagesReceived > 0) {
        console.log('');
        console.log('🎉 HTTP-based SSE system is working!');
    } else {
        console.log('');
        console.log('⚠️ No messages received. Possible issues:');
        console.log('   - SSE connection failed');
        console.log('   - HTTP trigger failed');
        console.log('   - Next.js app not running');
        console.log('   - Wrong URLs or ports');
    }
    
    process.exit(0);
}

// Handle process termination
process.on('SIGINT', () => {
    console.log('');
    console.log('🛑 Test interrupted by user');
    process.exit(0);
});

// Start the test
runTest().catch(console.error); 
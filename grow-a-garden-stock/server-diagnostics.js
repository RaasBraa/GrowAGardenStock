import WebSocket from 'ws';
import dns from 'dns';
import https from 'https';
import { createConnection } from 'net';

console.log('🔍 Server Network Diagnostics for JStudio WebSocket');
console.log('==================================================\n');

async function runDiagnostics() {
  const targetHost = 'websocket.joshlei.com';
  const targetPort = 443;
  
  console.log('1. DNS Resolution Test');
  console.log('----------------------');
  try {
    const addresses = await dns.promises.resolve4(targetHost);
    console.log(`✅ DNS Resolution successful for ${targetHost}:`);
    addresses.forEach(addr => console.log(`   - ${addr}`));
  } catch (error) {
    console.log(`❌ DNS Resolution failed: ${error.message}`);
    return;
  }
  
  console.log('\n2. TCP Connection Test');
  console.log('---------------------');
  try {
    const addresses = await dns.promises.resolve4(targetHost);
    const testAddress = addresses[0];
    
    await new Promise((resolve, reject) => {
      const socket = createConnection(targetPort, testAddress, () => {
        console.log(`✅ TCP connection successful to ${testAddress}:${targetPort}`);
        socket.destroy();
        resolve();
      });
      
      socket.setTimeout(10000, () => {
        console.log(`❌ TCP connection timeout to ${testAddress}:${targetPort}`);
        socket.destroy();
        reject(new Error('Connection timeout'));
      });
      
      socket.on('error', (error) => {
        console.log(`❌ TCP connection failed: ${error.message}`);
        reject(error);
      });
    });
  } catch (error) {
    console.log(`❌ TCP connection test failed: ${error.message}`);
  }
  
  console.log('\n3. HTTPS Connection Test');
  console.log('------------------------');
  try {
    await new Promise((resolve, reject) => {
      const req = https.get(`https://${targetHost}`, (res) => {
        console.log(`✅ HTTPS connection successful: ${res.statusCode}`);
        resolve();
      });
      
      req.setTimeout(10000, () => {
        console.log('❌ HTTPS connection timeout');
        req.destroy();
        reject(new Error('HTTPS timeout'));
      });
      
      req.on('error', (error) => {
        console.log(`❌ HTTPS connection failed: ${error.message}`);
        reject(error);
      });
    });
  } catch (error) {
    console.log(`❌ HTTPS connection test failed: ${error.message}`);
  }
  
  console.log('\n4. WebSocket Connection Test');
  console.log('----------------------------');
  try {
    await new Promise((resolve, reject) => {
      const wsUrl = `wss://${targetHost}/growagarden?user_id=growagardenstock_bot`;
      console.log(`Attempting WebSocket connection to: ${wsUrl}`);
      
      const ws = new WebSocket(wsUrl, {
        handshakeTimeout: 30000,
        perMessageDeflate: false,
        maxPayload: 1024 * 1024,
        followRedirects: true
      });
      
      const connectionTimeout = setTimeout(() => {
        console.log('❌ WebSocket connection timeout after 30 seconds');
        ws.terminate();
        reject(new Error('WebSocket timeout'));
      }, 30000);
      
      ws.on('open', () => {
        clearTimeout(connectionTimeout);
        console.log('✅ WebSocket connection established successfully!');
        ws.close();
        resolve();
      });
      
      ws.on('error', (error) => {
        clearTimeout(connectionTimeout);
        console.log(`❌ WebSocket connection error: ${error.message}`);
        console.log(`   Error code: ${error.code}`);
        console.log(`   Error syscall: ${error.syscall}`);
        reject(error);
      });
      
      ws.on('close', (code, reason) => {
        clearTimeout(connectionTimeout);
        console.log(`ℹ️  WebSocket connection closed. Code: ${code}, Reason: ${reason.toString()}`);
        resolve();
      });
    });
  } catch (error) {
    console.log(`❌ WebSocket connection test failed: ${error.message}`);
  }
  
  console.log('\n5. Environment Information');
  console.log('--------------------------');
  console.log(`Node.js version: ${process.version}`);
  console.log(`Platform: ${process.platform}`);
  console.log(`Architecture: ${process.arch}`);
  console.log(`Current working directory: ${process.cwd()}`);
  
  // Check for proxy environment variables
  const proxyVars = ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 'NO_PROXY'];
  console.log('\nProxy Environment Variables:');
  proxyVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
      console.log(`   ${varName}: ${value}`);
    }
  });
  
  console.log('\n🔍 Diagnostics complete!');
}

runDiagnostics().catch(console.error); 
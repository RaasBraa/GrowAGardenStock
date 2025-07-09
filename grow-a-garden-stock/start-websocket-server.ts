#!/usr/bin/env node

import { initializeWebSocketServer } from './src/lib/websocket-server';

console.log('🚀 Starting WebSocket Server...');

// Initialize the WebSocket server
const wss = initializeWebSocketServer();

console.log('✅ WebSocket server is now running on ws://103.45.246.244:8080');
console.log('📡 Ready to accept connections with token authentication');
console.log('🔄 Server will handle stock updates and client management');

// Keep the process running
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down WebSocket server...');
  if (wss) {
    wss.close(() => {
      console.log('✅ WebSocket server stopped');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down WebSocket server...');
  if (wss) {
    wss.close(() => {
      console.log('✅ WebSocket server stopped');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
}); 
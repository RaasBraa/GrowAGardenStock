#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🤖 Starting Discord Backup Bot Listener...');
console.log('⚠️  This should only be used when the WebSocket connection fails!');
console.log('');

// Change to the correct directory
process.chdir(__dirname);

// Start the Discord listener
const discordProcess = spawn('node', ['-r', 'ts-node/register', 'src/lib/discord-listener.ts'], {
  stdio: 'inherit',
  cwd: __dirname
});

discordProcess.on('close', (code) => {
  console.log(`Discord listener exited with code ${code}`);
});

discordProcess.on('error', (error) => {
  console.error('Failed to start Discord listener:', error);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Discord backup listener...');
  discordProcess.kill('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down Discord backup listener...');
  discordProcess.kill('SIGTERM');
  process.exit(0);
}); 
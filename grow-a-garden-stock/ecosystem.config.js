module.exports = {
  apps: [
    {
      name: 'grow-app',
      script: 'npm',
      args: 'start',
      cwd: './grow-a-garden-stock',
      env: { 
        NODE_ENV: 'production',
        NODE_OPTIONS: '--max-old-space-size=768 --expose-gc'
      },
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '600M',
      node_args: '--expose-gc',
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 4000,
      error_file: './logs/grow-app-error.log',
      out_file: './logs/grow-app-out.log',
      log_file: './logs/grow-app-combined.log',
      time: true
    },
    {
      name: 'grow-websocket',
      script: 'node',
      args: '--loader ts-node/esm start-stock-manager.ts',
      cwd: './grow-a-garden-stock',
      env: { 
        NODE_ENV: 'production',
        NODE_OPTIONS: '--max-old-space-size=768 --expose-gc'
      },
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '600M',
      node_args: '--expose-gc',
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 4000,
      error_file: './logs/grow-websocket-error.log',
      out_file: './logs/grow-websocket-out.log',
      log_file: './logs/grow-websocket-combined.log',
      time: true
    }
  ]
}; 
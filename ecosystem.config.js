const { cpus } = require('os')
const cpuLen = cpus().length
module.exports = {
  apps: [
    {
      name: 'mx-server',
      script: 'index.js',
      autorestart: true,
      exec_mode: 'cluster',
      watch: false,
      instances: Math.min(2, cpuLen),
      max_memory_restart: '230M',
      args: '--color',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
}

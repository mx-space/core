module.exports = {
  apps: [
    {
      name: 'mx-server',
      script: 'index.js',
      autorestart: true,
      exec_mode: 'cluster',
      watch: false,
      instances: 2,
      max_memory_restart: '230M',

      env: {
        NODE_ENV: 'production',
      },
    },
  ],
}

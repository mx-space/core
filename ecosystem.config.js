module.exports = {
  apps: [
    {
      name: 'mx-server',
      script: 'index.js',
      autorestart: true,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '230M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
}

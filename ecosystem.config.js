module.exports = {
  apps: [
    {
      name: 'mx-space-server@next',
      script: 'dist/src/main.js',
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

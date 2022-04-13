module.exports = {
  apps: [
    {
      name: 'mx-server',
      script: 'dist/src/main.js',
      autorestart: true,
      exec_mode: 'cluster',
      instances: 2,
      watch: false,

      max_memory_restart: '230M',
      env: {
        DEBUG_COLORS: true,
        NODE_ENV: 'development',
      },

      args: '--allowed_origins=dev.* --cluster --color',
    },
  ],
}

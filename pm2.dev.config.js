module.exports = {
  apps: [
    {
      name: 'mx-server',
      script: 'dist/src/main.js',
      autorestart: true,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '230M',
      env: {
        NODE_ENV: 'production',
      },

      args: '--allowed_origins=dev.* --cluster',
    },
  ],
}

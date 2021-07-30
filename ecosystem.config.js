// eslint-disable-next-line @typescript-eslint/no-var-requires
// const env = require('dotenv').config().parsed
module.exports = {
  apps: [
    {
      name: 'mx-space-server@next',
      script: 'dist/main.js',
      autorestart: true,
      instances: 'max',
      exec_mode: 'cluster',
      watch: false,
      // instances: 1,
      // max_memory_restart: env.APP_MAX_MEMORY || '150M',
      env: {
        NODE_ENV: 'production',
        // ...env,
      },
    },
  ],
}

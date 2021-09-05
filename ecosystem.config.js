/*
 * @Author: Innei
 * @Date: 2020-04-30 18:14:55
 * @LastEditTime: 2020-05-25 21:05:26
 * @LastEditors: Innei
 * @FilePath: /mx-server/ecosystem.config.js
 * @Copyright
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const env = require('dotenv').config().parsed
module.exports = {
  apps: [
    {
      name: 'mx-space-server@next',
      script: 'dist/src/main.js',
      autorestart: true,
      instances: 'max',
      exec_mode: 'cluster',
      watch: false,
      // instances: 1,
      // max_memory_restart: env.APP_MAX_MEMORY || '150M',
      env: {
        NODE_ENV: 'production',
        ...env,
      },
    },
  ],
}

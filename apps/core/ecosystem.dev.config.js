const { execSync } = require('node:child_process')
const nodePath = execSync(`npm root --quiet -g`, { encoding: 'utf-8' }).split(
  '\n',
)[0]

module.exports = {
  apps: [
    {
      name: 'mx-server',
      script: 'dist/src/main.js',
      autorestart: true,
      exec_mode: 'cluster',
      watch: false,
      instances: 2,
      max_memory_restart: '220M',
      args: '--color --encrypt_enable',
      env: {
        NODE_ENV: 'development',
        NODE_PATH: nodePath,
        MX_ENCRYPT_KEY: process.env.MX_ENCRYPT_KEY,
        PORT: process.env.PORT,
      },
    },
  ],
}

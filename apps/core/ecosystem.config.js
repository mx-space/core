const { cpus } = require('os')
const { execSync } = require('child_process')
const nodePath = execSync(`npm root --quiet -g`, { encoding: 'utf-8' }).split(
  '\n',
)[0]

const cpuLen = cpus().length
module.exports = {
  apps: [
    {
      name: 'mx-server',
      script: 'index.js',
      autorestart: true,
      exec_mode: 'cluster',
      watch: false,
      instances: cpuLen,
      max_memory_restart: '520M',
      args: '--color --encrypt_enable',
      env: {
        NODE_ENV: 'production',
        NODE_PATH: nodePath,
        MX_ENCRYPT_KEY: process.env.MX_ENCRYPT_KEY,
        PORT: process.env.PORT,
      },
    },
  ],
}

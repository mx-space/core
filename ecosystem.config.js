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
      instances: Math.min(2, cpuLen),
      max_memory_restart: '230M',
      args: '--color',
      env: {
        NODE_ENV: 'production',
        NODE_PATH: nodePath,
      },
    },
  ],
}

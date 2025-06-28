const { cpus } = require('node:os')
const { execSync } = require('node:child_process')
const nodePath = execSync(`npm root --quiet -g`, { encoding: 'utf-8' }).split(
  '\n',
)[0]

const cpuLen = cpus().length
module.exports = {
  apps: [
    {
      name: 'mx-server',
      script: './index.js',
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
        // NOTE: if OOM happens, try to use jemalloc
        // https://blog.csdn.net/qq_21567385/article/details/135322697
        // LD_PRELOAD: '/usr/lib/x86_64-linux-gnu/libjemalloc.so',
      },
    },
  ],
}

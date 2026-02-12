import { exec } from './node-utils.mjs'

const argv = process.argv.slice(2)

console.log(argv)
await exec('pm2', ['reload', 'ecosystem.dev.config.js', '--', ...argv])

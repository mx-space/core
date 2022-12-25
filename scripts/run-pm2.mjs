import { $ } from 'zx'

const argv = process.argv.slice(2)

console.log(argv)
$`pm2 reload ecosystem.dev.config.js -- ${argv}`

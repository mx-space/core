const { cd, $, chalk } = require('zx')
const globals = { $, chalk, cd, consola: console, isDev: true }

for (const key in globals) {
  global[key] = globals[key]
}

process.env.TEST = true

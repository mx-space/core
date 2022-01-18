const { cd, $, chalk } = require('zx')
const globals = { $, chalk, cd, consola: console }

for (const key in globals) {
  global[key] = globals[key]
}

process.env.TEST = true

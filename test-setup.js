const { registerGlobals } = require('zx')
registerGlobals()
const globals = { consola: console, isDev: true }

for (const key in globals) {
  global[key] = globals[key]
}

process.env.TEST = true

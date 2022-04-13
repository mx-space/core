const { registerGlobals } = require('zx-cjs')
registerGlobals()
const globals = { consola: console, isDev: true, cwd: process.cwd() }

for (const key in globals) {
  global[key] = globals[key]
}

process.env.TEST = true

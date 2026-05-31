import type { Plugin } from 'vite'

// es-toolkit's `exports['./compat/*']` map only ships CJS shims (no .mjs
// sibling), so importing `es-toolkit/compat/<name>` resolves to a CJS file
// like `module.exports = require('../dist/compat/object/get.js').get`.
// Vite 8 (Rolldown) mis-bundles the nested CJS require() chain into raw
// `require(...)` calls in browser chunks, producing
// `TypeError: require_isUnsafeProperty is not a function` at runtime.
//
// This plugin intercepts those bare specifiers and serves a tiny virtual
// ESM module that re-exports the named export from `es-toolkit/compat`
// (which has a real .mjs entrypoint). Tree-shaking still drops the rest.
const COMPAT_PATTERN = /^es-toolkit\/compat\/([\w$]+)$/
const VIRTUAL_PREFIX = '\0virtual:es-toolkit-compat/'

export function esToolkitCompatShim(): Plugin {
  return {
    name: 'es-toolkit-compat-shim',
    enforce: 'pre',
    resolveId(source) {
      const match = COMPAT_PATTERN.exec(source)
      if (!match) return null
      return `${VIRTUAL_PREFIX}${match[1]}`
    },
    load(id) {
      if (!id.startsWith(VIRTUAL_PREFIX)) return null
      const name = id.slice(VIRTUAL_PREFIX.length)
      return `export { ${name} as default } from 'es-toolkit/compat';\n`
    },
  }
}

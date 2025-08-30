import { defineConfig } from 'tsdown'

export default defineConfig({
  clean: true,
  target: 'es2020',
  entry: ['index.ts', 'auth.ts', 'zod.ts', 'install-pkg.ts'],
  dts: true,
  external: ['mongodb'],
  format: ['cjs'],
  platform: 'node',
  // banner: {
  //   js: `const __injected_import_meta_url = require("url").pathToFileURL(__filename).href;`,
  // },
  // esbuildOptions(options) {
  //   options.define = {
  //     ...options.define,
  //     'import.meta.url': '__injected_import_meta_url',
  //   }
  // },
})

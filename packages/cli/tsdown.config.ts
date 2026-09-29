import { defineConfig } from 'tsdown'

export default defineConfig({
  clean: true,
  target: 'es2022',
  entry: ['src/bin/mxs.ts', 'src/index.ts'],
  outDir: 'dist',
  dts: { eager: true },
  format: ['esm'],
  platform: 'node',
  deps: {
    // loro-crdt's node build loads its wasm and JS snippets relative to its own
    // files, so it has to stay a runtime dependency instead of being inlined.
    alwaysBundle: (id) => !/^loro-crdt(?:\/|$)/.test(id),
    onlyBundle: false,
  },
  sourcemap: false,
  shims: true,
})

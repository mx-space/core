import { defineConfig } from 'tsdown'

export default defineConfig({
  clean: false,
  target: 'es2023',
  entry: ['src/main.ts'],
  dts: false,
  platform: 'node',
  noExternal: () => true,
  format: ['esm'],
  outDir: 'out',
  sourcemap: true,
  shims: true,
  inlineOnly: false,
})

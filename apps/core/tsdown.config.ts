import { defineConfig } from 'tsdown'

export default defineConfig({
  clean: true,
  target: 'es2023',
  entry: ['src/main.ts'],
  dts: false,
  platform: 'node',
  noExternal: () => true,
  format: ['esm'],
  outDir: 'out',
  sourcemap: true,
  shims: true,
})

import { defineConfig } from 'tsdown'

export default defineConfig({
  clean: true,
  target: 'es2022',
  entry: ['src/index.ts', 'src/core/index.ts'],
  outDir: 'dist',
  dts: true,
  format: ['esm'],
  platform: 'neutral',
  sourcemap: true,
})

import { defineConfig } from 'tsdown'

export default defineConfig({
  clean: true,
  target: 'es2022',
  entry: ['src/index.ts', 'src/runtime/index.ts', 'src/decision/index.ts'],
  outDir: 'dist',
  dts: true,
  format: ['esm'],
  platform: 'neutral',
  sourcemap: true,
})

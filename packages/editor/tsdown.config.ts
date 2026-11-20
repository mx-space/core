import { defineConfig } from 'tsdown'

export default defineConfig({
  clean: true,
  target: 'es2022',
  entry: ['src/index.ts', 'src/core/index.ts', 'src/loro/index.ts'],
  outDir: 'dist',
  dts: { generator: 'tsrs' },
  format: ['esm'],
  platform: 'neutral',
  sourcemap: true,
})

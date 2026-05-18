import { defineConfig } from 'tsdown'

export default defineConfig({
  clean: true,
  target: 'es2022',
  entry: ['src/bin/mxs.ts', 'src/index.ts'],
  outDir: 'dist',
  dts: { eager: true },
  format: ['esm'],
  platform: 'node',
  noExternal: () => true,
  sourcemap: false,

  shims: true,
})

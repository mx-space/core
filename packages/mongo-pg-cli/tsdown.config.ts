import { defineConfig } from 'tsdown'

export default defineConfig({
  clean: true,
  target: 'es2022',
  entry: ['src/cli.ts'],
  outDir: 'dist',
  dts: false,
  format: ['esm'],
  platform: 'node',
  // Inline every dependency so the produced CLI is a single, runnable file.
  noExternal: () => true,
  sourcemap: true,
  shims: true,
})

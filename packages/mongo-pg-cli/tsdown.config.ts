import { defineConfig } from 'tsdown'

export default defineConfig({
  clean: true,
  target: 'es2022',
  // `cli.ts` is the runnable CLI binary; `index.ts` is the library entry that
  // re-exports helpers (createResolver, MigrationContext, …) consumed by
  // mx-core specs.
  entry: ['src/cli.ts', 'src/index.ts'],
  outDir: 'dist',
  dts: true,
  format: ['esm'],
  platform: 'node',
  // Inline every dependency so the produced CLI is a single, runnable file.
  noExternal: () => true,
  sourcemap: true,
  shims: true,
})

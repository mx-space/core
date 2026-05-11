import { resolve } from 'node:path'

import swc from 'unplugin-swc'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

/**
 * Production bundle config — replaces the legacy tsdown setup.
 *
 * Vite 8 routes `build.rolldownOptions` through rolldown (the same engine
 * tsdown used), so output should be near-identical. We bundle every
 * dependency (`ssr.noExternal: true`) to mirror tsdown's `noExternal: () =>
 * true`, except for native modules (sharp) that `requireDepsWithInstall`
 * resolves at runtime against `node_modules` and must NOT be inlined.
 *
 * Decorator metadata is emitted via unplugin-swc — esbuild is disabled
 * because it cannot emit ts metadata, the same constraint that drove the
 * dev/test config to swc.
 */
export default defineConfig({
  esbuild: false,
  define: {
    __DEV__: 'false',
    __TEST__: 'false',
  },
  plugins: [
    swc.vite(),
    tsconfigPaths({
      projects: [resolve(__dirname, './tsconfig.json')],
    }),
  ],
  ssr: {
    noExternal: true,
    target: 'node',
  },
  build: {
    outDir: 'out',
    emptyOutDir: true,
    target: 'node22',
    sourcemap: true,
    minify: false,
    ssr: true,
    rolldownOptions: {
      input: {
        main: resolve(__dirname, 'src/main.ts'),
        migrate: resolve(__dirname, 'src/migrate.ts'),
        'app-migrate': resolve(__dirname, 'src/app-migrate.ts'),
      },
      output: {
        format: 'esm',
        entryFileNames: '[name].mjs',
        chunkFileNames: 'chunks/[name]-[hash].mjs',
      },
      external: ['sharp'],
    },
  },
})

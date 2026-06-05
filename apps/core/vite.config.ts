import { resolve } from 'node:path'

import swc from 'unplugin-swc'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig(({ command }) => {
  const isBuild = command === 'build'

  return {
    esbuild: false,
    define: {
      __DEV__: isBuild ? 'false' : 'true',
      __TEST__: 'false',
    },
    plugins: [
      swc.vite(),
      tsconfigPaths({
        projects: [resolve(__dirname, './tsconfig.json')],
      }),
    ],
    ...(isBuild && {
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
    }),
  }
})

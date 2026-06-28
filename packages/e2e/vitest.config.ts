import { resolve } from 'node:path'

import swc from 'unplugin-swc'
import tsconfigPath from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

const root = resolve(__dirname, '../..')
const coreRoot = resolve(root, 'apps/core')

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    globals: true,
    hookTimeout: 120_000,
    testTimeout: 120_000,
    retry: process.env.CI ? 2 : 0,
    fileParallelism: true,
    pool: 'forks',
    maxWorkers: process.env.CI ? 2 : undefined,
    setupFiles: [resolve(__dirname, 'src/helpers/setup.ts')],
  },
  resolve: {
    alias: {
      '~/app.config': resolve(__dirname, 'src/helpers/core-app-config.ts'),
      '~': resolve(coreRoot, 'src'),
      test: resolve(coreRoot, 'test'),
    },
  },
  esbuild: false,
  define: {
    __DEV__: 'true',
    __TEST__: 'true',
  },
  plugins: [
    swc.vite(),
    tsconfigPath({
      projects: [
        resolve(__dirname, 'tsconfig.json'),
        resolve(coreRoot, 'tsconfig.json'),
        resolve(coreRoot, 'test/tsconfig.json'),
      ],
    }),
  ],
})

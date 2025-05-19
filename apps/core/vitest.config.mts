import { cpSync, existsSync } from 'node:fs'
import path, { resolve } from 'node:path'
import swc from 'unplugin-swc'
import tsconfigPath from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

if (
  existsSync(
    path.resolve(__dirname, '../../node_modules/.cache/redis-memory-server'),
  )
) {
  cpSync(
    path.resolve(__dirname, '../../node_modules/.cache/redis-memory-server'),
    path.resolve(__dirname, './node_modules/.cache/redis-memory-server'),
    { recursive: true },
  )
}

export default defineConfig({
  root: './test',
  test: {
    include: ['**/*.spec.ts', '**/*.e2e-spec.ts'],

    globals: true,
    globalSetup: [resolve(__dirname, './test/setup.ts')],
    setupFiles: [resolve(__dirname, './test/setup-global.ts')],
    environment: 'node',
    includeSource: [resolve(__dirname, './test')],
  },
  optimizeDeps: {
    needsInterop: ['lodash'],
  },
  resolve: {
    alias: {
      'zx-cjs': 'zx',
      '~/app.config': resolve(__dirname, './src/app.config.test.ts'),
      '~/common/decorators/auth.decorator': resolve(
        __dirname,
        './test/mock/decorators/auth.decorator.ts',
      ),
    },
  },

  // esbuild can not emit ts metadata
  esbuild: false,

  plugins: [
    swc.vite(),

    tsconfigPath({
      projects: [
        resolve(__dirname, './test/tsconfig.json'),
        resolve(__dirname, './tsconfig.json'),
      ],
    }),

    {
      name: 'vitest-plugin',
      config: () => ({
        test: {
          setupFiles: ['./setupFiles/lifecycle.ts'],
        },
      }),
    },
  ],
})

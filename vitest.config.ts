import { resolve } from 'path'
import swc from 'rollup-plugin-swc'
import tsconfigPath from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

const swcPlugin = (() => {
  const plugin = swc({
    test: 'ts',
    jsc: {
      parser: {
        syntax: 'typescript',
        dynamicImport: true,
        decorators: true,
      },
      target: 'es2021',
      transform: {
        decoratorMetadata: true,
      },
    },
  })

  const originalTransform = plugin.transform!

  // @ts-ignore
  const transform = function (...args: Parameters<typeof originalTransform>) {
    // @ts-ignore
    if (!args[1].endsWith('html')) return originalTransform.apply(this, args)
  }

  return { ...plugin, transform }
})()

export default defineConfig({
  root: './test',
  test: {
    include: ['**/*.spec.ts', '**/*.e2e-spec.ts'],

    threads: false,
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
    },
  },

  // esbuild can not emit ts metadata
  esbuild: false,

  plugins: [
    // @ts-ignore
    swcPlugin,
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

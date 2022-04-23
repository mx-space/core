import { resolve } from 'path'
import tsconfigPath from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  root: './test',
  test: {
    globals: true,
    globalSetup: [resolve(__dirname, './test/setup.ts')],
    setupFiles: [resolve(__dirname, './test/setup-global.ts')],
    environment: 'node',
    includeSource: [resolve(__dirname, './test')],
  },
  resolve: {
    alias: {
      'zx-cjs': 'zx',
    },
  },
  plugins: [
    tsconfigPath({
      projects: [resolve(__dirname, './test/tsconfig.json')],
    }),

    {
      name: 'a-vitest-plugin-that-changes-config',
      config: () => ({
        test: { setupFiles: [resolve(__dirname, './test/setup-global.ts')] },
      }),
    },
  ],
})

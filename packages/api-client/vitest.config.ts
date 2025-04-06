import tsPath from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,

    include: ['__tests__/**/*.(spec|test).ts'],
  },

  // @ts-ignore
  plugins: [tsPath()],
  optimizeDeps: {
    needsInterop: ['lodash'],
  },
})

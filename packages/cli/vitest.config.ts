import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts', 'test/**/*.spec.ts'],
    environment: 'node',
  },
  resolve: {
    alias: {
      '~': new URL('./src', import.meta.url).pathname,
    },
  },
})

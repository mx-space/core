import tsPath from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

// eslint-disable-next-line import/no-default-export
export default defineConfig({
  test: {
    globals: true,

    include: ['__tests__/**/*.(spec|test).ts'],
  },

  // @ts-ignore
  plugins: [tsPath()],
})

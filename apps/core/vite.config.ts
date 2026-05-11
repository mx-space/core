import { resolve } from 'node:path'

import swc from 'unplugin-swc'
import { defineConfig } from 'vite'
import tsconfigPath from 'vite-tsconfig-paths'

export default defineConfig({
  // esbuild can not emit ts metadata
  esbuild: false,
  define: {
    __DEV__: 'true',
    __TEST__: 'false',
  },
  plugins: [
    swc.vite(),
    tsconfigPath({
      projects: [resolve(__dirname, './tsconfig.json')],
    }),
  ],
})

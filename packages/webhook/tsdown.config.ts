import { defineConfig } from 'tsdown'

export default defineConfig({
  clean: true,
  target: 'es2020',
  entry: ['src/index.ts'],
  dts: true,
  format: ['cjs', 'esm'],
})

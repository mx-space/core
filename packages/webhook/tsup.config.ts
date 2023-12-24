import { defineConfig } from 'tsup'

export default defineConfig({
  clean: true,
  target: 'es2020',
  entry: ['src/index.ts'],
  dts: true,
  format: ['cjs', 'esm'],
})

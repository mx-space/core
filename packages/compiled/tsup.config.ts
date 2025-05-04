import { defineConfig } from 'tsup'

export default defineConfig({
  clean: true,
  target: 'es2020',
  entry: ['index.ts', 'auth.ts', 'zod.ts'],
  dts: true,
  external: ['mongodb'],
  format: ['cjs'],
})

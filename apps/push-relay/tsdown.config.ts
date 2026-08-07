import { defineConfig } from 'tsdown'

export default defineConfig({
  clean: true,
  entry: ['src/index.ts', 'src/migrate.ts'],
  target: 'node22',
  platform: 'node',
  format: ['esm'],
  dts: true,
  deps: {
    alwaysBundle: ['@mx-space/push-protocol'],
  },
})

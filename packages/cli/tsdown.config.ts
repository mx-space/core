import { createRequire } from 'node:module'

import { defineConfig } from 'tsdown'

const require = createRequire(import.meta.url)

const vendorPreviewAsset = (id: string) => ({
  from: require.resolve(id),
  to: 'dist/vendor/litexml',
})

export default defineConfig({
  clean: true,
  target: 'es2022',
  entry: ['src/bin/mxs.ts', 'src/index.ts'],
  outDir: 'dist',
  dts: { eager: true },
  format: ['esm'],
  platform: 'node',
  deps: {
    alwaysBundle: () => true,
    onlyBundle: false,
  },
  sourcemap: false,
  copy: [
    {
      ...vendorPreviewAsset('@haklex/rich-litexml-cli/dist/cli.mjs'),
      rename: 'cli.mjs',
    },
    vendorPreviewAsset('@haklex/rich-compose/style.css'),
    vendorPreviewAsset('@haklex/rich-compose/litexml-html-preview-client.css'),
    vendorPreviewAsset('@haklex/rich-compose/litexml-html-preview-client.js'),
  ],

  shims: true,
})

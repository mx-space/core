import { readFileSync } from 'node:fs'

import { defineConfig } from 'tsdown'

const RAW_QUERY = '?raw'

export default defineConfig({
  clean: true,
  target: 'es2022',
  entry: [
    'src/index.ts',
    'src/runtime/index.ts',
    'src/decision/index.ts',
    'src/engine/index.ts',
    'src/prompts/index.ts',
    'src/translation/index.ts',
  ],
  outDir: 'dist',
  dts: true,
  format: ['esm'],
  platform: 'neutral',
  sourcemap: true,
  plugins: [
    {
      name: 'raw-text',
      load(id) {
        if (!id.endsWith(RAW_QUERY)) return null
        const source = readFileSync(id.slice(0, -RAW_QUERY.length), 'utf8')
        return `export default ${JSON.stringify(source)}`
      },
    },
  ],
})

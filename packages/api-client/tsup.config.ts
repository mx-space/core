import { readdirSync } from 'fs'
import path from 'path'
import { defineConfig } from 'tsup'

const __dirname = new URL(import.meta.url).pathname.replace(/\/[^/]*$/, '')

const adaptorNames = readdirSync(path.resolve(__dirname, './adaptors')).map(
  (i) => path.parse(i).name,
)

export default defineConfig({
  clean: true,
  target: 'es2020',
  entry: ['index.ts', ...adaptorNames.map((name) => `adaptors/${name}.ts`)],
  external: adaptorNames,
  dts: true,
  format: ['cjs', 'esm', 'iife'],
})

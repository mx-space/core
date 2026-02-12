import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'tsdown'

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
  format: ['cjs', 'esm'],
  onSuccess() {
    // Replace declare module '../core/client' with declare module '@mx-space/api-client'
    const PKG = JSON.parse(
      readFileSync(path.resolve(__dirname, './package.json'), 'utf-8'),
    )
    const dts = path.resolve(__dirname, './dist/index.d.cts')
    const dtsm = path.resolve(__dirname, './dist/index.d.mts')
    const content = readFileSync(dts, 'utf-8')

    for (const file of [dts, dtsm]) {
      writeFileSync(
        file,
        content.replaceAll(
          /declare module '..\/core\/client'/g,
          `declare module '${PKG.name}'`,
        ),
      )
    }
  },
})

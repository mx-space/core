import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const __dirname = new URL(import.meta.url).pathname.replace(/\/[^/]*$/, '')
const PKG = JSON.parse(readFileSync(path.resolve(__dirname, './package.json')))

const dts = path.resolve(__dirname, './dist/index.d.ts')
const content = readFileSync(dts, 'utf-8')

// replace declare module '../core/client'
// with declare module '@mx-space/api-client'
writeFileSync(
  dts,
  content.replaceAll(
    /declare module '..\/core\/client'/g,
    'declare module ' + `'${PKG.name}'`,
  ),
)

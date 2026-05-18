#!/usr/bin/env node
const { existsSync } = require('node:fs')
const { join } = require('node:path')
const { spawnSync } = require('node:child_process')

const packageRoot = join(__dirname, '..')
const productionEntry = join(packageRoot, 'dist', 'bin', 'mxs.mjs')
const developmentEntry = join(packageRoot, 'src', 'bin', 'mxs.ts')

const args = process.argv.slice(2)

let result
if (existsSync(developmentEntry)) {
  result = spawnSync(
    process.execPath,
    ['--import', 'tsx', developmentEntry, ...args],
    {
      cwd: packageRoot,
      stdio: 'inherit',
    },
  )
} else if (existsSync(productionEntry)) {
  result = spawnSync(process.execPath, [productionEntry, ...args], {
    stdio: 'inherit',
  })
} else {
  console.error('mxs entry not found; run `pnpm -C packages/cli run build`.')
  process.exit(1)
}

if (result.error) {
  console.error(result.error.message)
  process.exit(1)
}

if (result.signal) {
  process.exit(1)
}

process.exit(result.status ?? 0)

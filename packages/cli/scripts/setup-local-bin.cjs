#!/usr/bin/env node
/**
 * Create `packages/cli/node_modules/.bin/mxs` so that bare `mxs` invoked from
 * inside the workspace resolves to the repository-local shim (which prefers the
 * TypeScript source entry over the published dist build). Idempotent.
 *
 * Runs only in the workspace checkout — gated on `src/bin/mxs.ts` being present
 * to skip end-user `npm install -g @mx-space/cli` installs.
 */
const fs = require('node:fs')
const path = require('node:path')

const packageRoot = path.resolve(__dirname, '..')
const sourceEntry = path.join(packageRoot, 'src', 'bin', 'mxs.ts')
const binShim = path.join(packageRoot, 'bin', 'mxs.cjs')
const linkDir = path.join(packageRoot, 'node_modules', '.bin')
const linkPath = path.join(linkDir, 'mxs')
const target = path.relative(linkDir, binShim)

function safeUnlink(p) {
  try {
    fs.unlinkSync(p)
  } catch (err) {
    if (err && err.code !== 'ENOENT') throw err
  }
}

try {
  if (!fs.existsSync(sourceEntry)) return
  if (!fs.existsSync(binShim)) return
  fs.mkdirSync(linkDir, { recursive: true })

  let current = null
  try {
    current = fs.readlinkSync(linkPath)
  } catch (err) {
    if (err && err.code !== 'ENOENT' && err.code !== 'EINVAL') throw err
  }
  if (current === target) return

  safeUnlink(linkPath)
  fs.symlinkSync(target, linkPath)
  try {
    fs.chmodSync(binShim, 0o755)
  } catch {}
} catch (err) {
  process.stderr.write(
    `mxs: setup-local-bin warning: ${err && err.message ? err.message : err}\n`,
  )
}

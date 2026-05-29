#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Bump the admin package version for an INDEPENDENT admin release (decoupled from
// the core release). An independent release is a deliberate action, so this always
// bumps (the diff-based auto-bump lives in bump-admin-version.js, the core path).
//
// Usage: node bump-admin-release.js [patch|minor|major] [--dry]
//   default level: patch. --dry computes & prints the next version without writing.
// Prints ONLY the next version to stdout; all logs go to stderr.

const __dirname = dirname(fileURLToPath(import.meta.url))
// apps/core/scripts -> apps/core -> apps -> repo root
const repoRoot = resolve(__dirname, '../../..')
const adminPkgPath = join(repoRoot, 'apps/admin/package.json')

const args = process.argv.slice(2)
const dry = args.includes('--dry') || args.includes('-n')
const level = (args.find((a) => !a.startsWith('-')) || 'patch').toLowerCase()
if (!['patch', 'minor', 'major'].includes(level)) {
  console.error(`Invalid bump level "${level}" (expected patch|minor|major)`)
  process.exit(1)
}

const raw = readFileSync(adminPkgPath, 'utf8')
const match = raw.match(/"version"\s*:\s*"(\d+)\.(\d+)\.(\d+)[^"]*"/)
if (!match) {
  console.error('Cannot find a semver "version" field in apps/admin/package.json')
  process.exit(1)
}

let major = Number(match[1])
let minor = Number(match[2])
let patch = Number(match[3])
const prev = `${major}.${minor}.${patch}`
if (level === 'major') {
  major += 1
  minor = 0
  patch = 0
} else if (level === 'minor') {
  minor += 1
  patch = 0
} else {
  patch += 1
}
const next = `${major}.${minor}.${patch}`

if (!dry) {
  // Surgical replace of just the version value — preserves formatting and key
  // order so it does not fight prettier-package-json.
  const updated = raw.replace(
    /("version"\s*:\s*")\d+\.\d+\.\d+[^"]*(")/,
    `$1${next}$2`,
  )
  writeFileSync(adminPkgPath, updated)
}
console.error(`admin version ${prev} -> ${next} (${level})${dry ? ' [dry]' : ''}`)
process.stdout.write(next)

#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// This script lives at apps/core/scripts/bump-admin-version.js.
// On a core release we diff apps/admin against the previous core release tag.
// If apps/admin changed since that tag, bump the admin package's PATCH version.

const __dirname = dirname(fileURLToPath(import.meta.url))

function resolveRepoRoot() {
  // apps/core/scripts -> apps/core -> apps -> repo root
  const fallback = resolve(__dirname, '../../..')
  try {
    const root = execSync('git rev-parse --show-toplevel', {
      cwd: __dirname,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    return root || fallback
  } catch {
    return fallback
  }
}

const repoRoot = resolveRepoRoot()
const adminPkgPath = join(repoRoot, 'apps/admin/package.json')

function git(args) {
  return execSync(`git ${args}`, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim()
}

function findPreviousReleaseTag() {
  // Latest tag matching v* by semver order. Never throws — returns null when none.
  try {
    const tags = git('tag --list "v*" --sort=-v:refname')
    const list = tags.split('\n').map((t) => t.trim()).filter(Boolean)
    return list.length > 0 ? list[0] : null
  } catch {
    return null
  }
}

function bumpPatch(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)(.*)$/.exec(String(version))
  if (!match) {
    throw new Error(`Cannot parse admin version "${version}"`)
  }
  const [, major, minor, patch, suffix] = match
  return `${major}.${minor}.${Number(patch) + 1}${suffix.startsWith('-') ? '' : suffix}`
}

function main() {
  if (!existsSync(adminPkgPath)) {
    console.info(`admin package.json not found at ${adminPkgPath}, skipping bump`)
    return
  }

  const tag = findPreviousReleaseTag()
  if (!tag) {
    console.info('no previous core release tag found, skipping admin version bump')
    return
  }

  let adminChanged = true
  try {
    // exit 0 = no diff, exit 1 = diff. --quiet implies --exit-code.
    git(`diff --quiet ${tag} HEAD -- apps/admin`)
    adminChanged = false
  } catch {
    adminChanged = true
  }

  if (!adminChanged) {
    console.info(`admin unchanged since ${tag}, no bump`)
    return
  }

  const raw = readFileSync(adminPkgPath, 'utf8')
  const vmatch = raw.match(/"version"\s*:\s*"(\d+\.\d+\.\d+[^"]*)"/)
  if (!vmatch) {
    console.info('admin package.json has no semver version field, skipping bump')
    return
  }
  const prevVersion = vmatch[1]
  const nextVersion = bumpPatch(prevVersion)
  // Surgical replace — preserves formatting / key order (prettier-package-json safe).
  const updated = raw.replace(
    /("version"\s*:\s*")\d+\.\d+\.\d+[^"]*(")/,
    `$1${nextVersion}$2`,
  )
  writeFileSync(adminPkgPath, updated)
  console.info(`admin changed since ${tag}, bumped version ${prevVersion} -> ${nextVersion}`)
}

main()

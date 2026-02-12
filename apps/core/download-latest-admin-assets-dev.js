#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const {
  dashboard: { repo, version },
} = require('./package.json')

const endpoint = `https://api.github.com/repos/${repo}/releases/tags/v${version}`
;(async () => {
  const json = await fetch(endpoint).then((res) => res.json())
  const downloadUrl = json.assets.find(
    (asset) => asset.name === 'release.zip',
  ).browser_download_url
  const buffer = await fetch(downloadUrl).then((res) => res.arrayBuffer())
  appendFileSync(join(process.cwd(), 'admin-release.zip'), Buffer.from(buffer))

  execSync('ls -lh', { stdio: 'inherit' })

  execSync('unzip admin-release.zip -d tmp/admin', { stdio: 'inherit' })

  execSync('rm -f admin-release.zip', { stdio: 'inherit' })
  // release.zip > dist > index.html
})().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

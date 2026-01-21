#!env node
import { appendFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { $ } from 'zx'

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

  await $`ls -lh`

  await $`unzip admin-release.zip -d tmp/admin`

  await $`rm -f admin-release.zip`
  // release.zip > dist > index.html
})().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

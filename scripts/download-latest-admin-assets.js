#!env node
const { createWriteStream } = require('fs')
const { join } = require('path')
const { fetch, $ } = require('zx')
const {
  dashboard: { repo, version },
} = require('../package.json')

const endpoint = `https://api.github.com/repos/${repo}/releases/tags/v${version}`
!(async () => {
  const json = await fetch(endpoint).then((res) => res.json())
  const downloadUrl = json.assets.find(
    (asset) => asset.name === 'release.zip',
  ).browser_download_url
  const bufffer = await fetch(downloadUrl).then((res) => res.buffer())
  const stream = createWriteStream(join(process.cwd(), 'admin-release.zip'))
  stream.write(bufffer)
  stream.end()

  await $`unzip admin-release.zip -d out`
  await $`mv out/dist out/admin`
  await $`rm -f admin-release.zip`
  // release.zip > dist > index.html
})()

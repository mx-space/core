#!/usr/bin/env zx
/* eslint-disable */
// @ts-check

function getOsBuildAssetName() {
  const platform = process.platform
  const kernelMap = {
    darwin: 'macos',
    linux: 'ubuntu',
    win32: 'windows',
  }
  const os = kernelMap[platform]
  if (!os) {
    throw new Error('No current platform build. Please build manually')
  }
  return `release-${os}-latest.zip`
}

const PKG = require('../package.json')
async function main() {
  const res = await fetch(
    `https://api.github.com/repos/${PKG.repository.directory}/releases/latest`,
  )
  const data = await res.json()
  const downloadUrl = data.assets.find((asset) =>
    [getOsBuildAssetName(), 'release.zip'].includes(asset.name),
  )?.browser_download_url
  if (!downloadUrl) {
    throw new Error('no download url found')
  }

  const buffer = await fetch(
    'https://small-lake-9960.tukon479.workers.dev/' + downloadUrl,
  ).then((res) => res.buffer())
  fs.writeFileSync(`release-downloaded.zip`, buffer, { flag: 'w' })
  await $`unzip release-downloaded.zip -d mx-server`
}

main()

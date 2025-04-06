function getOsBuildAssetName() {
  const platform = process.platform
  const kernelMap = {
    darwin: 'macos',
    linux: 'linux',
    win32: 'windows',
  }
  const os = kernelMap[platform]
  if (!os) {
    throw new Error('No current platform build. Please build manually')
  }
  return `release-${os}.zip`
}

const { appendFileSync } = require('node:fs')

async function main() {
  const res = await fetch(
    `https://api.github.com/repos/mx-space/core/releases/latest`,
  )
  const data = await res.json()
  const downloadUrl = data.assets.find((asset) =>
    [getOsBuildAssetName(), 'release.zip'].includes(asset.name),
  )?.browser_download_url
  if (!downloadUrl) {
    throw new Error('no download url found')
  }

  const buffer = await fetch(downloadUrl).then((res) => res.arrayBuffer())
  appendFileSync(`release-downloaded.zip`, Buffer.from(buffer))
  await $`unzip release-downloaded.zip -d mx-server`
}

main()

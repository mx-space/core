#!/usr/bin/env zx
/* eslint-disable */

async function main() {
  const owner = 'mx-space'
  const repo = 'server-next'
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/releases/latest`,
  )
  const data = await res.json()
  const downloadUrl = data.assets.find(
    (asset) =>
      asset.name === 'release-ubuntu.zip' || asset.name === 'release.zip',
  )?.browser_download_url
  if (!downloadUrl) {
    throw new Error('no download url found')
  }

  const buffer = await fetch(
    'https://small-lake-9960.tukon479.workers.dev/' + downloadUrl,
  ).then((res) => res.buffer())
  fs.writeFileSync(`release-ubuntu.zip`, buffer, { flag: 'w' })
  await $`unzip release-ubuntu.zip -d mx-server`
}

main()

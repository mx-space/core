#!/usr/bin/env zx
// @ts-check
const { cd, $, os, fs, path, fetch, nothrow, sleep } = require('zx-cjs')
const { homedir } = os
const { repository } = require('../package.json')

const argv = process.argv.slice(2)

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
  return `release-${os}-latest.zip`
}

async function main() {
  cd(path.resolve(homedir(), 'mx'))
  const res = await fetch(
    `https://api.github.com/repos/${repository.directory}/releases/latest`,
  )
  const data = await res.json()
  const downloadUrl = data.assets.find((asset) =>
    [getOsBuildAssetName(), 'release.zip'].includes(asset.name),
  )?.browser_download_url

  if (!downloadUrl) {
    throw new Error('no download url found')
  }

  const buffer = await fetch(
    `https://small-lake-9960.tukon479.workers.dev/${downloadUrl}`,
  ).then((res) => res.buffer())
  const tmpName = (Math.random() * 10).toString(16)
  fs.writeFileSync(`/tmp/${tmpName}.zip`, buffer, { flag: 'w' })
  await $`rm -rf ./run`
  await $`unzip /tmp/${tmpName}.zip -d ./run`
  await $`rm /tmp/${tmpName}.zip`
  cd('./run')
  process.env.NODE_ENV = 'production'
  await $`export NODE_ENV=production`
  await nothrow($`pm2 reload ecosystem.config.js -- ${argv}`)
  console.log('等待 15 秒')
  await sleep(15000)
  try {
    await $`lsof -i:2333 -P -n | grep LISTEN`
  } catch {
    await $`pm2 stop ecosystem.config.js`
    throw new Error('server is not running')
  }
}

main()

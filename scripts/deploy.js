#!/usr/bin/env zx
// @ts-check
const {
  cd,
  $,
  os,
  fs,
  path,
  fetch,
  nothrow,
  sleep,
  argv: Ar,
} = require('zx-cjs')
const { homedir } = os
const { repository } = require('../package.json')

const owner = 'mx-space'
const repo = 'core'

const argv = process.argv.slice(2)

const tag = Ar.tag || `4.5.3`
const ghMirror = `github.hscsec.cn`
const tagDownloadUrl = `https://${ghMirror}/${owner}/${repo}/releases/download/v${tag}/release-ubuntu-latest.zip`

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

const getProxyDownloadUrl = (downloadUrl) => {
  const url = new URL(downloadUrl)

  // url.host = ghMirror

  // return url.toString()

  return `https://ghproxy.com/${downloadUrl}`
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

  const buffer = await fetch(getProxyDownloadUrl(downloadUrl)).then((res) =>
    res.buffer(),
  )
  const tmpName = (Math.random() * 10).toString(16)
  fs.writeFileSync(`/tmp/${tmpName}.zip`, buffer, { flag: 'w' })

  await $`mv ./run ./run.bak`

  await $`unzip /tmp/${tmpName}.zip -d ./run`
  await $`rm /tmp/${tmpName}.zip`

  await $`rm ./run/ecosystem.config.js`
  await $`cp ./run.bak/ecosystem.config.js ./run/ecosystem.config.js`

  cd('./run')

  await nothrow($`pm2 reload ecosystem.config.js -- ${argv}`)
  console.log('等待 8 秒')
  await sleep(8000)
  try {
    await $`curl -f -m 3 localhost:2333/api/v2 -H 'user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.55 Safari/537.36'`
    await $`pm2 save`
    cd(path.resolve(homedir(), 'mx'))
    await $`rm -rf ./run.bak`
  } catch {
    await $`pm2 stop ecosystem.config.js`
    // throw new Error('server is not running')
    console.error('server start error, now rollback...')
    cd(path.resolve(homedir(), 'mx'))
    await $`rm -rf ./run`
    await $`mv ./run.bak ./run`
    cd('./run')
    await $`pm2 delete ecosystem.config.js`
    await $`pm2 start ecosystem.config.js`
  }
}

main()

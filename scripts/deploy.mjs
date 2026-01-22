// @ts-check
import { createRequire as nodeCreateRequire } from 'node:module'
import { homedir } from 'node:os'
import path from 'node:path'
import { copyFile, rm, rename, writeFile } from 'node:fs/promises'
import { exec, execNothrow, getArgValue, sleep } from './node-utils.mjs'

const require = nodeCreateRequire(import.meta.url)
const { repository } = require('../package.json')

const argv = process.argv.slice(2)
const tag = getArgValue(argv, ['--tag']) || `4.5.3`

const owner = 'mx-space'
const repo = 'core'
const ghMirror = `github.hscsec.cn`
// kept for backward compatibility / debugging
const _tagDownloadUrl = `https://${ghMirror}/${owner}/${repo}/releases/download/v${tag}/release-ubuntu-latest.zip`
void _tagDownloadUrl

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
  return `https://ghproxy.com/${downloadUrl}`
}

async function main() {
  process.chdir(path.resolve(homedir(), 'mx'))
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
    res.arrayBuffer(),
  )
  const tmpName = (Math.random() * 10).toString(16)
  const zipPath = `/tmp/${tmpName}.zip`
  await writeFile(zipPath, Buffer.from(buffer), { flag: 'w' })

  await rm('./run.bak', { recursive: true, force: true })
  await rename('./run', './run.bak')

  await exec('unzip', [zipPath, '-d', './run'])
  await rm(zipPath, { force: true })

  await rm('./run/ecosystem.config.cjs', { force: true })
  await copyFile('./run.bak/ecosystem.config.cjs', './run/ecosystem.config.cjs')

  process.chdir('./run')

  await execNothrow('pm2', ['reload', 'ecosystem.config.cjs', '--', ...argv])
  console.log('等待 8 秒')
  await sleep(8000)
  try {
    await exec('curl', [
      '-f',
      '-m',
      '3',
      'localhost:2333/api/v2',
      '-H',
      'user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.55 Safari/537.36',
    ])
    await exec('pm2', ['save'])
    process.chdir(path.resolve(homedir(), 'mx'))
    await rm('./run.bak', { recursive: true, force: true })
  } catch {
    await exec('pm2', ['stop', 'ecosystem.config.cjs'])
    // throw new Error('server is not running')
    console.error('server start error, now rollback...')
    process.chdir(path.resolve(homedir(), 'mx'))
    await rm('./run', { recursive: true, force: true })
    await rename('./run.bak', './run')
    process.chdir('./run')
    await exec('pm2', ['delete', 'ecosystem.config.cjs'])
    await exec('pm2', ['start', 'ecosystem.config.cjs'])
  }
}

main()


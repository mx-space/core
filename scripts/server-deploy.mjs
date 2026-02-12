#!/usr/bin/env node
// @ts-check
import { copyFile, rename, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { exec, execNothrow, getArgValue, sleep } from './node-utils.mjs'

const repository = {
  directory: 'mx-space/core',
  url: 'https://github.com/mx-space/core',
}

const argv = process.argv.slice(2)
const scpPath = getArgValue(argv, ['--scp_path', '--scpPath'])

function stripArgv(argv) {
  const out = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]

    // internal args for this deploy script (do not forward to pm2 app)
    if (a === '--scp_path' || a === '--scpPath') {
      i++ // skip next value
      continue
    }
    if (a.startsWith('--scp_path=') || a.startsWith('--scpPath=')) continue

    out.push(a)
  }
  return out
}

const argvForPm2 = stripArgv(argv)
function getOsBuildAssetName() {
  return `release-linux.zip`
}

function printExecError(err, title) {
  if (title) console.error(title)
  if (!err) return

  /** @type {any} */
  const e = err

  if (e?.cmd) console.error(`[cmd] ${e.cmd}`)
  if (typeof e?.exitCode !== 'undefined')
    console.error(`[exitCode] ${e.exitCode}`)
  if (e?.signal) console.error(`[signal] ${e.signal}`)

  if (e?.stdout) {
    console.error('--- stdout ---')
    console.error(String(e.stdout))
  }
  if (e?.stderr) {
    console.error('--- stderr ---')
    console.error(String(e.stderr))
  }

  if (e?.stack) {
    console.error('--- stack ---')
    console.error(String(e.stack))
  } else if (e?.message) {
    console.error(String(e.message))
  } else {
    console.error(e)
  }
}

async function main() {
  process.chdir(path.resolve(homedir(), 'mx'))
  if (!scpPath) {
    const releases = await fetch(
      `https://api.github.com/repos/${repository.directory}/releases`,
    ).then((res) => res.json())
    const [latest] = releases
    const tagName = latest.tag_name

    const res = await fetch(
      `https://api.github.com/repos/${repository.directory}/releases/tags/${tagName}`,
    )
    const data = await res.json()
    const downloadUrl = data.assets.find((asset) =>
      [getOsBuildAssetName(), 'release.zip'].includes(asset.name),
    )?.browser_download_url

    if (!downloadUrl) {
      throw new Error('no download url found')
    }

    const buffer = await fetch(downloadUrl)
      .then((res) => res.arrayBuffer())
      .then((buffer) => Buffer.from(buffer))
    const tmpName = (Math.random() * 10).toString(16)
    const zipPath = `/tmp/${tmpName}.zip`
    await writeFile(zipPath, buffer, { flag: 'w' })

    await rm('./run.bak', { recursive: true, force: true })
    await rename('./run', './run.bak')

    await exec('unzip', [zipPath, '-d', './run'])
    await rm(zipPath, { force: true })
  } else {
    await rm('./run.bak', { recursive: true, force: true })
    await rename('./run', './run.bak')

    await exec('unzip', [scpPath, '-d', './run'])
    await rm(scpPath, { force: true })
  }

  await rm('./run/ecosystem.config.cjs', { force: true })
  await copyFile('./run.bak/ecosystem.config.cjs', './run/ecosystem.config.cjs')

  process.chdir('./run')

  await execNothrow('pm2', [
    'reload',
    'ecosystem.config.cjs',
    '--',
    ...argvForPm2,
  ])
  console.log('等待 18 秒')
  await sleep(18000)
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
  } catch (error) {
    printExecError(error, 'server start error (healthcheck failed)')

    const status = await execNothrow('pm2', ['status'], { stdio: 'pipe' })
    if (status?.stdout) console.error(String(status.stdout))
    if (status?.stderr) console.error(String(status.stderr))

    const logs = await execNothrow(
      'pm2',
      ['logs', '--lines', '200', '--nostream'],
      { stdio: 'pipe' },
    )
    if (logs?.stdout) console.error(String(logs.stdout))
    if (logs?.stderr) console.error(String(logs.stderr))

    try {
      await exec('pm2', ['stop', 'ecosystem.config.cjs'])
      // throw new Error('server is not running')
      console.error('now rollback...')
      process.chdir(path.resolve(homedir(), 'mx'))
      await rm('./run', { recursive: true, force: true })
      await rename('./run.bak', './run')
      process.chdir('./run')
      await exec('pm2', ['delete', 'ecosystem.config.cjs'])
      await exec('pm2', ['start', 'ecosystem.config.cjs'])
    } catch (error) {
      printExecError(error, 'rollback failed')
      throw error
    }
  }
}

main()

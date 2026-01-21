#!/usr/bin/env zx
// @ts-check
import { createRequire as nodeCreateRequire } from 'node:module'
import { homedir } from 'node:os'
import path from 'node:path'
import { $, argv as av, cd, fs, nothrow, sleep } from 'zx'

const require = nodeCreateRequire(import.meta.url)
const { repository } = require('../package.json')

const argv = process.argv.slice(2)
const scpPath = av.scp_path
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
  cd(path.resolve(homedir(), 'mx'))
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

    const buffer = await fetch(
      `https://mirror.ghproxy.com/${downloadUrl}`,
    ).then((res) => res.arrayBuffer())
    const tmpName = (Math.random() * 10).toString(16)
    fs.writeFileSync(`/tmp/${tmpName}.zip`, Buffer.from(buffer), { flag: 'w' })

    await $`mv ./run ./run.bak`

    await $`unzip /tmp/${tmpName}.zip -d ./run`
    await $`rm /tmp/${tmpName}.zip`
  } else {
    await $`mv ./run ./run.bak`

    await $`unzip ${scpPath} -d ./run`
    await $`rm ${scpPath}`
  }

  await $`rm ./run/ecosystem.config.cjs`
  await $`cp ./run.bak/ecosystem.config.cjs ./run/ecosystem.config.cjs`

  cd('./run')

  await nothrow($`pm2 reload ecosystem.config.cjs -- ${argv}`)
  console.log('等待 8 秒')
  await sleep(8000)
  try {
    await $`curl -f -m 3 localhost:2333/api/v2 -H 'user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.55 Safari/537.36'`
    await $`pm2 save`
    cd(path.resolve(homedir(), 'mx'))
    await $`rm -rf ./run.bak`
  } catch (error) {
    printExecError(error, 'server start error (healthcheck failed)')

    const status = await nothrow($`pm2 status`)
    if (status?.stdout) console.error(String(status.stdout))
    if (status?.stderr) console.error(String(status.stderr))

    const logs = await nothrow($`pm2 logs --lines 200 --nostream`)
    if (logs?.stdout) console.error(String(logs.stdout))
    if (logs?.stderr) console.error(String(logs.stderr))

    try {
      await $`pm2 stop ecosystem.config.cjs`
      // throw new Error('server is not running')
      console.error('now rollback...')
      cd(path.resolve(homedir(), 'mx'))
      await $`rm -rf ./run`
      await $`mv ./run.bak ./run`
      cd('./run')
      await $`pm2 delete ecosystem.config.cjs`
      await $`pm2 start ecosystem.config.cjs`
    } catch (error) {
      printExecError(error, 'rollback failed')
      throw error
    }
  }
}

main()

// @ts-check
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { chalk } from 'zx-cjs'

async function main() {
  const cwd = process.cwd()

  const isRootDir = fs.existsSync(path.resolve(cwd, 'pnpm-workspace.yaml'))
  if (!isRootDir) {
    console.warn(chalk.yellow('not a root dir, skip init assets'))
    return
  }
  const existAsset = fs.existsSync(path.resolve(cwd, 'assets'))

  if (!existAsset) {
    const cmd = `git clone https://github.com/mx-space/assets.git ${path.resolve(
      cwd,
      'assets',
    )}`
    console.log(cmd)
    try {
      execSync(cmd)
    } catch (error) {
      console.log(error)
      console.log('git clone assets repo failed, please check your network')

      process.exit(1)
    }

    // fs.rmSync(path.resolve(cwd, 'assets', '.git'), {
    //   force: true,
    //   recursive: true,
    // })
    const symlinkPath = path.resolve(cwd, 'apps/core/assets')
    fs.rmSync(path.resolve(cwd, symlinkPath), {
      force: true,
    })

    fs.symlinkSync(path.resolve(cwd, 'assets'), path.resolve(cwd, symlinkPath))
  }
}

main()

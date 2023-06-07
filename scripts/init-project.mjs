// @ts-check
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

async function main() {
  const cwd = process.cwd()
  const existAsset = fs.existsSync(path.resolve(cwd, 'assets'))

  if (!existAsset) {
    const cmd = `npx degit https://github.com/mx-space/assets.git assets`
    console.log(cmd)
    try {
      execSync(cmd)
    } catch (err) {
      console.log(err)
      console.log('git clone assets repo failed, please check your network')

      process.exit(1)
    }

    fs.rmSync(path.resolve(cwd, 'assets', '.git'), {
      force: true,
      recursive: true,
    })
    execSync('ln -s $PWD/assets $PWD/apps/core/assets ')
  }
}

main()

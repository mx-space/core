// @ts-check
import fs from 'fs'
import path from 'path'
import { $ } from 'zx'

async function main() {
  const cwd = process.cwd()
  const existAsset = fs.existsSync(path.resolve(cwd, 'assets'))
  const assetsRepoUrl = `https://github.com/mx-space/assets.git`
  if (!existAsset) {
    await $`git clone ${assetsRepoUrl}`.catch((err) => {
      console.log(err)
      console.log('git clone assets repo failed, please check your network')
    })
    fs.rmSync(path.resolve(cwd, 'assets', '.git'), {
      force: true,
      recursive: true,
    })
  }
}

main()

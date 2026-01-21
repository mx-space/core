// @ts-check
import { readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import inquirer from 'inquirer'
import { $, chalk } from 'zx'

const require = createRequire(import.meta.url)
const prompt = inquirer.createPromptModule()
const package_ = require('../package.json')
const PATCH_DIR = resolve(process.cwd(), './patch')

async function bootstrap() {
  console.log(chalk.yellowBright('mx-space server patch center'))

  console.log(chalk.yellow(`current version: ${package_.version}`))

  const patchFiles = readdirSync(PATCH_DIR).filter(
    (file) => file.startsWith('v') && file.endsWith('.js'),
  )

  prompt({
    type: 'list',
    name: 'version',
    message: 'Select version you want to patch.',
    choices: patchFiles.map((f) => f.replace(/\.js$/, '')),
  }).then(async ({ version }) => {
    const patchPath = resolve(PATCH_DIR, `./${version}.js`)
    console.log(chalk.green(`starting patch... ${patchPath}`))
    await $`node ${patchPath}`
  })
}

bootstrap()

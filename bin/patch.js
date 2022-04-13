// @ts-check
const { resolve } = require('path')
const { readdirSync } = require('fs')
const inquirer = require('inquirer')

const prompt = inquirer.createPromptModule()
const { $, chalk } = require('zx-cjs')
const package = require('../package.json')
const PATCH_DIR = resolve(process.cwd(), './patch')

async function bootstarp() {
  console.log(chalk.yellowBright('mx-space server patch center'))

  console.log(chalk.yellow(`current version: ${package.version}`))

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

bootstarp()

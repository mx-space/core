// @ts-check
const inquirer = require('inquirer')
const chalk = require('chalk')
const prompt = inquirer.createPromptModule()
const package = require('../package.json')
const { execSync } = require('child_process')
const { resolve } = require('path')
const { readdirSync } = require('fs')
const PATCH_DIR = resolve(process.cwd(), './patch')

async function bootstarp() {
  console.log(chalk.yellowBright('mx-space server patch center'))

  console.log(chalk.yellow(`current version: ${package.version}`))

  const patchFiles = readdirSync(PATCH_DIR).filter(
    (file) => file.startsWith('v') && file.endsWith('.ts'),
  )

  prompt({
    type: 'list',
    name: 'version',
    message: 'Select version you want to patch.',
    choices: patchFiles.map((f) => f.replace(/\.ts$/, '')),
  }).then(({ version }) => {
    execSync('yarn run build', {
      encoding: 'utf-8',
    })

    const patchPath = resolve('dist/patch/', version + '.js')
    console.log(chalk.green('starting patch... ' + patchPath))
    execSync(`node ${patchPath}`, { encoding: 'utf8' })
  })
}

bootstarp()

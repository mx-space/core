const { readFileSync, writeFileSync } = require('fs')
const { join } = require('path')
const { chalk, $ } = require('zx')

const inquirer = require('inquirer')
const semver = require('semver')

const PKG_PATH = join(process.cwd(), './package.json')
const PKG = JSON.parse(readFileSync(PKG_PATH))

const beforeHooks = PKG.bump?.before || []
const afterHooks = PKG.bump?.after || []

const releaseTypes = [
  'patch',
  'minor',
  'major',
  'premajor',
  'preminor',
  'prepatch',
  'prerelease',
]

function generateReleaseTypes(currentVersion, types, pried = 'alpha') {
  return types.map((item) => {
    let version = semver.inc(currentVersion, item, pried)
    return {
      name: `${item} - ${version}`,
      value: version,
    }
  })
}

async function execCmd(cmds) {
  for (const cmd of cmds) {
    await $([cmd])
  }
}

async function main() {
  console.log(chalk.yellow('Current Version: ' + PKG.version))

  const { version: newVersion } = await inquirer.prompt({
    type: 'list',
    name: 'version',
    message: 'Which version would you like to bump it? ',
    choices: generateReleaseTypes(PKG.version, releaseTypes),
  })

  PKG.version = newVersion
  console.log(chalk.green('Running before hooks.'))

  await execCmd(beforeHooks)

  writeFileSync(PKG_PATH, JSON.stringify(PKG, null, 2))

  console.log(chalk.green('Running after hooks.'))
  await execCmd(afterHooks)
}
main()

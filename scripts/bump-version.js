const { readFileSync, writeFileSync } = require('fs')
const { join } = require('path')
const { chalk } = require('zx')
const inquirer = require('inquirer')
const semver = require('semver')
const { execSync } = require('child_process')

const PKG_PATH = join(process.cwd(), './package.json')
const PKG = JSON.parse(readFileSync(PKG_PATH))

const beforeHooks = PKG.bump?.before || []
const afterHooks = PKG.bump?.before || []

const releaseTypes = [
  'major',
  'minor',
  'patch',
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

  for (const cmd of beforeHooks) {
    try {
      execSync(cmd, { encoding: 'utf8' })
    } catch (e) {
      console.log(chalk.red(`Error running command: ${cmd}`))
      console.log(chalk.yellow(`${e.stderr}`))
      return
    }
  }

  writeFileSync(PKG_PATH, JSON.stringify(PKG, null, 2))

  console.log(chalk.green('Running after hooks.'))

  for (const cmd of afterHooks) {
    try {
      execSync(cmd, { encoding: 'utf-8' })
    } catch (e) {
      console.log(chalk.red(`Error running command: ${cmd}`))
      console.log(chalk.yellow(`${e.stderr}`))
      return
    }
  }
}
main()

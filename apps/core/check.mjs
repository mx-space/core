import fs from 'fs'
import path from 'path'

async function checkModuleESMSupport(moduleName) {
  try {
    await import(moduleName)
    return true
  } catch (error) {
    return false
  }
}

async function main() {
  const packageJsonPath = path.join(process.cwd(), 'package.json')
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
  const dependencies = Object.keys(packageJson.dependencies)

  for (const dependency of dependencies) {
    const isESMSupported = await checkModuleESMSupport(dependency)
    !isESMSupported &&
      console.log(`Dependency: ${dependency}, ESM Support: ${isESMSupported}`)
  }
}

main()

const fs = require('node:fs')
const path = require('node:path')

const buildDir = path.resolve(__dirname, '../out')
const hasBuild = fs.existsSync(buildDir)
if (!hasBuild) {
  throw new Error('No build folder found')
}

const originalIndexFilePath = path.resolve(buildDir, 'index.js')
const code = fs.readFileSync(originalIndexFilePath, 'utf8')

const replaced = code
  .replace(`require('./sourcemap-register.js');`, '')
  .replace(
    `//# sourceMappingURL=index.js.map`,
    `//# sourceMappingURL=entrypoints.js.map`,
  )
fs.writeFileSync(originalIndexFilePath, replaced)

fs.renameSync(originalIndexFilePath, path.resolve(buildDir, 'entrypoints.js'))
fs.renameSync(
  path.resolve(buildDir, 'index.js.map'),
  path.resolve(buildDir, 'entrypoints.js.map'),
)

fs.writeFileSync(
  path.resolve(buildDir, 'index.debug.js'),
  `#!env node
require('./sourcemap-register.js');require('./entrypoints.js');`,
)

fs.writeFileSync(
  originalIndexFilePath,
  `#!env node
require('./entrypoints.js');`,
)

fs.chmodSync(path.resolve(buildDir, 'index.debug.js'), '755')
fs.chmodSync(originalIndexFilePath, '755')

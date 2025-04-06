import fs, { statSync } from 'node:fs'
import { resolve } from 'node:path'

const srcDir = resolve(process.cwd(), 'src')

const aliasMap = {
  '~': srcDir,
}
/**
 * every ts file relative import statement add `.js` ext
 * @param dir
 */
function walkDir(dir: string) {
  const files = fs.readdirSync(dir)
  files.forEach((file) => {
    const filePath = resolve(dir, file)
    const stat = fs.statSync(filePath)
    if (stat.isDirectory()) {
      walkDir(filePath)
    } else if (stat.isFile() && filePath.endsWith('.ts')) {
      const content = fs.readFileSync(filePath, 'utf-8')

      const newContent = content.replaceAll(/from '(.*)'/g, (match, p1) => {
        // if is startswith alphabet or @, this is a library path, return it

        if (p1.startsWith('@') || /^[a-z]/i.test(p1)) {
          return match
        }

        // if this path is a folder, then add `/index.js` to the end

        let path = ''
        // if this path is a alias
        if (p1.startsWith('~')) {
          path = resolve(aliasMap['~'], p1.replace('~/', './'))
        } else {
          // if path is relative path
          path = resolve(dir, p1)
        }

        console.log(path)

        try {
          const stat = statSync(path)
          if (stat.isDirectory()) {
            return `from '${p1}/index.js'`
          }
        } catch {}

        if (p1.startsWith('.') || p1.startsWith('~')) {
          return `from '${p1}.js'`
        }
        return match
      })
      fs.writeFileSync(filePath, newContent)
    }
  })
}

function main() {
  walkDir(srcDir)
}

main()

import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import ts from 'typescript'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const modulesDir = join(repoRoot, 'apps/core/src/modules')

const walk = (dir: string, files: string[] = []) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(file, files)
    } else if (entry.isFile() && entry.name.endsWith('controller.ts')) {
      files.push(file)
    }
  }
  return files
}

const propertyName = (property: ts.ObjectLiteralElementLike) => {
  if (ts.isShorthandPropertyAssignment(property)) return property.name.text
  if (!ts.isPropertyAssignment(property)) return undefined

  const { name } = property
  if (
    ts.isIdentifier(name) ||
    ts.isStringLiteral(name) ||
    ts.isNumericLiteral(name)
  ) {
    return name.text
  }
}

const unwrapExpression = (expression: ts.Expression): ts.Expression => {
  let current = expression
  while (ts.isParenthesizedExpression(current)) current = current.expression
  return current
}

const violations: string[] = []

for (const file of walk(modulesDir)) {
  const sourceText = readFileSync(file, 'utf8')
  const source = ts.createSourceFile(
    file,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  )

  const visit = (node: ts.Node) => {
    if (!ts.isReturnStatement(node) || !node.expression) {
      ts.forEachChild(node, visit)
      return
    }

    const expression = unwrapExpression(node.expression)
    if (!ts.isObjectLiteralExpression(expression)) {
      ts.forEachChild(node, visit)
      return
    }

    if (expression.properties.some(ts.isSpreadAssignment)) {
      ts.forEachChild(node, visit)
      return
    }

    const names = expression.properties.map(propertyName)
    const isDataOnly = names.length === 1 && names[0] === 'data'
    const isDataWithMeta =
      names.length === 2 && names.includes('data') && names.includes('meta')

    if (isDataOnly || isDataWithMeta) {
      const { line, character } = source.getLineAndCharacterOfPosition(
        expression.getStart(source),
      )
      violations.push(
        `${relative(repoRoot, file)}:${line + 1}:${character + 1} return raw data directly, or use withMeta(data, meta) for response metadata.`,
      )
    }

    ts.forEachChild(node, visit)
  }

  visit(source)
}

if (violations.length > 0) {
  console.error('Controller response envelope returns are not allowed:')
  for (const violation of violations) console.error(`  ${violation}`)
  process.exit(1)
}
